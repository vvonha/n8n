import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distPath = path.join(__dirname, 'dist');
const templatesPath = path.join(__dirname, 'templates');

const execFileAsync = promisify(execFile);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(distPath));

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

async function runAwsCommand(args, { input } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('aws', args, {
      input,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' };
  } catch (error) {
    const stderr = error?.stderr?.toString() || '';
    const stdout = error?.stdout?.toString() || '';
    throw new Error(`AWS CLI 실행 실패: ${stderr || stdout || error.message}`);
  }
}

async function listTemplateKeysFromS3({ bucket, keyPrefix, region }) {
  const args = ['s3api', 'list-objects-v2', '--bucket', bucket, '--output', 'json'];
  if (keyPrefix) args.push('--prefix', keyPrefix);
  if (region) args.push('--region', region);

  const { stdout } = await runAwsCommand(args);
  let parsed;
  try {
    parsed = JSON.parse(stdout || '{}');
  } catch (error) {
    throw new Error(`S3 목록 응답을 JSON으로 파싱하지 못했습니다: ${error.message}`);
  }

  const contents = Array.isArray(parsed?.Contents) ? parsed.Contents : [];
  return contents.map((item) => item.Key).filter((key) => key && key.endsWith('.json'));
}

async function loadTemplateFromS3(key, { bucket, region }) {
  const args = ['s3', 'cp', `s3://${bucket}/${key}`, '-'];
  if (region) args.push('--region', region);
  const { stdout } = await runAwsCommand(args);
  return JSON.parse(stdout || '{}');
}

async function uploadTemplateToS3(key, body, { bucket, region }) {
  const args = ['s3', 'cp', '-', `s3://${bucket}/${key}`, '--content-type', 'application/json'];
  if (region) args.push('--region', region);
  await runAwsCommand(args, { input: body });
}

function getTemplateStorageConfig() {
  const basePath = process.env.N8N_TEMPLATE_S3_PATH;
  const region =
    process.env.N8N_S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || undefined;
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

app.get('/api/templates', async (_req, res) => {
  const storage = getTemplateStorageConfig();
  if (!storage) {
    return res.status(500).json({ message: 'N8N_TEMPLATE_S3_PATH 환경변수를 설정해주세요.' });
  }

  try {
    const keys = await listTemplateKeysFromS3(storage);
    const templates = await Promise.all(
      keys.map(async (key) => {
        const template = await loadTemplateFromS3(key, storage);
        if (!template.id) {
          const filename = path.basename(key, '.json');
          template.id = filename;
        }
        return template;
      }),
    );

    res.json({ templates });
  } catch (error) {
    console.error('[template-list]', error);
    res.status(500).json({ message: '템플릿을 불러오지 못했습니다. 서버 로그를 확인하세요.', error: error.message });
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
