# 0013 — TypeScript full stack, React + Canvas

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Choose languages and frameworks. Implementation is done with an AI assistant, so hiring/ecosystem familiarity isn't a factor.

## Considered Options

1. **TypeScript everywhere** (Node backend, React frontend)
2. Go backend + TS frontend
3. Elixir/Phoenix + TS frontend
4. Rust

## Decision Outcome

Chosen option 1. Frontend: React for UI (chat, log, menus, controls) + HTML Canvas for the grid.

### Consequences

- Good: shared message types and game rules between client and server (client can show valid actions and contextual Interact labels).
- Bad: Node is single-threaded — fine at one turn per vote tick; fan-out scales via the gateway tier.
