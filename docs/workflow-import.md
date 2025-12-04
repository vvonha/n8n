# Workflow import flow (server-brokered)

## Quick answer (why it ends up in the right n8n account)
- The browser now calls the gallery’s **`POST /api/import-workflow`** endpoint only.
- The gallery server forwards that request to **`POST /api/v1/workflows`** (or **`/rest/workflows`**) on your n8n instance using the API key provided by the user in the UI (or, optionally, a server-side credential if you choose to set one).
- Because the server calls n8n with the key attached to the request, the new workflow is owned by that user/API key—no 공유 admin 컨텍스트가 노출되지 않습니다.

## What the gallery server sends to n8n
- Body: `{ name, active: false, nodes, connections, tags }` from the selected template.
- Auth: 우선순위
  - `X-N8N-API-KEY: <key>` 전달 (UI에서 사용자가 입력한 Personal API Key)
  - 필요 시 서버 환경변수로 `N8N_API_KEY` / Basic Auth / Bearer Token을 넣을 수 있으나, 다중 사용자 환경에서는 사용자별 API Key 입력이 권장됩니다.
- Target URL: built from `N8N_WORKFLOWS_ENDPOINT` (full URL) if set. Otherwise the server appends `/api/v1/workflows` (or `/rest/workflows`) to `apiBase` from the UI request body, falling back to `N8N_API_BASE` when the request omits it.

> 환경변수(`N8N_API_BASE`, `N8N_WORKFLOWS_ENDPOINT`, `N8N_API_KEY`)는 **갤러리 서버 컨테이너**에만 설정합니다. n8n 서버에 넣어도 CORS나 인증 흐름에는 영향을 주지 않습니다.

## Why CORS is no longer a blocker
- The browser never talks to `https://n8n.ldccai.com` directly, so cross-origin checks are avoided entirely.
- AWS ALB/ingress doesn’t need to inject CORS headers, and n8n’s webhook-only CORS settings don’t affect this flow.

## Typical end-to-end sequence
1) User clicks **Import to my workflow** in the gallery UI.
2) Browser → `POST /api/import-workflow` (same origin as the gallery).
3) Gallery server → `POST <resolved workflows endpoint>` with the API key passed from the user (or the configured server credential, if set).
4) n8n returns the new workflow ID; the gallery surfaces it to the user.

### How to verify the target host (for "why is requestURL the gallery domain?" cases)
- 브라우저 Network 탭에서 **보이는 요청 URL**은 항상 갤러리의 `/api/import-workflow`입니다. 이는 CORS를 피하기 위한 서버 중계 요청입니다.
- 갤러리 서버는 요청 바디의 `apiBase`(예: `https://n8n.ldccai.com`) 또는 서버 환경변수로 받은 값을 조합해 **실제 n8n 호출 주소**를 만듭니다. 기본값은 `${apiBase}/api/v1/workflows` 또는 `${apiBase}/rest/workflows`입니다.
- `/api/import-workflow` 응답 JSON의 `endpoint` 필드에 갤러리가 최종으로 호출한 n8n URL을 그대로 반환하므로, 이 값을 보면 실제 전송 대상이 무엇인지 확인할 수 있습니다.

## Troubleshooting cues
- **400 from /api/import-workflow**: 요청에 API Key가 없거나 템플릿 JSON이 없음.
- **401/403 from n8n**: supplied API key or basic credentials are invalid in the n8n instance.
- **Unexpected 5xx**: check gallery server logs for the proxied request/response; network egress to your configured n8n API endpoint may be blocked.
