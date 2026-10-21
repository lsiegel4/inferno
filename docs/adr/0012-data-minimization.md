# 0012 — Data minimization

- Status: accepted
- Date: 2026-10-03

## Context and Problem Statement

Google account IDs, votes, and chat tied to a user count as personal data (GDPR/CCPA). Users must be able to delete their data, but the hero turn log is replayed for recovery and can't be edited.

## Decision Outcome

- Store only the Google `sub` → internal user ID mapping and the handle. **No email.** Minimal/truncated IP logging.
- Hero turn log contains no user IDs.
- Votes and chat reference the internal user ID.
- **Deletion** (`DELETE /me`) removes the internal ID ↔ `sub`/handle mapping. Votes and chat remain, anonymized.
- Chat auto-expires after 3 days.
- Requires a privacy policy and a cookie-consent banner for ads. *Not legal advice — verify.*

### Consequences

- Good: small privacy surface; deletion doesn't break event sourcing.
- Bad: anonymized vote data is retained indefinitely (acceptable by decision).
