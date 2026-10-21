# 0004 — Turn-based world

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

A shared hero with ~0.3 s effective latency and many inputs makes precise timing (dexterity) challenges feel random rather than skillful. Should the world run in real time?

## Considered Options

1. Puzzle-first real time with light pressure
2. **Turn-based world** (world advances only when the hero acts)
3. Real time with dexterity challenges

## Decision Outcome

Chosen option 2. One hero action = one turn; patrolling enemies and (very slow) moving platforms advance once per turn. No actions → no turns → world frozen. No combat; challenges are puzzles, turn-based timing, and crowd coordination.

### Consequences

- Good: removes latency unfairness; simplifies simulation and replay (deterministic per turn).
- Good: pausing only needs to block input — the world is already frozen without actions.
- Bad: no real-time tension; difficulty must come from puzzles and coordination.
