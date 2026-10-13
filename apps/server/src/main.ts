/** Entry point: load floors, recover the game, serve HTTP and WebSocket. */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { GoogleIdTokenVerifier } from "./auth/google.js";
import { Auth } from "./auth/sessions.js";
import {
  MemorySessionStore,
  MemoryUserStore,
  type SessionStore,
  type UserStore,
} from "./auth/stores.js";
import { systemClock } from "./clock.js";
import { buildHttp } from "./http.js";
import { DynamoGameLog } from "./persistence/dynamo/game-log.js";
import { Lease } from "./persistence/dynamo/lease.js";
import { DynamoSessionStore } from "./persistence/dynamo/sessions.js";
import { createTables, documentClient, tableNames } from "./persistence/dynamo/tables.js";
import { DynamoUserStore } from "./persistence/dynamo/users.js";
import { MemoryGameLog } from "./persistence/memory.js";
import type { GameLog } from "./persistence/types.js";
import { recoverGame } from "./recovery.js";
import { GameRoom } from "./room.js";
import { SocketRegistry } from "./sockets.js";
import { attachWebSocket } from "./ws.js";

const env = process.env;
const port = Number(env.PORT ?? 3000);
const floorsDir = resolve(env.FLOORS_DIR ?? "../../floors");
const allowedOrigin = env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const storage = env.STORAGE ?? "memory";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let log: GameLog = new MemoryGameLog();
let users: UserStore = new MemoryUserStore();
let sessions: SessionStore = new MemorySessionStore();
let lease: Lease | null = null;

if (storage === "dynamodb") {
  const db = documentClient(env.DYNAMODB_ENDPOINT);
  const tables = tableNames(env.TABLE_PREFIX ?? "inferno-");
  if (env.DYNAMODB_ENDPOINT) await createTables(db, tables); // DynamoDB Local only
  lease = new Lease(db, tables.lease, randomUUID(), systemClock);
  // Only one server may run the game: wait for the lease (a previous server's expires in ≤ 30 s).
  while (!(await lease.tryAcquire())) {
    console.log("Another server holds the game lease; retrying in 5 s");
    await sleep(5_000);
  }
  log = new DynamoGameLog(db, tables, lease, systemClock);
  users = new DynamoUserStore(db, tables.users);
  sessions = new DynamoSessionStore(db, tables.sessions);
} else if (storage !== "memory") {
  throw new Error(`STORAGE must be "memory" or "dynamodb", got "${storage}"`);
}

const exitStale = () => {
  console.error("Another server took over the game; exiting.");
  process.exit(1);
};

const floors = loadFloorsFromDir(floorsDir);
const recovered = await recoverGame(floors, log);
const room = new GameRoom(recovered.state, systemClock, Math.random, {
  log,
  recentTurns: recovered.recentTurns,
  recentChat: recovered.recentChat,
  onStale: exitStale,
});
const auth = env.GOOGLE_CLIENT_ID
  ? new Auth(users, sessions, new GoogleIdTokenVerifier(env.GOOGLE_CLIENT_ID), systemClock)
  : null;
const sockets = new SocketRegistry();

const app = buildHttp({ room, auth, users, sockets, allowedOrigin });
await app.listen({ port, host: "0.0.0.0" });
attachWebSocket(app.server, { room, auth, sockets, allowedOrigin });
console.log(
  `Inferno server on :${port} (storage ${storage}, turn ${recovered.state.turn}, origin ${allowedOrigin})`,
);
if (!auth)
  console.warn("GOOGLE_CLIENT_ID is not set: sign-in is disabled, everyone is a spectator.");

if (lease) {
  const held = lease;
  setInterval(() => {
    held.renew().then(
      (ok) => ok || exitStale(),
      (e: unknown) => console.error("lease renewal failed", e),
    );
  }, held.ttlMs / 3);
}

// Graceful shutdown (deploys): stop the game, hand the lease over at once, close connections.
process.on("SIGTERM", () => {
  room.stop();
  void (async () => {
    await lease?.release().catch(() => {});
    await app.close();
    process.exit(0);
  })();
});
