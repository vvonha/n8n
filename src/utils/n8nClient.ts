import { WorkflowTemplate } from '../data/templates';

type ImportArgs = {
  template: WorkflowTemplate;
  workflowName: string;
};

export async function importWorkflow({ template, workflowName }: ImportArgs) {
  const response = await fetch('/api/import-workflow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: workflowName,
      workflow: {
        name: workflowName,
        nodes: template.nodes,
        connections: template.connections,
        tags: template.tags,
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
