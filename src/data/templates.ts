export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  heroColor: string;
  preview?: string;
  diagramImage?: string;
  diagramCaption?: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  credentials?: string[];
  estimatedSetupMinutes?: number;
};

// Templates are now sourced from S3 at runtime via the template API.
// This empty array remains to preserve type exports for the UI.
export const templates: WorkflowTemplate[] = [];
