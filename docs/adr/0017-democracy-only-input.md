# 0017 — Democracy-only input

- Status: accepted
- Date: 2026-10-04
- Supersedes: [0003](0003-input-resolution.md)

## Context and Problem Statement

ADR-0003 combined sampled anarchy (default) with democracy (designer-set or player-voted). A playable prototype with simulated players showed that anarchy feels extremely unsatisfying: each player's influence is about 1/N, presses rarely matter, and at scale it is effectively unplayable. Plurality picking, crowd visualisation, and "your press was picked" feedback were tried and did not fix it. Democracy felt much smoother.

## Decision Drivers

- Player agency and satisfaction at any crowd size
- Playability at scale (target 1,000+ concurrent)
- Small crowds (early floors need 1–2 players) must not feel slow

## Considered Options

1. Keep anarchy + democracy (ADR-0003)
2. Anarchy with plurality picking
3. **Democracy only, with early tick end**

## Decision Outcome

Chosen option 3.

- Every turn is decided by vote. One vote per user per tick, not changeable.
- A tick lasts **1–3 s**: it ends at 3 s or early once every active player has voted, but never before 1 s.
- Winning action applied; zero votes → no turn. Ties broken at random. Invalid votes are counted (an invalid winner consumes the turn with no effect). Live tally shown.
- Removed: sampled anarchy, global hero speed cap K, per-user 1 action/s limit, random/plurality picking, the player vote to switch to democracy (60% / 30 s / 2-minute cooldown / 3 switches), designer-set democracy floors.
- **The pitch changes** from colliding concurrent presses to **collective puzzle solving**: later floors must be complex enough that decisions are not immediately obvious. Difficulty comes from puzzle design, unseen information, and route ambiguity rather than input chaos.


### Consequences

- Good: every voter influences each turn; scales to large crowds; simpler protocol (no mode switching).
- Good: early tick end keeps small crowds fast.
- Bad: visible hazards are rarely hit — floors need substantial puzzle logic to stay challenging.
- Bad: loses the "chaotic collision" moments of the original pitch.

## Pros and Cons of the Options

### Keep anarchy + democracy
- Good: variety; chaotic moments.
- Bad: anarchy unplayable at scale (prototype finding).

### Anarchy with plurality picking
- Good: faster than democracy.
- Bad: still low individual agency; prototype did not feel better.
