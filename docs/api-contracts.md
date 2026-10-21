# Inferno — API Contracts

Status: Draft v2 · Last updated: 2026-10-04 (democracy-only, [ADR-0017](adr/0017-democracy-only-input.md))

Related: [Game design](game-design.md) · [ADRs](adr/)

All types are TypeScript and are intended to live in a shared package used by both client and server ([ADR-0013](adr/0013-typescript-react-canvas.md)).

---

## 1. Transport

| Channel | URL | Purpose |
|---|---|---|
| REST | `https://<host>/api/v1/...` | Auth, profile, history, deletion, health |
| WebSocket | `wss://<host>/ws` | All live gameplay, presence, chat |

- **Single origin:** CloudFront serves the frontend and routes `/api/*` and `/ws` to the ALB, which forwards to the game process ([ADR-0008](adr/0008-websockets-via-alb.md), [ADR-0018](adr/0018-sessions-opaque-token-httponly-cookie.md)). No CORS.
- Server → client traffic is kept small by design: deltas only, one message per turn, presence batched at 1/s ([ADR-0016](adr/0016-bandwidth-approach.md)).
- Encoding: JSON at launch. The envelope is designed so a binary codec (MessagePack/protobuf) can be swapped in later.

### 1.1 WebSocket envelope

```ts
interface Envelope<T extends string, D> {
  v: 1;          // protocol version
  type: T;       // message type
  data: D;
}
```

Unknown `type` values must be ignored by the client (forward compatibility).

---

## 2. Authentication

1. Client uses Google Identity Services to obtain a Google **ID token**.
2. Client calls `POST /api/v1/auth/google` with it.
3. Server verifies the token (signature, `aud`, `iss`, `exp`) with `google-auth-library`, looks up or creates the internal user keyed by Google `sub`, creates a session, and sets it as a cookie ([ADR-0010](adr/0010-google-signin-server-verification.md), [ADR-0018](adr/0018-sessions-opaque-token-httponly-cookie.md)). The Google ID token is discarded.
4. The browser sends the cookie automatically on REST calls and on the WebSocket upgrade. No token appears in JavaScript, URLs, or messages.

### 2.1 Session cookie

| Property | Value |
|---|---|
| Name | `inferno_session` |
| Value | Opaque random token (≥ 256 bits); server stores only its hash |
| Flags | `HttpOnly; Secure; SameSite=Lax; Path=/` |
| Lifetime | 30-day sliding expiry (extended on use); no absolute cap |
| Storage | DynamoDB sessions table, TTL-expired; keyed by token hash, indexed by user ID |

- **Logout** (`POST /api/v1/auth/logout`) deletes the session and clears the cookie.
- **Account deletion or ban** deletes all of that user's sessions and closes their connections.
- **Multiple devices:** a user may be logged in on several devices; only one *live game connection* counts (see below).
- **Origin checks:** the WebSocket upgrade and all state-changing REST calls (`POST`, `PUT`, `DELETE`) reject requests whose `Origin` header is not the game's origin.

Connections without a valid session cookie are **spectators**: they receive all broadcasts but may not send `vote`, `ready`, or `chat_send`.

**One live session per account:** if an account opens a second connection, the older connection receives `session_replaced` and is demoted to spectator ([ADR-0011](adr/0011-account-based-counting-single-session.md)).

---

## 3. REST endpoints

### `POST /api/v1/auth/google`

```ts
// Request
{ idToken: string }
// 200 (sets the inferno_session cookie)
{ user: { id: string; handle: string; isNew: boolean } }
// 401 { error: "INVALID_GOOGLE_TOKEN" }
// 503 { error: "AUTH_NOT_CONFIGURED" }  (server started without a Google client id)
```

New users receive a randomly generated handle.

### `POST /api/v1/auth/logout` *(auth)*

Deletes the current session, clears the cookie, and closes that session's WebSocket connections (close code 4001; the client reconnects as a spectator).

```ts
// 204
```

### `GET /api/v1/me` *(auth)*

Every authenticated REST response re-sends the session cookie, so the browser's cookie expiry slides too. The client should call `GET /me` on page load.

```ts
// 200
{ id: string; handle: string }
```

### `PUT /api/v1/me/handle` *(auth)*

```ts
// Request
{ handle: string }   // 3–20 chars, [A-Za-z0-9_], unique, profanity-filtered
// 200 { handle: string }
// 409 { error: "HANDLE_TAKEN" }
// 422 { error: "HANDLE_INVALID" | "HANDLE_PROFANE" }
```

### `DELETE /api/v1/me` *(auth)*

Removes the internal user ID ↔ Google `sub` and handle mapping. Stored votes and chat remain but become anonymous ([ADR-0012](adr/0012-data-minimization.md)). Active sessions are closed.

```ts
// 204
```

### `GET /api/v1/history?cursor=<string>&limit=<1..500>`

Pages through the hero turn log (no player names). Available after game over for the read-only site.

```ts
// 200
{
  turns: TurnRecord[];
  nextCursor: string | null;
}

interface TurnRecord {
  turn: number;          // global, monotonically increasing
  floorId: string;
  action: Action;
  at: string;            // ISO 8601
  outcome?: "died" | "floor_up" | "floor_down" | "fell" | "no_effect";
}
```

### `GET /api/v1/health`

```ts
// 200 { ok: true; leader: boolean }
```

---

