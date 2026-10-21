# 0019 — Entity-type rules engine

- Status: accepted
- Date: 2026-10-11

## Context and Problem Statement

v1 ships several puzzle mechanics (push blocks, pressure plates, turn-cycle elements, signs, darkness) and more are planned after launch. Adding a mechanic should not require reworking the core engine, floor format, or protocol.

## Decision Outcome

The rules engine is built around **entity types**. Each mechanic is a self-contained module that declares:

- its state shape and floor-file representation;
- how it reacts to hero actions (blocking, pushing, interacting, stepping on);
- what it does when the world advances each turn (for cycles and patrols);
- its behaviour on floor reset and when the hero leaves the floor;
- its visibility (for darkness and hidden entities).

Modules register in one place. The core handles turn order, votes, death, and floor transitions; the protocol carries generic `Entity { id, kind, x, y, state }` objects, so new kinds need no new message types.

### Consequences

- Good: new mechanics are additive; each can be unit-tested in isolation.
- Bad: interactions between mechanics (a block on a plate on a moving platform) need explicit ordering rules in the core and combination tests.
