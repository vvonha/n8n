import { WorkflowTemplate } from '../data/templates';

type TemplateCardProps = {
  template: WorkflowTemplate;
  onSelect: (template: WorkflowTemplate) => void;
  onCopyJson: (template: WorkflowTemplate) => void;
  onImport: (template: WorkflowTemplate) => void;
  onToggleSelect: (templateId: string) => void;
  isSelected: boolean;
};

export function TemplateCard({
  template,
  onSelect,
  onCopyJson,
  onImport,
  onToggleSelect,
  isSelected,
}: TemplateCardProps) {
  return (
    <article className="template-card" style={{ backgroundImage: template.heroColor }}>
      <label className="template-card__select">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(template.id)}
          aria-label={`${template.name} 선택`}
        />
      </label>
      <div className="template-card__body">
        <div className="template-card__pill">{template.difficulty}</div>
        <h3>{template.name}</h3>
        <p>{template.description}</p>
        <div className="template-card__tags">
          {template.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="template-card__actions">
          <button className="ghost" onClick={() => onSelect(template)}>
            미리보기
          </button>
          <button className="ghost" onClick={() => onCopyJson(template)}>
            JSON 복사
          </button>
          <button className="primary" onClick={() => onImport(template)}>
            내 워크플로우로 가져오기
          </button>
        </div>
      </div>
    </article>
  );
}
