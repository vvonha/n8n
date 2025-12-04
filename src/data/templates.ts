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

const toDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const diagramEventAnnounce = toDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 520">
    <defs>
      <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color="%237c3aed" offset="0%"/>
        <stop stop-color="%2314b8a6" offset="100%"/>
      </linearGradient>
      <style>
        text { font-family: 'Inter', system-ui, -apple-system, sans-serif; fill: #0f172a; font-weight: 600; }
        .label { font-size: 14px; fill: #475569; font-weight: 500; }
        .box { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1.5; rx: 14; }
      </style>
    </defs>
    <rect width="960" height="520" fill="url(%23bg1)" opacity="0.12"/>
    <rect x="60" y="70" width="840" height="380" fill="#ffffff" stroke="#e2e8f0" rx="24" opacity="0.88"/>
    <rect x="100" y="220" width="180" height="80" class="box"/>
    <text x="140" y="265">Webhook</text>
    <text x="140" y="285" class="label">POST /release-announcement</text>
    <rect x="360" y="130" width="180" height="80" class="box"/>
    <text x="390" y="175">Slack</text>
    <text x="390" y="195" class="label">#launch-updates</text>
    <rect x="360" y="220" width="180" height="80" class="box"/>
    <text x="395" y="265">Email</text>
    <text x="395" y="285" class="label">SMTP</text>
    <rect x="360" y="310" width="180" height="80" class="box"/>
    <text x="390" y="355">Notion</text>
    <text x="390" y="375" class="label">페이지 업데이트</text>
    <rect x="620" y="220" width="180" height="80" class="box"/>
    <text x="650" y="265">X/Twitter</text>
    <text x="650" y="285" class="label">옵션</text>
    <path d="M280 260 H360" stroke="#0ea5e9" stroke-width="3" marker-end="url(%23arrow)" opacity="0.9"/>
    <path d="M540 170 H620" stroke="#0ea5e9" stroke-width="3" marker-end="url(%23arrow)" opacity="0.9"/>
    <path d="M540 260 H620" stroke="#0ea5e9" stroke-width="3" marker-end="url(%23arrow)" opacity="0.9"/>
    <path d="M540 350 H620" stroke="#0ea5e9" stroke-width="3" marker-end="url(%23arrow)" opacity="0.9"/>
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#0ea5e9" />
      </marker>
    </defs>
  </svg>
`);

const diagramLeadEnrich = toDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 520">
    <defs>
      <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color="%230ea5e9" offset="0%"/>
        <stop stop-color="%236366f1" offset="100%"/>
      </linearGradient>
      <style>
        text { font-family: 'Inter', system-ui, -apple-system, sans-serif; fill: #0b1224; font-weight: 600; }
        .label { font-size: 14px; fill: #475569; font-weight: 500; }
        .box { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1.5; rx: 14; }
      </style>
    </defs>
    <rect width="960" height="520" fill="url(%23bg2)" opacity="0.12"/>
    <rect x="60" y="70" width="840" height="380" fill="#ffffff" stroke="#e2e8f0" rx="24" opacity="0.9"/>
    <rect x="120" y="220" width="200" height="90" class="box"/>
    <text x="160" y="265">Webhook</text>
    <text x="160" y="285" class="label">POST /lead-enrich</text>
    <rect x="380" y="150" width="200" height="90" class="box"/>
    <text x="415" y="195">Clearbit Enrich</text>
    <text x="415" y="215" class="label">HTTP Request</text>
    <rect x="380" y="290" width="200" height="90" class="box"/>
    <text x="420" y="335">HubSpot Upsert</text>
    <text x="420" y="355" class="label">CRM</text>
    <rect x="640" y="150" width="200" height="90" class="box"/>
    <text x="690" y="195">VIP Scoring</text>
    <text x="690" y="215" class="label">IF 노드</text>
    <rect x="640" y="290" width="200" height="90" class="box"/>
    <text x="685" y="335">Slack 알림</text>
    <text x="685" y="355" class="label">#vip-leads</text>
    <path d="M320 265 H380" stroke="#6366f1" stroke-width="3" marker-end="url(%23arrow2)"/>
    <path d="M580 195 H640" stroke="#6366f1" stroke-width="3" marker-end="url(%23arrow2)"/>
    <path d="M580 335 C620 335 620 195 640 195" stroke="#22c55e" stroke-width="3" fill="none" marker-end="url(%23arrow2)" opacity="0.85"/>
    <path d="M580 335 H640" stroke="#6366f1" stroke-width="3" marker-end="url(%23arrow2)"/>
    <defs>
      <marker id="arrow2" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#6366f1" />
      </marker>
    </defs>
  </svg>
`);

const diagramDailyDigest = toDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 520">
    <defs>
      <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color="%23f97316" offset="0%"/>
        <stop stop-color="%23f43f5e" offset="100%"/>
      </linearGradient>
      <style>
        text { font-family: 'Inter', system-ui, -apple-system, sans-serif; fill: #0f172a; font-weight: 600; }
        .label { font-size: 14px; fill: #475569; font-weight: 500; }
        .box { fill: #fff7ed; stroke: #fecdd3; stroke-width: 1.5; rx: 14; }
      </style>
    </defs>
    <rect width="960" height="520" fill="url(%23bg3)" opacity="0.12"/>
    <rect x="60" y="70" width="840" height="380" fill="#ffffff" stroke="#ffe4e6" rx="24" opacity="0.9"/>
    <rect x="120" y="250" width="180" height="80" class="box"/>
    <text x="150" y="295">Daily Cron</text>
    <text x="150" y="315" class="label">매일 07:00</text>
    <rect x="360" y="180" width="200" height="80" class="box"/>
    <text x="395" y="225">Notion DB</text>
    <text x="395" y="245" class="label">오늘의 태스크</text>
    <rect x="360" y="270" width="200" height="80" class="box"/>
    <text x="405" y="315">Github Issues</text>
    <text x="405" y="335" class="label">오픈 PR</text>
    <rect x="620" y="210" width="200" height="80" class="box"/>
    <text x="665" y="255">Slack</text>
    <text x="665" y="275" class="label">#daily</text>
    <rect x="620" y="310" width="200" height="80" class="box"/>
    <text x="660" y="355">Email</text>
    <text x="660" y="375" class="label">digest@example.com</text>
    <path d="M300 290 H360" stroke="#f97316" stroke-width="3" marker-end="url(%23arrow3)"/>
    <path d="M560 220 H620" stroke="#f97316" stroke-width="3" marker-end="url(%23arrow3)"/>
    <path d="M560 310 H620" stroke="#f97316" stroke-width="3" marker-end="url(%23arrow3)"/>
    <path d="M560 350 C590 350 590 250 620 250" stroke="#10b981" stroke-width="3" fill="none" marker-end="url(%23arrow3)" opacity="0.8"/>
    <defs>
      <marker id="arrow3" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#f97316" />
      </marker>
    </defs>
  </svg>
`);

export const templates: WorkflowTemplate[] = [
  {
    id: 'event-announce',
    name: '이벤트/릴리스 공지 자동화',
    description:
      '신규 릴리스나 이벤트가 있을 때 이메일·슬랙·노션·트위터(X)까지 한번에 발송하는 파이프라인.',
    tags: ['공지', '마케팅', '옴니채널'],
    difficulty: 'Intermediate',
    heroColor: 'linear-gradient(135deg, #7c3aed, #14b8a6)',
    diagramImage: diagramEventAnnounce,
    diagramCaption: 'Webhook → Slack/Email/Notion/X로 분기되는 n8n 플로우',
    credentials: ['Slack API', 'SMTP', 'Notion'],
    estimatedSetupMinutes: 12,
    nodes: [
      {
        id: 'Webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [-300, 300],
        parameters: {
          httpMethod: 'POST',
          path: 'release-announcement',
          responseData: 'sent',
        },
      },
      {
        id: 'Slack',
        name: 'Slack',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [0, 150],
        parameters: { channel: 'launch-updates' },
      },
      {
        id: 'Email',
        name: 'Email',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 1,
        position: [0, 300],
        parameters: { fromEmail: 'updates@example.com' },
      },
      {
        id: 'Notion',
        name: 'Notion',
        type: 'n8n-nodes-base.notion',
        typeVersion: 1,
        position: [0, 450],
        parameters: { resource: 'page' },
      },
    ],
    connections: {
      Webhook: {
        main: [
          [
            { node: 'Slack', type: 'main', index: 0 },
            { node: 'Email', type: 'main', index: 0 },
            { node: 'Notion', type: 'main', index: 0 },
          ],
        ],
      },
    },
  },
  {
    id: 'lead-enrich',
    name: '리드 인입·검증·CRM 적재',
    description:
      '웹폼으로 들어온 신규 리드를 Clearbit/서드파티로 enrichment 후 CRM에 적재하고, VIP 기준을 만족하면 슬랙 알림까지.',
    tags: ['세일즈', 'CRM', '자동화'],
    difficulty: 'Advanced',
    heroColor: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    diagramImage: diagramLeadEnrich,
    diagramCaption: 'Webhook로 리드 인입 후 Clearbit → IF → Slack/HubSpot 경로',
    credentials: ['HTTP Request', 'Clearbit', 'HubSpot'],
    estimatedSetupMinutes: 18,
    nodes: [
      {
        id: 'Webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [-300, 120],
        parameters: {
          httpMethod: 'POST',
          path: 'lead-enrich',
          responseData: 'accepted',
        },
      },
      {
        id: 'HTTP',
        name: 'Clearbit Enrich',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [0, 60],
        parameters: { url: 'https://person.clearbit.com/v2/people/find', method: 'GET' },
      },
      {
        id: 'IF',
        name: 'VIP Scoring',
        type: 'n8n-nodes-base.if',
        typeVersion: 1,
        position: [260, 60],
        parameters: {
          conditions: {
            boolean: [],
            number: [],
            string: [
              {
                value1: '={{$json["company_size"]}}',
                value2: '200',
                operation: 'larger',
              },
            ],
          },
        },
      },
      {
        id: 'Hubspot',
        name: 'HubSpot',
        type: 'n8n-nodes-base.hubspot',
        typeVersion: 1,
        position: [0, 220],
        parameters: { resource: 'contact', operation: 'upsert' },
      },
      {
        id: 'Slack',
        name: 'Slack Notify',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [520, 60],
        parameters: { channel: 'vip-leads' },
      },
    ],
    connections: {
      Webhook: {
        main: [[{ node: 'Clearbit Enrich', type: 'main', index: 0 }]],
      },
      'Clearbit Enrich': {
        main: [[{ node: 'VIP Scoring', type: 'main', index: 0 }]],
      },
      'VIP Scoring': {
        main: [[{ node: 'Slack Notify', type: 'main', index: 0 }]],
        else: [[{ node: 'HubSpot', type: 'main', index: 0 }]],
      },
    },
  },
  {
    id: 'daily-digest',
    name: '팀 맞춤 데일리 다이제스트',
    description:
      '노션·지라·깃허브 이슈·캘린더 등에서 오늘 필요한 정보만 모아 이메일/슬랙으로 아침에 전달.',
    tags: ['프로덕트', '알림', '데일리'],
    difficulty: 'Beginner',
    heroColor: 'linear-gradient(135deg, #f97316, #f43f5e)',
    diagramImage: diagramDailyDigest,
    diagramCaption: 'Cron → Notion/GitHub → Slack·Email로 팬아웃되는 아침 다이제스트',
    credentials: ['Notion', 'Slack', 'Gmail'],
    estimatedSetupMinutes: 8,
    nodes: [
      {
        id: 'Schedule',
        name: 'Daily Cron',
        type: 'n8n-nodes-base.cron',
        typeVersion: 1,
        position: [-300, 0],
        parameters: { mode: 'everyDay', hour: 7 },
      },
      {
        id: 'Notion',
        name: 'Notion Fetch',
        type: 'n8n-nodes-base.notion',
        typeVersion: 1,
        position: [0, -80],
        parameters: { resource: 'database', operation: 'getAll' },
      },
      {
        id: 'Slack',
        name: 'Slack Send',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [260, 0],
        parameters: { channel: 'daily' },
      },
      {
        id: 'Email',
        name: 'Email Send',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 1,
        position: [260, 160],
        parameters: { fromEmail: 'digest@example.com' },
      },
    ],
    connections: {
      'Daily Cron': {
        main: [[{ node: 'Notion Fetch', type: 'main', index: 0 }]],
      },
      'Notion Fetch': {
        main: [
          [
            { node: 'Slack Send', type: 'main', index: 0 },
            { node: 'Email Send', type: 'main', index: 0 },
          ],
        ],
      },
    },
  },
];
