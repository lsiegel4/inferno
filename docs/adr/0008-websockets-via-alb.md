# 0008 — WebSockets via ALB, not API Gateway

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Clients need a persistent bidirectional connection for turns, presence, and chat.

## Considered Options

1. **ALB in front of our own WebSocket server**
2. API Gateway WebSocket APIs

## Decision Outcome

Chosen option 1. API Gateway bills per message; at 10k users × ~3 updates/s that is roughly $2.5k/day. The ALB has a flat baseline plus capacity units, and our process holds connections directly.

Amended 2026-10-11: CloudFront sits in front of the ALB so the frontend, `/api/*` and `/ws` share one origin for cookie-based sessions ([ADR-0018](0018-sessions-opaque-token-httponly-cookie.md)).

### Consequences

- Good: predictable cost; the game process broadcasts directly.
- Bad: we manage connection handling and, at scale, a gateway tier ourselves.
