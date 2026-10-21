# 0006 — Death and floor traversal

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

With a shared hero, one griefer can kill the hero deliberately, so failure penalties must be tolerable. The design also wants backtracking (e.g. returning for a forgotten item).

## Considered Options

- A. No death; hazards drop the hero to a lower floor
- B. Death restarts the current floor
- E. Stairs back always available + death restarts floor
- **F. E + designer-placed pits that drop a floor**

## Decision Outcome

Chosen option F.

- Death: hero returns to floor start. Doors stay open; inventory kept; items used on this floor return; puzzle elements reset; cleared roadblocks stay cleared; unsolved roadblocks return to start positions.
- Design rule: a reset must never require an unrecoverable consumed item.
- Leaving a floor via stairs down or pit preserves its puzzle state.
- Floors already solved are fast to re-cross because doors stay open and items are kept, so falls hurt less than they appear.

Since decided: a key used on a door that stays open is not returned. Later additions (PR #9): sprung traps stay sprung and revealed through deaths; laid planks are removed and returned.

### Consequences

- Good: bounded griefing penalty; designers control the stakes per floor; backtracking enables cross-floor puzzles.
- Bad: more state rules to implement and test (reset semantics).
