# 0016 — Bandwidth approach

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Outbound data transfer dominates cost at scale. Estimated per-user downstream (compact JSON), democracy-only: turns ≤ ~150 B/s (about one per tick; more only when ticks end early), presence ~50 B/s, vote tally ~80 B/s, chat variable — ≈ 0.25 KB/s excluding chat. Should we set a hard per-user target, and how do we avoid finding out too late?

## Considered Options

1. Hard target (≤ 0.5 KB/s/user) + metric
2. **No hard target; built-in reductions + early-warning alarm**

## Decision Outcome

Chosen option 2.

- **Built into the protocol from day one:** deltas only, one message per turn, presence batched at 1/s.
- **Metric:** bytes sent per connection, published to CloudWatch.
- **Alarm:** fires at > 0.75 KB/s per user **or** > 50 concurrent users, triggering a review before costs bite.
- **Later levers:** binary codec (MessagePack/protobuf), chat caps ([ADR-0015](0015-chat-at-scale-known-problem.md)).
- Validate with a load test (k6/Artillery) before scaling.

### Consequences

- Good: cheap reductions upfront; early warning leaves time to optimize.
- Bad: JSON is larger than binary until switched.
