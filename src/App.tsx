import { useMemo, useState } from 'react';
import { TemplateCard } from './components/TemplateCard';
import { TemplateModal } from './components/TemplateModal';
import { templates, WorkflowTemplate } from './data/templates';
import { importWorkflow } from './utils/n8nClient';

const FALLBACK_HOST = 'https://your-n8n-domain.com';

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
  const [host, setHost] = useState(FALLBACK_HOST);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

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
    if (!host || !token) {
      setStatus('호스트 URL과 Personal Access Token을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setStatus('템플릿을 가져오는 중...');
    try {
      const workflowName = formatWorkflowName(template);
      const workflowId = await importWorkflow({
        host,
        token,
        template,
        workflowName,
      });
      setStatus(`가져오기 완료! 워크플로우 ID: ${workflowId}`);
    } catch (error) {
      console.error(error);
      setStatus('가져오기에 실패했습니다. CORS 또는 토큰을 확인하세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (template: WorkflowTemplate) => {
    copyToClipboard(JSON.stringify({ name: template.name, nodes: template.nodes, connections: template.connections }, null, 2));
    setStatus('JSON이 클립보드에 복사되었습니다.');
  };

  const heroQuickImport = () => {
    if (!filteredTemplates.length) {
      setStatus('가져올 템플릿이 없습니다.');
      return;
    }
    handleImport(filteredTemplates[0]);
  };

  return (
    <div className="page">
      <div className="gradient" aria-hidden="true" />
      <header className="hero">
        <div>
          <p className="eyebrow">n8n Template Gallery · 테스트용</p>
          <h1>
            오너 템플릿을 <span className="accent">모두</span> 모아보고
            <br />
            원클릭으로 내 워크플로우에 추가하세요
          </h1>
          <p className="muted">
            검색 · 태그 필터 · JSON 복사 · 내 n8n으로 바로 가져오기까지. 최신 UI 트렌드를 반영한 깔끔한
            대시보드로 템플릿을 살펴보세요.
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
          <p className="eyebrow">내 n8n에 연결</p>
          <label className="label" htmlFor="host">
            n8n 호스트 URL
          </label>
          <input
            id="host"
            type="text"
            placeholder="https://your-n8n-domain.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <label className="label" htmlFor="token">
            Personal Access Token (PAT)
          </label>
          <input
            id="token"
            type="password"
            placeholder="발급받은 PAT"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="muted small">브라우저에서 직접 호출합니다. 토큰은 저장되지 않습니다.</p>
          <button className="primary wide" disabled={!host || !token || isLoading} onClick={heroQuickImport}>
            {isLoading ? '가져오는 중...' : '첫 템플릿 가져오기' }
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
