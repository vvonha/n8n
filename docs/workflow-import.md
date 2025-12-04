# Workflow import flow (server-brokered)

## Quick answer (why it ends up in the right n8n account)
- The browser now calls the gallery’s **`POST /api/import-workflow`** endpoint only.
- The gallery server forwards that request to **`POST /api/v1/workflows`** on your n8n instance using the API key provided by the user in the UI (or, optionally, a server-side credential if you choose to set one).
- Because the server calls n8n with the key attached to the request, the new workflow is owned by that user/API key—no 공유 admin 컨텍스트가 노출되지 않습니다.

## What the gallery server sends to n8n
- Body: `{ name, active: false, nodes, connections, tags }` from the selected template.
- Auth: 우선순위
  - `X-N8N-API-KEY: <key>` 전달 (UI에서 사용자가 입력한 Personal API Key)
  - 필요 시 서버 환경변수로 `N8N_API_KEY` / Basic Auth / Bearer Token을 넣을 수 있으나, 다중 사용자 환경에서는 사용자별 API Key 입력이 권장됩니다.
- Target URL: `<N8N_API_URL>/workflows` (set `N8N_API_URL`, e.g., `https://n8n.ldccai.com/api/v1`).

## Why CORS is no longer a blocker
- The browser never talks to `https://n8n.ldccai.com` directly, so cross-origin checks are avoided entirely.
- AWS ALB/ingress doesn’t need to inject CORS headers, and n8n’s webhook-only CORS settings don’t affect this flow.

## Typical end-to-end sequence
1) User clicks **Import to my workflow** in the gallery UI.
2) Browser → `POST /api/import-workflow` (same origin as the gallery).
3) Gallery server → `POST <N8N_API_URL>/workflows` with the API key passed from the user (or the configured server credential, if set).
4) n8n returns the new workflow ID; the gallery surfaces it to the user.

## Troubleshooting cues
- **400 from /api/import-workflow**: 요청에 API Key가 없거나 템플릿 JSON이 없음.
- **401/403 from n8n**: supplied API key or basic credentials are invalid in the n8n instance.
- **Unexpected 5xx**: check gallery server logs for the proxied request/response; network egress to `N8N_API_URL` may be blocked.
