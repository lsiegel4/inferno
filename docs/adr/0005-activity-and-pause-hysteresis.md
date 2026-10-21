# 0005 — Activity definition and pause hysteresis

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Each floor needs a minimum number of *active* players. If "active" means "acted recently", a paused game can never unpause (nobody can act). If it means "online", idle users keep the game running and defeat the concurrency design, and the game can oscillate between paused and unpaused.

## Decision Outcome

- **Active** = logged in + qualifying activity within W = 60 s. Qualifying: votes, Ready presses. Chat does not count. Being online never counts.
- **Ready button** shown only while paused; pressing it counts as activity.
- **Spectator** is a derived label (online but not active), not a mode.
- **Hysteresis:** unpause immediately when active ≥ minimum; pause only after active < minimum for G = 10 s.
- Minimums are designer-set per floor; early floors require 1–2; revisited floors use their own minimum.

### Consequences

- Good: no pause deadlock; no flapping; idle users can't hold the game open.
- Good: no extra mode/state for spectators.
- Bad: a player thinking for > 60 s without acting stops counting.
