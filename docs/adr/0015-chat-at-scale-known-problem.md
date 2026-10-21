# 0015 — Chat at scale (known future problem)

- Status: accepted (deferred)
- Date: 2026-10-03

## Context and Problem Statement

At 10k users sending a message every 5 s, chat is ~2k msgs/s; fanned out to 10k clients that is ~20M deliveries/s, and the chat is unreadable anyway. Bandwidth is the main cost driver.

## Decision Outcome

Deferred. At launch: per-user limit 1 msg / 2 s, 200 chars. Candidate future solutions: global slow mode, displaying a sample of messages, or split channels. Revisit when the bandwidth alarm ([ADR-0016](0016-bandwidth-approach.md)) fires.

### Consequences

- Good: no premature complexity.
- Bad: requires a design change before large scale.
