# 0009 — DynamoDB event log and snapshots with conditional-write fencing

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

The single game process ([ADR-0001](0001-single-authoritative-game-process.md)) needs durable storage for hero turns, every vote, chat, and snapshots, plus protection against two processes writing at once (deploy overlap, zombie tasks).

## Decision Outcome

DynamoDB (on-demand).

- **Hero turn log:** one item per turn, key = turn number. Written with a condition that the turn number is `last + 1` and/or the writer holds the current leader epoch. A failed condition means another process is leader → the stale process stops. **Contains no user IDs**, so it never needs editing for data deletion.
- **Vote audit log:** all votes from one tick batched into **one item** (keeps writes ~per-KB instead of per-vote; storing each individually was estimated at ~$1,600/mo at 1k users). Tied to internal user IDs. Retained forever.
- **Chat:** stored with a TTL of **3 days** (DynamoDB TTL).
- **Snapshots:** full game state **every 100 turns, keeping the last 3**; recovery replays at most ~100 turns.
- Each turn is applied only after its write succeeds.
- **Tables (approved 2026-10-12), one per concern, on-demand:** `turns` (game + turn), `votes` (game + turn, one item per tick), `snapshots` (game + turn), `chat` (game + time, 3-day TTL), `users` (user id; GSI on Google `sub`; handle uniqueness via a lowercase-handle item written in the same transaction), `sessions` (token hash; GSI on user id; TTL), `lease` (single item with a leader epoch).
- Tests run against DynamoDB Local in Docker.

### Consequences

- Good: serverless, pay-per-use, conditional writes provide fencing natively; TTL handles chat retention.
- Bad: snapshot items may approach the 400 KB item limit for large floors (may need S3 for snapshots later).
