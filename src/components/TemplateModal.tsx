import { WorkflowTemplate } from '../data/templates';

type TemplateModalProps = {
  template: WorkflowTemplate | null;
  onClose: () => void;
  onCopyJson: (template: WorkflowTemplate) => void;
  onImport: (template: WorkflowTemplate) => void;
};

export function TemplateModal({ template, onClose, onCopyJson, onImport }: TemplateModalProps) {
  if (!template) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal__header">
          <div>
            <p className="eyebrow">템플릿 미리보기</p>
            <h3>{template.name}</h3>
          </div>
          <button className="ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="modal__content">
          <p className="muted">{template.description}</p>
          <div className="meta-grid">
            <div>
              <p className="label">난이도</p>
              <p>{template.difficulty}</p>
            </div>
            <div>
              <p className="label">예상 셋업</p>
              <p>{template.estimatedSetupMinutes ?? 5}분</p>
            </div>
            <div>
              <p className="label">필요 자격증명</p>
              <p>{template.credentials?.join(', ') ?? '없음'}</p>
            </div>
          </div>
          {template.diagramImage && (
            <div className="diagram">
              <img src={template.diagramImage} alt={`${template.name} n8n 구성도`} />
              {template.diagramCaption && <p className="muted small center">{template.diagramCaption}</p>}
            </div>
          )}
          <div className="code-block" aria-label="JSON preview">
            <pre>{JSON.stringify({ nodes: template.nodes, connections: template.connections }, null, 2)}</pre>
          </div>
        </div>

        <footer className="modal__footer">
          <div className="template-card__tags">
            {template.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <div className="template-card__actions">
            <button className="ghost" onClick={() => onCopyJson(template)}>
              JSON 복사
            </button>
            <button className="primary" onClick={() => onImport(template)}>
              내 워크플로우로 가져오기
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
