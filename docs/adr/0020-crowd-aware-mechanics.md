# 0020 — Crowd-aware mechanics (echo, altar, vigil)

- Status: accepted (decided in the floor-design session, PR #9; recorded 2026-10-20)
- Date: 2026-10-20

## Context and Problem Statement

Democracy filters out visible danger: a large crowd rarely votes into lava it can see (ADR-0017). Most puzzle mechanics get *easier* with more voters, because the plurality smooths out mistakes. Some mechanics should instead get harder as the crowd grows, so late floors stay challenging at scale.

## Decision Outcome

Each turn records how the crowd voted: `crowd = { support, dissent }`, where `support` is the winning action's share of the votes cast and `dissent` is the runner-up action (null when everyone agreed). Mechanics read it:

- **Echo** (the Shade of Dissent): a second body that performs the runner-up vote each turn, and stands still when the crowd agrees. The crowd must split its vote on purpose; the hero and the echo can never move the same way on the same turn.
- **Altar of Accord:** Interact succeeds only if the winning vote's share reaches the altar's `threshold` (66–90%); otherwise it reports how united the crowd was.
- **Vigil stone:** stand on it and Wait for N turns in a row.

`crowd` is part of the turn log and the `turn` message, and is replayed on recovery, so the game stays deterministic (ADR-0001, ADR-0009). Records without it count as unanimous.

### Consequences

- Good: difficulty that scales with the crowd. Trolls and distracted voters become noise the crowd must beat.
- Good: no new input mode; still one vote per player per tick.
- Bad: these floors need a minimum crowd (the echo needs at least three voters to split 2 to 1), which raises those floors' minimum players.
