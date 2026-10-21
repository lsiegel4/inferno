# 0018 — Sessions: opaque server-side token in an HttpOnly cookie

- Status: accepted
- Date: 2026-10-11

## Context and Problem Statement

After Google sign-in is verified ([ADR-0010](0010-google-signin-server-verification.md)), the server issues its own session. How should sessions be represented, stored in the browser, scoped, and expired? Chat bans and account deletion require instant revocation; chat is user-generated content and the most likely source of XSS.

## Decision Drivers

- Instant revocation (bans, deletion, logout)
- Session must not be readable by page scripts (XSS)
- Works for both REST and WebSocket with minimal moving parts

## Considered Options

- Token type: **opaque server-side token** vs. signed JWT
- Browser storage: **HttpOnly cookie** vs. localStorage + header / `hello` message
- Domain layout: **single origin via CloudFront** vs. frontend and API on separate subdomains

## Decision Outcome

- **S1 — Opaque token.** ≥ 256-bit random value; the server stores only its hash in a DynamoDB sessions table (TTL-expired, indexed by user ID). Revocation = delete the record.
- **S2 — HttpOnly cookie.** `inferno_session`, `HttpOnly; Secure; SameSite=Lax; Path=/`. Sent automatically on REST calls and the WebSocket upgrade; `hello` carries no token.
- **S3 — Single origin.** CloudFront serves the frontend and routes `/api/*` and `/ws` to the ALB. No CORS.
- **S4 — 30-day sliding expiry**, extended on use. Logout deletes the session; account deletion or ban deletes all of the user's sessions and closes connections. No absolute lifetime cap.
- **S5 — Multiple devices allowed.** A user may hold sessions on several devices; only one live game connection counts ([ADR-0011](0011-account-based-counting-single-session.md)).
- **Required safeguards:** `Origin` check on the WebSocket upgrade (prevents cross-site WebSocket hijacking) and on state-changing REST calls (CSRF defence in addition to SameSite); all chat escaped on render.

### Consequences

- Good: instant revocation; session unreachable by injected scripts; one origin simplifies cookies and routing.
- Good: no tokens in URLs or access logs.
- Bad: one DynamoDB read per authenticated REST call (WebSocket validates once at connect) — negligible at expected traffic.
- Bad: CSRF must be actively defended (Origin checks).
- Bad: CloudFront adds a hop in front of the ALB.

## Pros and Cons of the Options

### Signed JWT
- Good: stateless, no lookup.
- Bad: revocation requires short expiry + refresh tokens or a denylist.

### localStorage token
- Good: no CSRF concerns.
- Bad: readable by any injected script.

### Separate subdomains
- Good: ALB reachable directly.
- Bad: parent-domain cookie scoping; CORS configuration.
