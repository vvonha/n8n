# Workflow import flow (how the gallery creates a workflow in the right account)

## Quick answer (why it ends up in your account)
- The gallery runs entirely in the browser. It sends your chosen auth (PAT, Basic, or your existing session cookie) directly to
  `POST /rest/workflows` on the n8n host you enter.
- n8n attributes the new workflow to **whoever that auth represents**, just like hitting the API from the n8n editor.
- There is no shared admin token in the gallery; each user’s call is isolated by their own credentials/cookies.

## What the gallery sends
- The gallery posts the **template JSON** to `POST /rest/workflows` on the n8n host you enter.
- The request includes whatever auth you chose in the connection panel:
  - **PAT** → `Authorization: Bearer <token>`
  - **Basic Auth** → `Authorization: Basic base64(user:pass)`
  - **Session cookie** → No Authorization header; relies on existing `n8n-auth` cookies sent by the browser.

## Why it lands in the correct user’s space
- n8n attaches the workflow to **the identity represented by that auth**:
  - PATs are user-scoped; creating a workflow with a user’s PAT stores it under that user.
  - Basic Auth uses the credentials you provide for that user.
  - Session-cookie mode reuses the browser’s logged-in session; the API call runs as the logged-in user.
- The gallery never acts as an admin bridge. It forwards your headers/cookies directly to `/rest/workflows`, so n8n enforces the same permissions it would if you hit the API from the browser or Postman.
- In a multi-user instance, two people can import the same template simultaneously; each new workflow is stored under the caller’s identity because the auth (token/credentials/session) is different per person.

## Preconditions on the n8n side
- **Authentication**: At least one of PAT, Basic Auth, or a valid login session must exist for the user.
- **CORS**: The n8n host must allow the gallery origin and `Access-Control-Allow-Credentials: true` if cookies are used.
- **TLS + SameSite**: Use HTTPS on both domains; cookies must be `SameSite=None; Secure` to travel cross-site.

## Typical end-to-end sequence (browser)
1) User opens the gallery, enters `https://n8n.ldccai.com` as the host and selects an auth mode.
2) When they click **Import to my workflow**, the browser sends `POST /rest/workflows` to that host with the chosen auth.
3) n8n checks the auth, binds the request to that user, creates the workflow, and returns its ID.
4) The gallery shows the success message with a link to open the workflow in the user’s n8n editor.

## Troubleshooting signs
- **Preflight lacks Access-Control-Allow-***: CORS env vars may not be applied or ingress is intercepting OPTIONS.
- **401/403 on import**: Auth token/cookie is missing or invalid; confirm the user can hit `/rest/workflows` with the same credentials via curl/Postman.
- **Cookie mode fails**: Check that the cookie is sent in the request (browser devtools) and that n8n replies with `Access-Control-Allow-Credentials: true` for the gallery origin.
