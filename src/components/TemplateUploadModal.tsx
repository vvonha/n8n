import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { WorkflowTemplate } from '../data/templates';
import { slugify } from '../utils/slugify';

const gradients = [
  'linear-gradient(135deg, #7c3aed, #14b8a6)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #f97316, #f43f5e)',
  'linear-gradient(135deg, #22d3ee, #6366f1)',
  'linear-gradient(135deg, #34d399, #10b981)',
];

type TemplateUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (template: WorkflowTemplate) => Promise<void>;
  isSaving: boolean;
  existingIds: Set<string>;
};

type FormState = {
  name: string;
  description: string;
  difficulty: WorkflowTemplate['difficulty'];
  estimatedSetupMinutes: number;
  credentials: string;
  tags: string;
  diagramCaption: string;
  heroColor: string;
  json: string;
  diagramPreview?: string;
};

const initialState: FormState = {
  name: '',
  description: '',
  difficulty: 'Beginner',
  estimatedSetupMinutes: 5,
  credentials: '',
  tags: '',
  diagramCaption: '',
  heroColor: gradients[0],
  json: '',
};

export function TemplateUploadModal({ open, onClose, onSubmit, isSaving, existingIds }: TemplateUploadModalProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setForm(initialState);
      setError('');
    }
  }, [open]);

  const parsedTags = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  );

  const parsedCredentials = useMemo(
    () =>
      form.credentials
        .split(',')
        .map((cred) => cred.trim())
        .filter(Boolean),
    [form.credentials],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, diagramPreview: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (key: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseWorkflowJson = () => {
    try {
      const parsed = JSON.parse(form.json || '{}');
      if (!parsed.nodes || !parsed.connections) {
        throw new Error('nodes 또는 connections가 JSON에 없습니다.');
      }
      return parsed;
    } catch (err) {
      throw new Error('JSON이 올바른지 확인하세요. ' + (err as Error).message);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim() || !form.description.trim()) {
      setError('제목과 설명을 입력해주세요.');
      return;
    }

    let workflowJson;
    try {
      workflowJson = parseWorkflowJson();
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    const baseId = slugify(form.name);
    const uniqueId = existingIds.has(baseId) ? `${baseId}-${Date.now()}` : baseId;

    const template: WorkflowTemplate = {
      id: uniqueId,
      name: form.name.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
      heroColor: form.heroColor,
      preview: workflowJson.preview,
      diagramImage: form.diagramPreview,
      diagramCaption: form.diagramCaption || undefined,
      nodes: workflowJson.nodes,
      connections: workflowJson.connections,
      settings: workflowJson.settings || {},
      credentials: parsedCredentials,
      estimatedSetupMinutes: Number(form.estimatedSetupMinutes) || undefined,
      tags: parsedTags,
    };

    await onSubmit(template);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal wide">
        <header className="modal__header">
          <div>
            <p className="eyebrow">템플릿 업로드</p>
            <h3>새 템플릿 추가</h3>
          </div>
          <button className="ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="modal__content upload-grid">
          <div className="field">
            <p className="label">제목</p>
            <input
              type="text"
              placeholder="예: 마케팅 알림 자동화"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="field">
            <p className="label">설명</p>
            <textarea
              rows={3}
              placeholder="템플릿에 대한 짧은 설명을 입력하세요"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          <div className="field inline">
            <div>
              <p className="label">난이도</p>
              <select value={form.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)}>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div>
              <p className="label">예상 셋업 (분)</p>
              <input
                type="number"
                min={1}
                value={form.estimatedSetupMinutes}
                onChange={(e) => handleChange('estimatedSetupMinutes', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="field">
            <p className="label">필요 자격증명 (콤마로 구분)</p>
            <input
              type="text"
              placeholder="Slack API, Notion, ..."
              value={form.credentials}
              onChange={(e) => handleChange('credentials', e.target.value)}
            />
          </div>

          <div className="field">
            <p className="label">태그 (콤마로 구분)</p>
            <input
              type="text"
              placeholder="공지, 마케팅, CRM"
              value={form.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
            />
          </div>

          <div className="field inline">
            <div>
              <p className="label">구성도 이미지</p>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              {form.diagramPreview && <img className="diagram-preview" src={form.diagramPreview} alt="미리보기" />}
            </div>
            <div>
              <p className="label">구성도 설명</p>
              <input
                type="text"
                placeholder="다이어그램 하단 캡션"
                value={form.diagramCaption}
                onChange={(e) => handleChange('diagramCaption', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <p className="label">배경 그라데이션</p>
            <div className="gradient-options">
              {gradients.map((gradient) => (
                <button
                  key={gradient}
                  type="button"
                  className={form.heroColor === gradient ? 'gradient-chip active' : 'gradient-chip'}
                  style={{ background: gradient }}
                  onClick={() => handleChange('heroColor', gradient)}
                  aria-label={`배경 ${gradient}`}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <p className="label">워크플로우 JSON</p>
            <textarea
              rows={8}
              placeholder='{"nodes": [...], "connections": {...}}'
              value={form.json}
              onChange={(e) => handleChange('json', e.target.value)}
            />
          </div>

          {error && <p className="status error">{error}</p>}
        </div>

        <footer className="modal__footer">
          <div className="muted small">
            태그, 자격증명, 구성도 이미지가 모두 JSON과 함께 저장되어 S3에 배포됩니다.
          </div>
          <div className="template-card__actions">
            <button className="ghost" onClick={onClose} disabled={isSaving}>
              취소
            </button>
            <button className="primary" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '업로드 중...' : 'S3로 업로드'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
