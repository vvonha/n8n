# Workflow import flow (server-brokered)

## Quick answer (why it ends up in the right n8n account)
- The browser now calls the gallery’s **`POST /api/import-workflow`** endpoint only.
- The gallery server forwards that request to **`POST /api/v1/workflows`** on your n8n instance using the server-side credentials you configure (API key, basic auth, or bearer token).
- Because the server calls n8n with those credentials, the new workflow is owned by the user/API key represented by them—no shared admin context is exposed to the browser.

## What the gallery server sends to n8n
- Body: `{ name, active: false, nodes, connections, tags }` from the selected template.
- Auth: one of
  - `X-N8N-API-KEY: <key>` (preferred)
  - `Authorization: Basic base64(user:pass)` when `N8N_BASIC_AUTH_USER/PASSWORD` are provided
  - `Authorization: Bearer <token>` when `N8N_BEARER_TOKEN` is provided
- Target URL: `<N8N_API_URL>/workflows` (set `N8N_API_URL`, e.g., `https://n8n.ldccai.com/api/v1`).

## Why CORS is no longer a blocker
- The browser never talks to `https://n8n.ldccai.com` directly, so cross-origin checks are avoided entirely.
- AWS ALB/ingress doesn’t need to inject CORS headers, and n8n’s webhook-only CORS settings don’t affect this flow.

## Typical end-to-end sequence
1) User clicks **Import to my workflow** in the gallery UI.
2) Browser → `POST /api/import-workflow` (same origin as the gallery).
3) Gallery server → `POST <N8N_API_URL>/workflows` with its configured credentials.
4) n8n returns the new workflow ID; the gallery surfaces it to the user.

## Troubleshooting cues
- **400 from /api/import-workflow**: server is missing `N8N_API_KEY`/auth envs or template JSON.
- **401/403 from n8n**: supplied API key or basic credentials are invalid in the n8n instance.
- **Unexpected 5xx**: check gallery server logs for the proxied request/response; network egress to `N8N_API_URL` may be blocked.
