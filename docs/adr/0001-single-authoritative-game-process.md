# 0001 — Single authoritative game process

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

There is one global game with one shared hero. Many players submit actions concurrently, and actions must take effect as if executed serially. Where should serialization happen?

## Decision Drivers

- Serializable semantics for all hero actions
- One shared hero means every action touches the same state (a single hot key)
- Turn-based world needs a clock (vote ticks, pause grace period)
- Live state must be pushed to all clients
- Crash recovery without losing actions

## Considered Options

1. **Single authoritative process (single writer)** with in-memory state, an input queue, a durable event log, and snapshots
2. **Database transaction per action** (optimistic concurrency / SERIALIZABLE isolation)
3. **Distributed database** per action

## Decision Outcome

Chosen option 1. A single process applies intents one at a time from its queue, making the game serializable by construction. The database provides durability and leader fencing, not concurrency control.

- Every applied turn is appended to the event log with sequence number `turn = last + 1` (conditional write — see [ADR-0009](0009-dynamodb-event-log-and-snapshots.md)).
- **The turn is applied only after the write succeeds** (no action loss on crash; ~5–10 ms per turn, negligible at one turn per vote tick).
- Periodic snapshots; recovery = load latest snapshot + replay later turns.
- **No hot standby at launch** ([ADR-0007](0007-aws-hosting-fargate.md)). A crash means ECS restarts the task: ~30–60 s of downtime, which players experience as a pause.
- During deploys, old and new tasks may overlap. The conditional write fences the stale process: its writes fail and it shuts itself down.
- Future scale: split into one game process (writer) → pub/sub → N gateway nodes that hold WebSockets and fan out. At launch, gateway and game live in one process. Game logic is unaffected by the split.

### Consequences

- Good: serializability for free; very high throughput (in-memory); natural home for the game clock and broadcasting.
- Good: a failover looks like the pause state players already understand.
- Bad: single point of failure; 30–60 s recovery without a standby.
- Bad: fan-out at tens of thousands of users requires the gateway split.

## Pros and Cons of the Options

### Single authoritative process

- Good: matches the inherent single serialized stream of a shared hero.
- Bad: needs snapshot/replay and fencing logic.

### Database transaction per action

- Good: durability per action is inherent.
- Bad: every transaction contends on the same hero row → serialization failures/retries; realistic ceiling ~100 actions/s.
- Bad: still needs a process for the clock and client push.

### Distributed database

- Good: no single node.
- Bad: one hot key still funnels through one leader/consensus group — distribution doesn't help, and adds latency and complexity.
