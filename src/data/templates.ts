export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  heroColor: string;
  preview?: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  credentials?: string[];
  estimatedSetupMinutes?: number;
};

export const templates: WorkflowTemplate[] = [
  {
    id: 'event-announce',
    name: '이벤트/릴리스 공지 자동화',
    description:
      '신규 릴리스나 이벤트가 있을 때 이메일·슬랙·노션·트위터(X)까지 한번에 발송하는 파이프라인.',
    tags: ['공지', '마케팅', '옴니채널'],
    difficulty: 'Intermediate',
    heroColor: 'linear-gradient(135deg, #7c3aed, #14b8a6)',
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
