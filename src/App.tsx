import { useEffect, useMemo, useState } from 'react';
import { TemplateCard } from './components/TemplateCard';
import { TemplateModal } from './components/TemplateModal';
import { TemplateUploadModal } from './components/TemplateUploadModal';
import { templates as fallbackTemplates, WorkflowTemplate } from './data/templates';
import { importWorkflow } from './utils/n8nClient';
import { fetchTemplatesFromApi, uploadTemplateToApi } from './utils/templatesClient';

function copyToClipboard(content: string) {
  if (!navigator.clipboard) {
    alert('브라우저가 클립보드를 지원하지 않습니다. JSON을 직접 복사하세요.');
    return;
  }
  navigator.clipboard.writeText(content);
}

function formatWorkflowName(template: WorkflowTemplate) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${template.name} - imported ${stamp}`;
}

function App() {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [status, setStatus] = useState<string>('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(fallbackTemplates);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [apiBase, setApiBase] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('n8nApiBase') || '';
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('n8nApiKey') || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    async function load() {
      try {
        const remote = await fetchTemplatesFromApi();
        if (remote.length > 0) {
          setTemplates(remote);
        } else {
          setTemplates([]);
        }
      } catch (error) {
        console.error(error);
        setStatus('S3 템플릿을 불러오지 못했습니다. 로컬 템플릿을 표시합니다.');
      } finally {
        setIsLoadingTemplates(false);
      }
    }

    load();
  }, []);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesQuery =
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase());
      const matchesTag = selectedTag ? template.tags.includes(selectedTag) : true;
      return matchesQuery && matchesTag;
    });
  }, [query, selectedTag, templates]);

  const selectedTemplates = useMemo(
    () => templates.filter((template) => selectedTemplateIds.has(template.id)),
    [selectedTemplateIds, templates],
  );

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleImport = async (template: WorkflowTemplate) => {
    if (!apiBase) {
      setStatus('n8n API 주소를 입력해주세요. 예: https://n8n.ldccai.com/api/v1');
      return;
    }

    if (!apiKey) {
      setStatus('먼저 내 n8n 계정에서 발급한 API 키를 입력해주세요. (Settings → API)');
      return;
    }

    localStorage.setItem('n8nApiBase', apiBase);
    localStorage.setItem('n8nApiKey', apiKey);
    setIsLoading(true);
    setStatus('템플릿을 가져오는 중... (서버가 내 키로 n8n API 호출)');
    try {
      const workflowName = formatWorkflowName(template);
      const workflowId = await importWorkflow({ template, workflowName, apiKey, apiBase });
      setStatus(
        workflowId
          ? `가져오기 완료! 워크플로우 ID: ${workflowId}`
          : '가져오기 완료! 워크플로우가 생성되었습니다.',
      );
    } catch (error) {
      console.error(error);
      setStatus('가져오기에 실패했습니다. 내 API 키가 맞는지 또는 서버 로그를 확인하세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (template: WorkflowTemplate) => {
    copyToClipboard(JSON.stringify({ name: template.name, nodes: template.nodes, connections: template.connections }, null, 2));
    setStatus('JSON이 클립보드에 복사되었습니다.');
  };

  const handleTemplateUpload = async (template: WorkflowTemplate) => {
    setIsSavingTemplate(true);
    try {
      const saved = await uploadTemplateToApi(template);
      setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      setStatus('S3에 템플릿이 업로드되었습니다.');
      setIsUploadOpen(false);
    } catch (error) {
      console.error(error);
      setStatus('템플릿 업로드에 실패했습니다. 서버 로그를 확인하세요.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const importSelectedTemplates = async () => {
    if (selectedTemplates.length === 0) {
      setStatus('가져올 템플릿을 선택해주세요.');
      return;
    }

    if (!apiBase) {
      setStatus('n8n API 주소를 입력해주세요. 예: https://n8n.ldccai.com/api/v1');
      return;
    }

    if (!apiKey) {
      setStatus('먼저 내 n8n 계정에서 발급한 API 키를 입력해주세요. (Settings → API)');
      return;
    }

    localStorage.setItem('n8nApiBase', apiBase);
    localStorage.setItem('n8nApiKey', apiKey);

    setIsLoading(true);
    setStatus('선택한 템플릿을 가져오는 중...');

    const results: string[] = [];

    try {
      for (const template of selectedTemplates) {
        try {
          const workflowName = formatWorkflowName(template);
          const workflowId = await importWorkflow({ template, workflowName, apiKey, apiBase });
          results.push(`${template.name}: ${workflowId ? `ID ${workflowId}` : '완료'}`);
        } catch (error) {
          console.error(error);
          results.push(`${template.name}: 실패`);
        }
      }

      setStatus(`가져오기 완료 (${selectedTemplates.length}개). ${results.join(' | ')}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="gradient" aria-hidden="true" />
      <header className="hero">
        <div>
          <p className="eyebrow">LOTTE AI n8n Template Gallery</p>
          <h1>
            n8n 템플릿을 <span className="accent">모두</span> 모아보고
            <br />
            원클릭으로 내 워크플로우에 추가하세요
          </h1>
          <p className="muted">
            검색 · 태그 필터 · JSON 복사 · 내 n8n으로 바로 가져오기까지.
          </p>
          <div className="action-row">
            <div className="input-row grow">
              <input
                type="text"
                placeholder="템플릿 검색 (예: 슬랙, CRM, 공지)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="ghost" onClick={() => setIsUploadOpen(true)}>
              + 템플릿 업로드
            </button>
          </div>
          <div className="tags">
            <button className={!selectedTag ? 'chip active' : 'chip'} onClick={() => setSelectedTag(null)}>
              전체
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                className={selectedTag === tag ? 'chip active' : 'chip'}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <p className="eyebrow">연결 정보 입력</p>
          <p className="muted">
            n8n URL과 자신의 n8n 계정에서 발급한 Personal API Key를 아래에 입력합니다.
          </p>

          <div className="input-row">
            <input
              type="text"
              placeholder="n8n 주소 (예: https://n8n.ldccai.com)"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
            />
          </div>

          <div className="input-row">
            <input
              type="password"
              placeholder="n8n Personal API Key (Settings → n8n API)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <p className="muted small">선택된 템플릿: {selectedTemplateIds.size}개</p>

          <button
            className="primary wide"
            disabled={isLoading || selectedTemplateIds.size === 0}
            onClick={importSelectedTemplates}
          >
            {isLoading ? '가져오는 중...' : '선택한 템플릿 가져오기' }
          </button>

          {status && <p className="status">{status}</p>}
        </div>
      </header>

      <main>
        <div className="grid">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={setSelectedTemplate}
              onCopyJson={handleCopy}
              onImport={handleImport}
              onToggleSelect={toggleTemplateSelection}
              isSelected={selectedTemplateIds.has(template.id)}
            />
          ))}
          {filteredTemplates.length === 0 && !isLoadingTemplates && (
            <p className="muted">조건에 맞는 템플릿이 없습니다.</p>
          )}
          {isLoadingTemplates && <p className="muted">S3에서 템플릿을 불러오는 중...</p>}
        </div>
      </main>

      <TemplateModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onCopyJson={handleCopy}
        onImport={handleImport}
      />
      <TemplateUploadModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSubmit={handleTemplateUpload}
        isSaving={isSavingTemplate}
        existingIds={new Set(templates.map((t) => t.id))}
      />
    </div>
  );
}

export default App;
