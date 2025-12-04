import { WorkflowTemplate } from '../data/templates';

type ImportArgs = {
  template: WorkflowTemplate;
  workflowName: string;
  apiKey?: string;
  apiBase?: string;
};

export async function importWorkflow({ template, workflowName, apiKey, apiBase }: ImportArgs) {
  const response = await fetch('/api/import-workflow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
    },
    body: JSON.stringify({
      apiKey,
      apiBase,
      name: workflowName,
      workflow: {
        name: workflowName,
        nodes: template.nodes,
        connections: template.connections,
        tags: template.tags,
        settings: template.settings ?? {},
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`템플릿 가져오기에 실패했습니다: ${message}`);
  }

  const result = await response.json();
  return result.id as string | undefined;
}
