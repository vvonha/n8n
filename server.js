import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distPath = path.join(__dirname, 'dist');
const templatesPath = path.join(__dirname, 'templates');

app.use(express.json({ limit: '2mb' }));
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
    tags: resolved.tags || [],
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
