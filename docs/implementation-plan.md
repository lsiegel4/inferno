# Inferno: Implementation Plan

Status: Draft for approval · Created: 2026-10-11

Related: [Game design](game-design.md) · [API contracts](api-contracts.md) · [ADRs](adr/)

The design docs and ADRs are the source of truth. Anything this plan introduces that they don't already decide is marked **needs approval**, and nothing starts until it's approved.

---

## Progress (2026-10-20)

| Phase | Status |
|---|---|
| 0 Scaffolding | Done (merged) |
| 1 Rules engine | Done (merged); since extended in PR #9 with turn cycles, crowd, traps, beams and more (floors/README.md) |
| 2 Game server | Done (merged) |
| 3 Auth | Done (merged) |
| 4 Persistence | Done (merged) |
| 5 Client | Done on `phase-5-client` (merging); renders every mechanic with the shared floor renderer |
| — Campaign | 27 floors (PR #9, merged); floor lab playtester |
| 6 AWS | Not started: needs domain, AWS account/region, environments, deploy method |
| 7 Moderation/privacy/ads | Not started |
| 8 Load test and launch | Not started |

## 1. Goals and scope of v1

**Goal:** one global, playable game of Inferno on AWS. A crowd votes on every turn of a shared hero across a few handmade floors, with chat, pausing, sign-in, and persistence that survives crashes and deploys.

**In scope for v1:**
- Democracy-only input: 1–3 s ticks that end early once every active player has voted, random tie-break, invalid votes counted (ADR-0017).
- Turn-based world. Tiles: wall, floor, lava, start, stairs up, stairs down, pit, lever and door pairs (ADR-0004).
- Controls: moves, Jump, Interact, Use, and **Wait** (no turn-in-place action).
- **Items:** key, torch, weight stone (game design §7a).
- **v1 puzzle mechanics:** push blocks, pressure plates, turn-cycle elements (platforms, gates, patrolling roadblocks), signs, darkness / per-floor reveal mode (game design §7a). Remaining rule details are open items (game design §17.3–17.6).
- Death and floor reset rules, plus moving between floors: stairs up, stairs down (arrive on the previous floor's stairs-up tile), and pits with landing spots set by the designer (ADR-0006).
- Activity window, pause hysteresis, Ready button, spectators, per-floor minimums (ADR-0005).
- Google sign-in, opaque session cookie, handles, one live connection per account (ADR-0010, ADR-0011, ADR-0018).
- Single writer, DynamoDB event log with fencing, vote batching, snapshots and replay, chat expiring after 3 days (ADR-0001, ADR-0009).
- React and Canvas client, mobile portrait layout, event log, chat, pause screen, share button (ADR-0013).
- Profanity filter, chat rate limits, `DELETE /me`, consent banner, a non-blocking ad slot (ADR-0012, ADR-0014).
- CloudWatch bandwidth metric and alarm (ADR-0016).

**Out of scope until designed:**
- Puzzle mechanics beyond the v1 list: ice, crumbling floors, hidden traps, teleporters, toggle levers, roadblock behaviours, beams and mirrors, cross-floor links.
- Large floors with a follow camera and the explored-floor map with fog of war. These are "under exploration" in game design §18. See §7 Risks: the floor format and protocol should leave room for them.
- A hot standby, the gateway/fan-out tier, a binary message codec, and a chat-at-scale design (ADR-0015).

---

## 2. Repo layout (approved 2026-10-11)

A single TypeScript monorepo, so message types and game rules are shared by client and server (ADR-0013).

```
inferno/
  packages/
    shared/        # protocol types (api-contracts), rules engine, floor format, validation
  apps/
    server/        # game process: single writer, WebSocket and REST, persistence adapters
    client/        # React + Canvas frontend
  infra/           # AWS infrastructure as code
  floors/          # handmade floor files (data, not code)
  tools/           # bot/load harness, floor solver/validator
  docs/            # git-ignored (current choice)
```

Alternative: separate repos. That loses type sharing and isn't recommended.

---

## 3. Tooling (approved 2026-10-11)

| Area | Recommendation | Alternatives | Why |
|---|---|---|---|
| Package manager / workspaces | **pnpm workspaces** | npm workspaces, Yarn | Fast, strict about dependencies, good monorepo support |
| Node version | **Node 22 LTS** | Node 20 | Current LTS; Fargate image support |
| Language config | TypeScript `strict`, project references | — | Shared types must be exact |
| Test framework | **Vitest** | Jest, node:test | Fast, TS-native, the same tool for client and server |
| Lint / format | **ESLint + Prettier** | Biome | Most common; Biome is faster but less mature |
| Client build | **Vite** | Next.js, CRA | A static SPA on S3 needs no SSR |
| Server HTTP | **Fastify** | Express, raw `node:http` | Typed, fast, small |
| WebSocket library | **`ws`** | uWebSockets.js, Socket.IO | Standard and plenty at launch scale; uWS later if fan-out needs it; Socket.IO adds its own protocol |
| Runtime validation | **Zod** schemas in `shared` | TypeBox, hand-written | Validate every incoming message; derive TS types from the schemas |
| Infrastructure as code | **AWS CDK (TypeScript)** | Terraform, SAM | Same language as the app; first-class Fargate/ALB/CloudFront constructs |
| Local DynamoDB | **DynamoDB Local** (Docker) | LocalStack | Official; enough for one table family |
| Local dev | `pnpm dev` runs server + Vite with a proxy giving one origin (`/api`, `/ws`) | docker-compose for everything | Mirrors the single origin CloudFront gives in production, so cookies behave the same |
| CI | **GitHub Actions**: lint, typecheck, test, build | None at first | Cheap; catches regressions in the rules engine. Needs the local repo connected to your GitHub remote. |
| Profanity filter | Open item (game design §17) | e.g. `obscenity`, `bad-words` | Decide in Phase 7 |

---

## 4. Phased build order

Each phase ends with something verifiable. Phases 3 and 4 can overlap once Phase 2 is done.

### Phase 0: Repo scaffolding
- **Goal:** an empty monorepo that builds, tests and lints.
- **Deliverables:** workspace config, the `shared`/`server`/`client`/`infra` packages, TS configs, a lint/test setup, the CI workflow, a README with dev commands.
- **Exit criteria:** `pnpm install && pnpm test && pnpm build` passes locally and in CI with placeholder tests.
- **Depends on:** approval of §2 and §3.

### Phase 1: Shared types, floor format, rules engine
- **Goal:** a pure, deterministic game engine with no I/O, built around entity types ([ADR-0019](adr/0019-entity-type-rules-engine.md)): each mechanic is a self-contained module registered in one place.
- **Deliverables:**
  - Protocol types and Zod schemas for every REST and WebSocket message in api-contracts.
  - **Floor data format** (approved): an ASCII grid like the prototype plus a JSON sidecar for metadata: floor ID, index, minimum players, start point, lever→door links, pit landing spots, unlocked controls. Each tile becomes an entity kind from api-contracts (`door`, `lever`, `stairs_up`, `stairs_down`, `pit`, …).
  - `applyTurn(state, action) → { state, events }`, porting the prototype rules:
    - move, or turn in place when blocked (still uses a turn);
    - jump one tile, not over walls, landing on lava kills;
    - interact with the faced lever;
    - lava death → floor reset (doors stay open, inventory kept, used items returned, puzzle elements reset, solved roadblocks stay solved);
    - stairs up → next floor's start point;
    - stairs down → previous floor's stairs-up tile, with no auto-climb until the hero steps off and back on;
    - pit → the designer's landing spot;
    - leaving a floor preserves its puzzle state;
    - an invalid winning action uses up the turn with outcome `no_effect`;
    - Wait passes a turn while the world advances.
  - Entity modules for the v1 mechanics: push blocks, pressure plates, turn-cycle elements, signs, darkness/reveal (once their open rules are decided).
  - Vote resolution: `resolveTick(votes, rng)`: plurality, random tie-break, invalid votes counted.
  - **Floor validator/solver** in `tools/`, generalized from the prototype's BFS solver. It checks that every floor can be finished and reports the shortest route.
  - Code to turn engine events into the `changes` delta used in `turn` messages.
- **Exit criteria:** adding a new entity kind touches only its own module plus one registration line; unit tests cover every rule in game design §2–§7a, including the reset table and stairs/pit arrivals. The engine is deterministic for a given seeded RNG. The solver confirms the launch floors can be finished.
- **Depends on:** Phase 0.

### Phase 2: Game server core (in-memory)
- **Goal:** a playable multiplayer server on one machine, with no persistence and no auth.
- **Deliverables:**
  - The single-writer game loop: one queue, ticks and turns applied serially.
  - Ticks open on the first vote; minimum 1 s, maximum 3 s from that vote, early end when `voted === active`.
  - Activity tracking (W = 60 s; votes and Ready count), pause/unpause hysteresis (G = 10 s), the per-floor minimum, Ready accepted only while paused.
  - The WebSocket protocol from api-contracts: `hello`/`welcome`, `vote`, `ready`, `chat_send`, `ping`; `turn`, `floor_changed`, `presence` (≤ 1/s), `paused`/`resumed`, `tally` (≤ 1/s plus once when a tick opens), `chat_message`, `error`, `game_over`.
  - Error codes and rate limits (one vote per tick, one chat message per 2 s, 200 characters), schema validation on every incoming message.
  - REST: `GET /history` (in memory for now), `GET /health`.
  - A temporary dev-only identity: `?dev_user=<name>` on the WebSocket URL, accepted only in development mode, removed in Phase 3 (approved).
- **Exit criteria:** integration tests with fake WebSocket clients cover tick timing (including early end and the 1 s floor), tie-breaks, pause/resume hysteresis, rate limits, and one full floor playthrough. A bot harness with 50 simulated voters finishes a test floor.
- **Depends on:** Phase 1.

### Phase 3: Authentication and identity
- **Goal:** real users per ADR-0010, ADR-0011 and ADR-0018.
- **Deliverables:**
  - `POST /auth/google`: verifies the ID token with `google-auth-library` (audience, issuer, expiry), finds or creates the user by `sub`.
  - Opaque session of at least 256 bits; only its hash is stored; `inferno_session` cookie with `HttpOnly; Secure; SameSite=Lax`; 30-day sliding expiry with no absolute cap; `POST /auth/logout`.
  - Origin checks on the WebSocket upgrade and on `POST`/`PUT`/`DELETE` (`BAD_ORIGIN`).
  - One live game connection per account (`session_replaced`); spectators when not signed in.
  - Handles: a random default, `PUT /me/handle` (3–20 characters, `[A-Za-z0-9_]`, unique; the profanity check comes in Phase 7), `GET /me`.
  - A session store interface: in-memory implementation now, DynamoDB in Phase 4.
- **Exit criteria:** tests for token verification (with mocked Google keys), cookie flags, sliding renewal, revocation, Origin rejection, and session replacement.
- **Depends on:** Phase 2. Needs a Google OAuth client ID (setup task for you).

### Phase 4: Persistence and crash recovery
- **Goal:** survive crashes and deploys without losing a turn (ADR-0001, ADR-0009).
- **Deliverables:**
  - DynamoDB tables (*schema needs approval in this phase*):
    - hero turn log, keyed by turn number, conditional write `turn = last + 1` plus a leader epoch;
    - vote audit log, one item per tick;
    - chat with a 3-day TTL;
    - users (`sub` → internal ID, handle, with uniqueness enforced);
    - sessions with TTL;
    - snapshots.
  - A turn is applied only after its write succeeds. A failed condition means a stale leader, which shuts itself down.
  - Snapshots every N turns (*N and retention are open item §17.2*). Startup = latest snapshot plus replaying later turns.
  - `GET /history` paging from DynamoDB.
- **Exit criteria:**
  - A test kills the process mid-game and recovers the identical state.
  - A test runs two leaders at once; exactly one survives and no turn is duplicated.
  - Replay of the turn log reproduces the snapshot state.
- **Depends on:** Phases 2–3; open item §17.2.

### Phase 5: Client
- **Goal:** the playable frontend matching game design §9 and the prototype's look.
- **Deliverables:**
  - Vite + React app with a Canvas grid renderer (prototype palette and type).
  - Portrait layout: map; D-pad plus Jump, Interact (context label) and Use (menu); vote tally and tick countdown; Event log and Chat tabs.
  - Pause screen with the needed-players counter, Ready, share (copy link, native share sheet, QR code), chat and the ad slot. Desktop keyboard bindings.
  - Google sign-in button, handle editing, spectator view.
  - Reconnect handling: rebuild from `welcome`, ignore unknown message types.
- **Exit criteria:** manual playthrough on iOS Safari, Android Chrome and desktop against the local server with bots; chat is escaped (XSS test strings render inert).
- **Depends on:** Phase 2 (protocol); Phase 3 for sign-in. It can start against Phase 2 in parallel with Phases 3 and 4.

### Phase 6: AWS infrastructure
- **Goal:** production deployment per ADR-0007, ADR-0008 and ADR-0018.
- **Deliverables:**
  - CDK stacks: VPC with public subnets and **no NAT gateway**; ECS Fargate service with **one task, no standby**; ALB; CloudFront serving S3 (frontend) with `/api/*` and `/ws` routed to the ALB as **one origin**; DynamoDB tables; ACM certificates; Route 53.
  - Deploys may briefly overlap old and new tasks (fencing makes this safe, ADR-0001 / C3).
  - CloudWatch: logs, a bytes-sent-per-connection metric, an **alarm at > 0.75 KB/s per user or > 50 concurrent users** (ADR-0016).
  - A deploy pipeline (*needs approval*: GitHub Actions to CDK deploy, or manual `cdk deploy` at first).
- **Exit criteria:** a staging deploy where a full floor is played end to end through CloudFront, the WebSocket stays up longer than the idle timeouts, and the alarm fires on a synthetic metric.
- **Depends on:** Phases 3–5; a domain name and an AWS account (setup tasks for you). You set up AWS Budgets yourself.

### Phase 7: Moderation, privacy, ads
- **Goal:** ready for the public.
- **Deliverables:**
  - Profanity filter on chat and handles (*library is open item §17.1*).
  - `DELETE /me`: removes the link between the internal ID and the Google account and handle, revokes sessions, closes connections; votes and chat stay but anonymized.
  - A privacy policy page and a consent banner (Google's CMP if AdSense is used).
  - The generic ad-slot component on the pause screen and sign-in screen, never during play; AdSense or no ads at launch (ADR-0014).
  - Minimal admin tooling for bans (*scope needs approval*: e.g. a CLI script that deletes a user's sessions and flags the account).
- **Exit criteria:** deletion verified in DynamoDB; banned users can't vote or chat; ads never render during play.
- **Depends on:** Phases 3–6.

### Phase 8: Load test and launch
- **Goal:** confirm the bandwidth and capacity assumptions, then launch.
- **Deliverables:**
  - A load test with k6 or Artillery (*needs approval*) using simulated voters at 100, 1,000 and stretch levels.
  - Measured bytes per user against the ~0.25 KB/s estimate, CPU and memory headroom on the Fargate task.
  - A launch checklist: alarms, budget alerts (yours), backups/PITR on the turn log, a rollback procedure, and a runbook for stale-leader and crash recovery.
- **Exit criteria:** 1,000 simulated users within budget estimates and with no dropped turns; checklist complete.

---

## 5. Testing strategy

- **Rules engine (Phase 1):** table-driven unit tests for every rule; seeded RNG for tie-breaks; property tests (e.g. "replaying events reproduces the state"); every floor file checked by the solver/validator in CI.
- **Server integration (Phases 2–4):** an in-process server with fake WebSocket clients; fake clocks for tick and pause timing; DynamoDB Local for persistence, fencing and replay tests.
- **Bot harness (`tools/`):** a headless version of the prototype's simulated players. Bots connect over real WebSockets, vote using a configurable "focus" (planner vs. random), and chat. It's used for development playtests, regression ("bots finish floor N"), and as the base of the Phase 8 load test.
- **Client:** component tests for vote controls, tally and pause states; manual device testing for layout and touch; XSS test strings in chat.
- **Contract:** Zod schemas in `shared` are used by both sides, so a protocol change fails typecheck or tests on both client and server.

---

## 6. Open items that block specific phases

| Item | Source | Blocks |
|---|---|---|
| Remaining rules for v1 mechanics | Game design §17.3–17.6 | Phase 1 (each mechanic's module) |
| Static terrain encoding in `FloorState.tiles` | API §9.1 | Phase 2 (protocol) |
| Snapshot frequency and retention | Game design §17.2 | Phase 4 |
| DynamoDB table schemas | This plan | Phase 4 |
| Profanity filter library | Game design §17.1 | Phase 7 (handles in Phase 3 skip the filter until then) |
| REST rate limits | API §9.2 | Phase 3 / Phase 7 |
| Admin/ban tooling scope | This plan | Phase 7 |
| Launch floors (count, content) | Designer (you) | Phase 8; at least one test floor needed for Phase 2 |
| Google OAuth client, domain, AWS account | Setup (you) | Phases 3 and 6 |

---

## 7. Risks

- **Ideas under exploration could change the protocol.** Large floors, fog of war and hidden traps all require the server to send *partial* floor state, while `welcome` and `floor_changed` currently send the whole floor. Darkness is now in v1, so incremental reveal is required: design `FloorState` and the turn deltas from Phase 1 so tiles and entities can be revealed incrementally.
- **Single point of failure.** One Fargate task means a crash or deploy pauses play for 30–60 s. Accepted (ADR-0007); fencing and replay must be solid, so they get dedicated tests in Phase 4.
- **WebSockets through CloudFront and the ALB:** idle timeouts and connection limits need checking. Mitigation: `ping` heartbeat interval below both timeouts; verify in the Phase 6 staging test.
- **Bandwidth and cost** could exceed estimates if chat grows. Mitigation: built-in reductions, the CloudWatch alarm, and Phase 8 measurement.
- **Democracy may be too easy** with today's mechanics. The playtest showed difficulty depends on puzzle design. Mitigation: the floor format and engine are extensible, and the puzzle mechanics brainstorm runs in parallel with building.
- **Cold start:** the game needs players at once. Mitigation: low minimums on early floors (already decided) and an easy share flow.
- **Cost estimates are unverified** (ADR-0007). Mitigation: your Budgets alerts and the Phase 8 measurement.

---

## Items needing your approval

2. Deploy pipeline: GitHub Actions to CDK, or manual at first (Phase 6).
3. Admin/ban tooling scope (Phase 7).
4. Load test tool: k6 or Artillery (Phase 8).
