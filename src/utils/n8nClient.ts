import { WorkflowTemplate } from '../data/templates';

type AuthMode = 'pat' | 'basic' | 'cookie';

type ImportArgs = {
  host: string;
  authMode: AuthMode;
  token?: string;
  username?: string;
  password?: string;
  workflowName: string;
  template: WorkflowTemplate;
};

function normalizeHost(host: string) {
  return host.endsWith('/') ? host.slice(0, -1) : host;
}

function buildHeaders(auth: Pick<ImportArgs, 'authMode' | 'token' | 'username' | 'password'>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.authMode === 'pat') {
    if (!auth.token) throw new Error('Personal Access Token이 필요합니다.');
    headers.Authorization = `Bearer ${auth.token}`;
  }

  if (auth.authMode === 'basic') {
    if (!auth.username || !auth.password) throw new Error('Basic Auth 사용자명과 비밀번호를 입력하세요.');
    const encoded = btoa(`${auth.username}:${auth.password}`);
    headers.Authorization = `Basic ${encoded}`;
  }

  // cookie 모드: Authorization 헤더 없이, 브라우저 세션 쿠키로 인증
  return headers;
}

export async function importWorkflow({ host, authMode, token, username, password, workflowName, template }: ImportArgs) {
  const url = `${normalizeHost(host)}/rest/workflows`;
  const headers = buildHeaders({ authMode, token, username, password });
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: workflowName,
      active: false,
      nodes: template.nodes,
      connections: template.connections,
      tags: template.tags,
    }),
    credentials: authMode === 'cookie' ? 'include' : 'same-origin',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to import workflow: ${message}`);
  }

  const result = await response.json();
  return result.id as string;
}
