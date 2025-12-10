import { WorkflowTemplate } from '../data/templates';

export async function fetchTemplatesFromApi(): Promise<WorkflowTemplate[]> {
  const response = await fetch('/api/templates');
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '템플릿 목록을 불러오지 못했습니다.');
  }

  const data = (await response.json()) as { templates: WorkflowTemplate[] };
  return data.templates || [];
}

export async function fetchTemplateDetailFromApi(templateId: string): Promise<WorkflowTemplate> {
  const response = await fetch(`/api/templates/${templateId}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '템플릿 상세를 불러오지 못했습니다.');
  }

  const data = (await response.json()) as { template: WorkflowTemplate };
  return data.template;
}

export async function uploadTemplateToApi(template: WorkflowTemplate) {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '템플릿 업로드에 실패했습니다.');
  }

  const data = await response.json();
  return data.template as WorkflowTemplate;
}