## 4. Shared types

```ts
type Direction = "up" | "down" | "left" | "right";

type Action =
  | { kind: "move"; dir: Direction }   // into a wall = turn in place (consumes a turn)
  | { kind: "jump" }                   // one tile in facing direction
  | { kind: "interact" }               // tile the hero faces
  | { kind: "use"; itemId: string }
  | { kind: "wait" };                  // pass a turn; the world advances

interface Hero { x: number; y: number; facing: Direction }

interface Entity {
  id: string;
  kind: string;          // e.g. "door", "lever", "block", "plate", "platform", "gate", "roadblock", "sign", "light", "stairs_up", "stairs_down", "pit"
  x: number;
  y: number;
  state?: Record<string, unknown>;   // e.g. { open: true }, { cleared: true }
}

interface FloorState {
  floorId: string;
  index: number;                     // 1-based floor number
  width: number;
  height: number;
  tiles: string;                     // terrain rows joined by "\n"; unrevealed tiles are " "
  explored: string;                  // explored-floor map terrain, same encoding; unexplored tiles are " "
  // entities: those on tiles that are revealed now or explored (the floor map shows the latter)
  entities: Entity[];
  minimumPlayers: number;
}

interface InventoryItem {
  id: string;            // instance id, used in use(itemId)
  type: "key" | "torch" | "weight";
}

interface Presence {
  active: number;
  minimum: number;
  spectators: number;
  paused: boolean;
}
```

---

## 5. WebSocket: client → server

| Type | Auth | Counts as activity | Data |
|---|---|---|---|
| `hello` | — | No | `{}` — must be first message; identity comes from the session cookie sent on the upgrade |
| `vote` | Yes | Yes | `{ tick: number; action: Action }` — one per tick, not changeable |
| `ready` | Yes | Yes | `{}` — only accepted while paused |
| `chat_send` | Yes | **No** | `{ text: string }` — ≤ 200 chars |
| `ping` | — | No | `{}` — heartbeat (online presence) |

---

## 6. WebSocket: server → client

### `welcome` — sent once after `hello`

```ts
{
  you: { role: "player"; userId: string; handle: string } | { role: "spectator" };
  turn: number;
  floor: FloorState;
  hero: Hero;
  inventory: InventoryItem[];
  presence: Presence;
  tally: Tally | null;               // open tick, or null if nobody has voted yet
  recentTurns: TurnRecord[];         // to seed the event log
  recentChat: ChatMessage[];
  gameOver: boolean;
}
```

### `turn` — one per applied hero action (at most one per tick)

```ts
{
  turn: number;
  action: Action;
  hero: Hero;
  changes: Entity[];                 // only entities whose position/state changed
  inventory?: InventoryItem[];       // present only if it changed
  sign?: { text: string };           // a sign was read this turn: show a 2 s overlay and log it
  revealed?: { x: number; y: number; ch: string }[]; // darkness: tiles that became visible
  hidden?: { x: number; y: number }[];               // darkness: tiles that went dark
  explored?: { x: number; y: number; ch: string }[]; // tiles newly added to the explored floor map
  // Entities that become visible (newly lit) are included in `changes`; ones that go dark are sent with state.hidden: true.
  outcome?: "died" | "floor_up" | "floor_down" | "fell" | "no_effect";
}
```

If `outcome` causes a floor change, a `floor_changed` message follows.

### `floor_changed`

```ts
{ floor: FloorState; hero: Hero }
```

### `presence` — batched, at most 1/s

```ts
Presence
```

### `paused` / `resumed`

```ts
{ presence: Presence }
```

### `tally` — current tick, at most 1/s (plus once when a tick opens)

```ts
interface Tally {
  tick: number;
  endsAt: string;                    // ISO 8601; maximum end (3 s after the first vote) — ends early once every active player has voted, never before 1 s
  voted: number;                     // voters so far this tick
  active: number;                    // active players (early end when voted === active)
  counts: { action: Action; votes: number }[];
}
```

### `chat_message`

```ts
interface ChatMessage {
  id: string;
  handle: string;
  text: string;                      // already profanity-filtered
  at: string;
}
```

### `session_replaced`

```ts
{}   // this connection is now a spectator
```

### `game_over`

```ts
{ turn: number }
```

### `error`

```ts
{
  code: ErrorCode;
  ref?: string;        // the client message type that caused it
  retryAfterMs?: number;
}
```

---

## 7. Error codes

| Code | Meaning |
|---|---|
| `NOT_AUTHENTICATED` | Action requires sign-in |
| `INVALID_SESSION` | Session cookie missing, invalid, or expired |
| `BAD_ORIGIN` | Request `Origin` is not the game's origin |
| `RATE_LIMITED` | Per-user limit exceeded (`retryAfterMs` set) |
| `PAUSED` | `vote` sent while paused |
| `STALE_TICK` | `vote` for a tick that has already closed |
| `ALREADY_VOTED` | Second vote in the same tick |
| `NOT_PAUSED` | `ready` sent while not paused |
| `CHAT_TOO_LONG` | > 200 chars |
| `GAME_OVER` | Any gameplay message after game over |
| `BAD_MESSAGE` | Malformed message |

---

## 8. Rate limits

| Message | Limit |
|---|---|
| `vote` | 1 per tick per user |
| `chat_send` | 1 per 2 seconds per user |

---

## 9. Open items

1. REST rate limits.
