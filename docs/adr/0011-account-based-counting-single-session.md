# 0011 — Account-based counting, one session per account

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Without accounts, one person can open many tabs or incognito windows to inflate the active count (defeating floor minimums), bypass rate limits, and rig democracy votes.

## Considered Options

1. **Google login required to act**
2. **Count active by account; one live session per account**
3. Per-IP caps on active accounts
4. CAPTCHA (Cloudflare Turnstile)
5. Behavioural bot detection

## Decision Outcome

Options 1 and 2. A new connection from the same account demotes the older one to spectator (`session_replaced`). The effort of creating multiple Google accounts is judged sufficient deterrence.

### Consequences

- Good: defeats multi-tab/incognito inflation with minimal friction.
- Bad: multiple Google accounts per person remain possible. Options 3–5 are available if abuse appears.
