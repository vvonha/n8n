import { WorkflowTemplate } from '../data/templates';

type ImportArgs = {
  host: string;
  token: string;
  workflowName: string;
  template: WorkflowTemplate;
};

function normalizeHost(host: string) {
  return host.endsWith('/') ? host.slice(0, -1) : host;
}

export async function importWorkflow({ host, token, workflowName, template }: ImportArgs) {
  const url = `${normalizeHost(host)}/rest/workflows`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: workflowName,
      active: false,
      nodes: template.nodes,
      connections: template.connections,
      tags: template.tags,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to import workflow: ${message}`);
  }

  const result = await response.json();
  return result.id as string;
}
