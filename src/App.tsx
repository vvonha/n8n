import { useMemo, useState } from 'react';
import { TemplateCard } from './components/TemplateCard';
import { TemplateModal } from './components/TemplateModal';
import { templates, WorkflowTemplate } from './data/templates';
import { importWorkflow } from './utils/n8nClient';

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
  const [apiBase, setApiBase] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('n8nApiBase') || '';
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('n8nApiKey') || '';
  });
  // const [isLoading, setIsLoading] = useState(false);
  const setIsLoading = useState(false);
  
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesQuery =
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase());
      const matchesTag = selectedTag ? template.tags.includes(selectedTag) : true;
      return matchesQuery && matchesTag;
    });
  }, [query, selectedTag]);

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

  // const heroQuickImport = () => {
  //   if (!filteredTemplates.length) {
  //     setStatus('가져올 템플릿이 없습니다.');
  //     return;
  //   }
  //   handleImport(filteredTemplates[0]);
  // };

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
          <div className="input-row">
            <input
              type="text"
              placeholder="템플릿 검색 (예: 슬랙, CRM, 공지)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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

          {/* <button
            className="primary wide"
            disabled={isLoading || filteredTemplates.length === 0}
            onClick={heroQuickImport}
          >
            {isLoading ? '가져오는 중...' : '첫 템플릿 가져오기' }
          </button> */}
          
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
            />
          ))}
          {filteredTemplates.length === 0 && <p className="muted">조건에 맞는 템플릿이 없습니다.</p>}
        </div>
      </main>

      <TemplateModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onCopyJson={handleCopy}
        onImport={handleImport}
      />
    </div>
  );
}

export default App;
