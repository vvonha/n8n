import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import https from "https";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { fileURLToPath } from 'url';
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distPath = path.join(__dirname, 'dist');
const templatesPath = path.join(__dirname, 'templates');
const templateCache = new Map();
const TEMPLATE_CACHE_TTL_MS = Number(process.env.N8N_TEMPLATE_CACHE_TTL_MS) || 10 * 60 * 1000;
const inFlight = new Map();
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const s3 = new S3Client({
  region: process.env.N8N_S3_REGION,
  requestHandler: new NodeHttpHandler({ httpsAgent }),
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(distPath));

async function cachedFetch(key, ttlMs, fetcher) {
  const cached = getCache(key);
  if (cached) return cached;

  if (inFlight.has(key)) return inFlight.get(key);

  const p = (async () => {
    const v = await fetcher();
    templateCache.set(key, { value: v, expiresAt: Date.now() + ttlMs });
    return v;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

function getCache(key) {
  const cached = templateCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    templateCache.delete(key);
    return null;
  }
  return cached.value;
}

function buildWorkflowEndpoint(preferredBase) {
  // If a fully qualified workflows endpoint is provided, trust it as-is.
  if (process.env.N8N_WORKFLOWS_ENDPOINT) {
    return process.env.N8N_WORKFLOWS_ENDPOINT;
  }

  const rawBase = preferredBase || process.env.N8N_API_BASE || process.env.N8N_API_URL;
  if (!rawBase) return null;

  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  const url = new URL(base);
  const path = url.pathname;

  // If someone already supplied /api/v1 or /rest without the resource name, append workflows.
  if (path.includes('/api/v1/') && !path.includes('workflows')) {
    url.pathname = path.endsWith('/') ? `${path}workflows` : `${path}/workflows`;
    return url.toString();
  }

  if (path.includes('/rest/') && !path.includes('workflows')) {
    url.pathname = path.endsWith('/') ? `${path}workflows` : `${path}/workflows`;
    return url.toString();
  }

  // Default to the modern api/v1/workflows endpoint from the host root.
  url.pathname = '/api/v1/workflows';
  return url.toString();
}

function buildAuthHeaders(req) {
  const headers = { 'Content-Type': 'application/json' };
  const apiKeyHeader = req.headers['x-n8n-api-key'];
  const apiKeyBody = req.body?.apiKey;
  const apiKey =
    typeof apiKeyHeader === 'string'
      ? apiKeyHeader
      : typeof apiKeyBody === 'string'
        ? apiKeyBody
        : process.env.N8N_API_KEY;

  if (apiKey) {
    return { ...headers, 'X-N8N-API-KEY': apiKey };
  }

  const bearer = process.env.N8N_BEARER_TOKEN;
  if (bearer) {
    return { ...headers, Authorization: `Bearer ${bearer}` };
  }

  const basicUser = process.env.N8N_BASIC_AUTH_USER;
  const basicPass = process.env.N8N_BASIC_AUTH_PASSWORD;
  if (basicUser && basicPass) {
    const encoded = Buffer.from(`${basicUser}:${basicPass}`).toString('base64');
    return { ...headers, Authorization: `Basic ${encoded}` };
  }

  return null;
}

async function loadTemplateFromDisk(templateId) {
  const filename = `${templateId}.json`;
  const fullPath = path.join(templatesPath, filename);
  try {
    const raw = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function listTemplatesFromDisk() {
  let entries;
  try {
    entries = await fs.readdir(templatesPath, { withFileTypes: true });
  } catch (e) {
    if (e?.code === 'ENOENT') return [];
    throw e;
  }

  const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.json'));
  const fetchConcurrency = Number(process.env.N8N_TEMPLATE_FETCH_CONCURRENCY) || 5;

  const templates = await mapWithConcurrency(jsonFiles, fetchConcurrency, async (file) => {
    const templateId = file.name.replace(/\.json$/, '');
    const loaded = await loadTemplateFromDisk(templateId);
    if (!loaded) return null;
    return { ...normalizeTemplatePayload(loaded), id: loaded.id || templateId };
  });

  return templates.filter(Boolean);
}

function parseS3Path(rawPath) {
  if (!rawPath) return null;

  if (rawPath.startsWith('s3://')) {
    const withoutScheme = rawPath.replace('s3://', '');
    const [bucket, ...rest] = withoutScheme.split('/').filter(Boolean);
    if (!bucket) return null;
    const keyPrefix = rest.join('/');
    return { bucket, keyPrefix: keyPrefix ? `${keyPrefix}${keyPrefix.endsWith('/') ? '' : '/'}` : '' };
  }

  try {
    const parsed = new URL(rawPath);
    const pathname = parsed.pathname.replace(/^\//, '');
    const hostParts = parsed.hostname.split('.');
    const bucket = hostParts[0];
    const keyPrefix = pathname ? `${pathname}${pathname.endsWith('/') ? '' : '/'}` : '';
    return { bucket, keyPrefix };
  } catch (error) {
    const [bucket, ...rest] = rawPath.split('/').filter(Boolean);
    if (!bucket) return null;
    const keyPrefix = rest.join('/');
    return { bucket, keyPrefix: keyPrefix ? `${keyPrefix}${keyPrefix.endsWith('/') ? '' : '/'}` : '' };
  }
}


async function listTemplateKeysFromS3({ bucket, keyPrefix }) {
  let continuationToken;
  const keys = [];

  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix || undefined,
      ContinuationToken: continuationToken,
    }));

    const contents = Array.isArray(resp.Contents) ? resp.Contents : [];
    keys.push(...contents.map((i) => i.Key).filter((k) => k && k.endsWith('.json')));

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function loadTemplateFromS3(key, { bucket }) {
  const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await streamToString(resp.Body);
  return JSON.parse(text || "{}");
}

async function uploadTemplateToS3(key, body, { bucket }) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
  }));
}

