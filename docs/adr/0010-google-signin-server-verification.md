# 0010 — Google sign-in verified server-side, own session token

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Acting and chatting require an identity (anti-Sybil, moderation). How should login work?

## Considered Options

1. **Google Identity Services on the client; server verifies the ID token and issues its own session token**
2. Amazon Cognito with Google federation

## Decision Outcome

Chosen option 1. The server verifies the ID token with `google-auth-library` (signature, audience, issuer, expiry), maps Google `sub` → internal user ID, and creates a session. Watching requires no login. Session design: [ADR-0018](0018-sessions-opaque-token-httponly-cookie.md).

### Consequences

- Good: free, few moving parts, no extra AWS service.
- Bad: we own session issuance and revocation.
