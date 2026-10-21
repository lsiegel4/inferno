# 0003 — Input resolution: sampled anarchy, global speed cap, democracy

- Status: superseded by [0017](0017-democracy-only-input.md) (2026-10-04)
- Date: 2026-10-03

## Context and Problem Statement

With N players each pressing ~1/s, pure anarchy delivers N moves/s to the hero. Players see state ~0.3 s stale, and the hero jitters through intermediate tiles (hitting hazards) even when the crowd's average intent is right. How should concurrent input become hero turns?

## Decision Drivers

- Keep chaos bounded regardless of player count
- Fairness: no advantage for spam or low latency
- Allow deliberate coordination for hard sections

## Considered Options

1. Pure anarchy (every press applied in arrival order)
2. Anarchy with a queue (bounded rate, unbounded lag)
3. **Sampled anarchy** with a global hero speed cap
4. **Democracy** (votes aggregated per tick)

## Decision Outcome

Options 3 and 4, both available.

**Sampled anarchy (default):**
- Per-user limit: 1 action/s (fixed).
- Global cap K = 3 turns/s (ceiling, not quota).
- 1/3 s windows; one press sampled uniformly at random from **valid** presses in the window. Empty window → no turn.

**Democracy:**
- 3 s tick; one vote per user per tick, not changeable; winning action applied; zero votes → no turn.
- Enabled per floor by the designer, or by player vote:
  - Any logged-in active user may start a vote; passes at > 60% of active users within 30 s.
  - Failed vote → 2-minute cooldown; failed votes don't count toward the cap.
  - Max 3 successful switches per game.
  - Lasts on every floor the hero visits until the hero reaches the stairs up of the floor where the vote passed.

Open: democracy tie-break; handling of votes invalid at tally time.

### Consequences

- Good: each player's influence ≈ K/N; chaos bounded at any scale.
- Good: random sampling neutralises latency and spam advantages.
- Bad: at high N, an individual's press is rarely chosen (accepted; no per-press feedback by decision).

## Pros and Cons of the Options

### Pure anarchy
- Good: simplest, most chaotic.
- Bad: unplayable at scale.

### Queued anarchy
- Bad: lag grows without bound.

### Random vs first-come sampling
- First-come rewards low latency; random chosen for fairness.