function getTemplateStorageConfig() {
  const basePath = process.env.N8N_TEMPLATE_S3_PATH;
  const region =
    process.env.N8N_S3_REGION || process.env.N8N_S3_REGION || process.env.N8N_S3_REGION || undefined;
  const parsed = parseS3Path(basePath);
  if (!parsed) return null;
  return { ...parsed, region };
}

function slugifyName(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (slug) return slug;
  return `template-${Date.now()}`;
}

async function mapWithConcurrency(items, limit, iterator) {
  const concurrency = Math.max(1, Number(limit) || 1);
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await iterator(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function loadTemplateManifest(storage) {
  const manifestKey = process.env.N8N_TEMPLATE_MANIFEST_KEY;
  if (!manifestKey) return null;

  const key = manifestKey.startsWith(storage.keyPrefix)
    ? manifestKey
    : `${storage.keyPrefix}${manifestKey}`;

  const manifest = await loadTemplateFromS3(key, storage);
  const items = Array.isArray(manifest?.templates)
    ? manifest.templates
    : Array.isArray(manifest)
      ? manifest
      : [];

  if (!items.length) return null;

  return items.map((item) => normalizeTemplateMetadata(item, storage));
}

function normalizeTemplatePayload(template) {
  if (!template || typeof template !== 'object') {
    throw new Error('템플릿 데이터가 비어있습니다.');
  }

  const required = ['name', 'description', 'difficulty', 'nodes', 'connections'];
  required.forEach((field) => {
    if (!template[field]) {
      throw new Error(`필수 필드가 누락되었습니다: ${field}`);
    }
  });

  const tags = Array.isArray(template.tags)
    ? template.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  return {
    ...template,
    id: template.id || slugifyName(template.name),
    tags,
    heroColor: template.heroColor || 'linear-gradient(120deg, #c084fc, #60a5fa)',
    credentials: template.credentials?.filter((c) => c) ?? [],
    estimatedSetupMinutes: template.estimatedSetupMinutes
      ? Number(template.estimatedSetupMinutes)
      : undefined,
  };
}

function normalizeTemplateMetadata(template, storage) {
  if (!template || typeof template !== 'object') {
    throw new Error('템플릿 데이터가 비어있습니다.');
  }

  const required = ['name', 'description', 'difficulty'];
  required.forEach((field) => {
    if (!template[field]) {
      throw new Error(`필수 필드가 누락되었습니다: ${field}`);
    }
  });

  const tags = Array.isArray(template.tags)
    ? template.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const s3Key = template.s3Key
    ? template.s3Key.startsWith(storage.keyPrefix)
      ? template.s3Key
      : `${storage.keyPrefix}${template.s3Key}`
    : undefined;

  return {
    ...template,
    id: template.id || slugifyName(template.name),
    tags,
    heroColor: template.heroColor || 'linear-gradient(120deg, #c084fc, #60a5fa)',
    credentials: template.credentials?.filter((c) => c) ?? [],
    estimatedSetupMinutes: template.estimatedSetupMinutes
      ? Number(template.estimatedSetupMinutes)
      : undefined,
    s3Key,
  };
}

app.get('/api/templates', async (_req, res) => {
  const storage = getTemplateStorageConfig();
  try {
    const templates = await cachedFetch('templates:list', TEMPLATE_CACHE_TTL_MS, async () => {
      if (!storage) {
        const t = await listTemplatesFromDisk();
        if (!t.length) throw new Error('NO_LOCAL_TEMPLATES');
        return t;
      }

      const manifestTemplates = await loadTemplateManifest(storage);
      if (manifestTemplates?.length) return manifestTemplates;

      // 운영에서는 가능하면 여기로 떨어지지 않게(=manifest 강제)
      const keys = await listTemplateKeysFromS3(storage);
      const fetchConcurrency = Number(process.env.N8N_TEMPLATE_FETCH_CONCURRENCY) || 5;

      return await mapWithConcurrency(keys, fetchConcurrency, async (key) => {
        const template = await loadTemplateFromS3(key, storage);
        const id = template.id || path.basename(key, '.json');
        return { ...template, id, s3Key: key };
      });
    });

    return res.json({ templates });
  } catch (error) {
    if (error.message === 'NO_LOCAL_TEMPLATES') {
      return res.status(404).json({ message: '로컬 템플릿을 찾을 수 없습니다. templates 폴더를 확인하세요.' });
    }
    console.error('[template-list]', error);
    return res.status(500).json({ message: '템플릿을 불러오지 못했습니다.', error: error.message });
  }
});

app.get('/api/templates/:id', async (req, res) => {
  const storage = getTemplateStorageConfig();
  const templateId = req.params.id;

  try {
    const template = await cachedFetch(`template:${templateId}`, TEMPLATE_CACHE_TTL_MS, async () => {
      if (!storage) {
        const t = await loadTemplateFromDisk(templateId);
        if (!t) throw new Error('NOT_FOUND');
        return normalizeTemplatePayload(t);
      }

      const cachedList = getCache('templates:list');
      const hint = Array.isArray(cachedList) ? cachedList.find((i) => i.id === templateId) : null;
      const s3Key = hint?.s3Key || `${storage.keyPrefix}${templateId}.json`;

      const t = await loadTemplateFromS3(s3Key, storage);
      if (!t.id) t.id = templateId;
      return { ...normalizeTemplatePayload(t), s3Key };
    });

    return res.json({ template });
  } catch (error) {
    const isNotFound = error.message === 'NOT_FOUND' || /NoSuchKey|Not Found/i.test(error?.message || '');
    const status = isNotFound ? 404 : 500;
    if (!isNotFound) console.error('[template-detail]', error);
    return res.status(status).json({ message: '템플릿 상세를 불러오지 못했습니다.', error: error.message });
  }
});

app.post('/api/templates', async (req, res) => {
  const storage = getTemplateStorageConfig();
  if (!storage) {
    return res.status(500).json({ message: 'N8N_TEMPLATE_S3_PATH 환경변수를 설정해주세요.' });
  }

  try {
    const template = normalizeTemplatePayload(req.body?.template || req.body);
    const key = `${storage.keyPrefix}${template.id}.json`;
    const body = JSON.stringify(template, null, 2);
    await uploadTemplateToS3(key, body, storage);
    templateCache.clear();
    res.status(201).json({ template, key });
  } catch (error) {
    console.error('[template-upload]', error);
    res.status(500).json({ message: '템플릿 업로드에 실패했습니다.', error: error.message });
  }
});

app.post('/api/import-workflow', async (req, res) => {
  const { templateId, workflow, name } = req.body || {};

  let resolved = workflow;
  if (!resolved && templateId) {
    resolved = await loadTemplateFromDisk(templateId);
  }

  if (!resolved || !resolved.nodes || !resolved.connections) {
    return res.status(400).json({ message: '템플릿 JSON을 찾을 수 없습니다. templateId 또는 workflow를 확인하세요.' });
  }

  const headers = buildAuthHeaders(req);
  if (!headers) {
    return res.status(400).json({
      message:
        'n8n API 인증 정보가 없습니다. 요청 헤더/바디로 X-N8N-API-KEY 또는 apiKey를 전달하거나 서버 환경변수를 설정하세요.',
    });
  }

  const endpoint = buildWorkflowEndpoint(req.body?.apiBase);
  if (!endpoint) {
    return res.status(400).json({
      message: 'n8n API 주소가 설정되지 않았습니다. N8N_API_BASE 또는 N8N_WORKFLOWS_ENDPOINT 환경변수, 혹은 apiBase 필드를 전달하세요.',
    });
  }
  const payload = {
    name: name || resolved.name || 'Imported from template gallery',
    nodes: resolved.nodes,
    connections: resolved.connections,
    settings: resolved.settings || {},
  };

  try {
    const apiResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await apiResponse.text();
    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ message: text || 'n8n API 호출에 실패했습니다.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = null;
    }

    return res.status(201).json({ id: parsed?.id || null, raw: parsed || text, endpoint });
  } catch (error) {
    console.error('[import-workflow] error', error);
    return res.status(500).json({ message: '템플릿 가져오기 서버 오류가 발생했습니다.', error: error.message });
  }
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Template gallery server listening on port ${PORT}`);
});
