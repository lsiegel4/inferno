# 0007 — AWS hosting on ECS Fargate, no standby at launch

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Where to host the game process, frontend, and storage, given AWS familiarity and a small launch (2–5 users) with a goal of ~1,000 concurrent and the ability to scale beyond.

## Considered Options

1. **AWS: ECS Fargate + ALB + DynamoDB + S3/CloudFront**
2. AWS Lightsail + DynamoDB
3. Cloudflare Durable Objects
4. Hetzner / Fly.io VPS

## Decision Outcome

Chosen option 1.

- Game process: one ECS Fargate task. **No hot standby at launch** (ECS replaces a failed task in ~30–60 s).
- WebSockets via ALB ([ADR-0008](0008-websockets-via-alb.md)).
- Event log and snapshots in DynamoDB ([ADR-0009](0009-dynamodb-event-log-and-snapshots.md)).
- Frontend: S3 + CloudFront.
- Avoid NAT gateways (use public subnets or VPC endpoints).
- Owner manages spend with AWS Budgets alerts.

Rough estimate (unverified, from memory): ~$50/mo at launch, ~$250–400/mo at 1k concurrent, dominated by data transfer at scale.

### Consequences

- Good: familiar platform; managed task restarts; path to a hot standby and gateway tier later.
- Bad: higher launch cost than Lightsail/Cloudflare/VPS options; ALB is a fixed baseline cost.

## Pros and Cons of the Options

### Lightsail
- Good: ~$15/mo launch, bundled bandwidth. Bad: manual restarts.

### Cloudflare Durable Objects
- Good: single-writer model built in, no egress fees, ~$5/mo. Bad: leaves AWS, vendor lock-in, fan-out limits per object.

### Hetzner / Fly.io
- Good: cheapest. Bad: self-managed restarts/backups.
