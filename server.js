import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distPath = path.join(__dirname, 'dist');
const templatesPath = path.join(__dirname, 'templates');

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

function buildS3BaseUrl({ bucket, region }) {
  const normalizedRegion = region && region !== 'us-east-1' ? `.${region}` : '';
  return `https://${bucket}.s3${normalizedRegion}.amazonaws.com`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function encodePath(key) {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

let cachedAwsCredentials = null;

function isCredentialExpired(credential) {
  if (!credential?.expiration) return false;
  const expiration = new Date(credential.expiration).getTime();
  // Refresh 2 minutes before actual expiration to be safe.
  return Date.now() > expiration - 2 * 60 * 1000;
}

async function fetchWebIdentityCredentials() {
  const tokenFile = process.env.AWS_WEB_IDENTITY_TOKEN_FILE;
  const roleArn = process.env.AWS_ROLE_ARN;
  if (!tokenFile || !roleArn) return null;

  const token = await fs.readFile(tokenFile, 'utf-8');
  const form = new URLSearchParams({
    Action: 'AssumeRoleWithWebIdentity',
    RoleArn: roleArn,
    RoleSessionName: `n8n-template-gallery-${Date.now()}`,
    Version: '2011-06-15',
    WebIdentityToken: token,
  });

  const response = await fetch('https://sts.amazonaws.com/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`웹 아이덴티티 토큰으로 STS 자격 증명을 가져오지 못했습니다: ${text}`);
  }

  const xml = await response.text();
  const accessKey = xml.match(/<AccessKeyId>([^<]+)<\/AccessKeyId>/)?.[1];
  const secretKey = xml.match(/<SecretAccessKey>([^<]+)<\/SecretAccessKey>/)?.[1];
  const sessionToken = xml.match(/<SessionToken>([^<]+)<\/SessionToken>/)?.[1];
  const expiration = xml.match(/<Expiration>([^<]+)<\/Expiration>/)?.[1];

  if (!accessKey || !secretKey || !sessionToken) {
    throw new Error('STS 응답에서 자격 증명을 파싱하지 못했습니다.');
  }

  return { accessKey, secretKey, token: sessionToken, expiration };
}

async function getAwsCredentials() {
  if (cachedAwsCredentials && !isCredentialExpired(cachedAwsCredentials)) {
    return cachedAwsCredentials;
  }

  const envAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const envSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const envToken = process.env.AWS_SESSION_TOKEN;

  if (envAccessKey && envSecretKey) {
    cachedAwsCredentials = { accessKey: envAccessKey, secretKey: envSecretKey, token: envToken };
    return cachedAwsCredentials;
  }

  const webIdentity = await fetchWebIdentityCredentials();
  if (webIdentity) {
    cachedAwsCredentials = webIdentity;
    return cachedAwsCredentials;
  }

  throw new Error('사용 가능한 AWS 자격 증명을 찾을 수 없습니다.');
}

async function signS3Request({ method, url, region, headers = {}, body = '' }) {
  const { accessKey, secretKey, token } = await getAwsCredentials();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}Z$/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const parsed = new URL(url);
  const sortedParams = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalQueryString = sortedParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const payloadHash = sha256Hex(body);
  const mergedHeaders = {
    host: parsed.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(token ? { 'x-amz-security-token': token } : {}),
    ...headers,
  };

  const canonicalHeadersEntries = Object.entries(mergedHeaders).map(([key, value]) => [
    key.toLowerCase(),
    typeof value === 'string' ? value.trim() : String(value).trim(),
  ]);

  const sortedHeaders = canonicalHeadersEntries.sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaders.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = sortedHeaders.map(([k]) => k).join(';');

  const canonicalRequest = [
    method,
    parsed.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = getSignatureKey(secretKey, dateStamp, region, 's3');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      ...Object.fromEntries(sortedHeaders),
      Authorization: authorizationHeader,
      'x-amz-content-sha256': payloadHash,
    },
  };
}

async function fetchFromS3({ method, bucket, region, key, queryParams = {}, headers = {}, body = '' }) {
  const baseUrl = buildS3BaseUrl({ bucket, region });
  const normalizedKey = key ? key.replace(/^\//, '') : '';
  const url = new URL(`${baseUrl}/${encodePath(normalizedKey)}`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const signed = await signS3Request({ method, url: url.toString(), region, headers, body });
  const response = await fetch(url.toString(), { method, headers: signed.headers, body });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 요청 실패 (${response.status}): ${text}`);
  }
  return response;
}

async function listTemplateKeysFromS3({ bucket, keyPrefix, region }) {
  const response = await fetchFromS3({
    method: 'GET',
    bucket,
    region,
    key: '',
    queryParams: { 'list-type': '2', prefix: keyPrefix },
  });

  const xml = await response.text();
  const matches = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((match) => match[1]);
  return matches.filter((key) => key.endsWith('.json'));
}

async function loadTemplateFromS3(key, { bucket, region }) {
  const response = await fetchFromS3({ method: 'GET', bucket, region, key });
  const text = await response.text();
  return JSON.parse(text);
}

async function uploadTemplateToS3(key, body, { bucket, region }) {
  await fetchFromS3({
    method: 'PUT',
    bucket,
    region,
    key,
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function getTemplateStorageConfig() {
  const basePath = process.env.N8N_TEMPLATE_S3_PATH;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
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
