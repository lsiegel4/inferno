# 0002 — Intent-based action validation

- Status: accepted
- Date: 2026-10-03 (amended 2026-10-04 for [ADR-0017](0017-democracy-only-input.md))

## Context and Problem Statement

By the time a player's press is applied, the state has likely changed due to other players' presses. Should actions be rejected if the state changed since the player saw it?

## Considered Options

1. **Intent-based:** an action means "do X from the current state"; reject only if X is not legal at application time
2. **Version-based:** each action carries the state version it was based on; reject on mismatch

## Decision Outcome

Chosen option 1. Version-based rejection would reject nearly every press under concurrency and defeat the point of the game. With democracy-only input ([ADR-0017](0017-democracy-only-input.md)) the same principle applies to votes: a vote means "do X from the state at tally time".

Votes that are invalid at tally time are still counted; if one wins, the turn is consumed with no effect. Moving into a wall is **valid**: it turns the hero to face that direction and consumes a turn.

### Consequences

- Good: votes never fail on stale state.
- Bad: the outcome depends on the state at tally time, which voters must anticipate.
