/** Entry point: load floors, start the game room, serve HTTP and WebSocket. */
import { resolve } from "node:path";
import { createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { GoogleIdTokenVerifier } from "./auth/google.js";
import { Auth } from "./auth/sessions.js";
import { MemorySessionStore, MemoryUserStore } from "./auth/stores.js";
import { systemClock } from "./clock.js";
import { buildHttp } from "./http.js";
import { GameRoom } from "./room.js";
import { SocketRegistry } from "./sockets.js";
import { attachWebSocket } from "./ws.js";

const port = Number(process.env.PORT ?? 3000);
const floorsDir = resolve(process.env.FLOORS_DIR ?? "../../floors");
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const googleClientId = process.env.GOOGLE_CLIENT_ID;

const room = new GameRoom(createGame(loadFloorsFromDir(floorsDir)), systemClock);
const users = new MemoryUserStore();
const auth = googleClientId
  ? new Auth(
      users,
      new MemorySessionStore(),
      new GoogleIdTokenVerifier(googleClientId),
      systemClock,
    )
  : null;
const sockets = new SocketRegistry();

const app = buildHttp({ room, auth, users, sockets, allowedOrigin });
await app.listen({ port, host: "0.0.0.0" });
attachWebSocket(app.server, { room, auth, sockets, allowedOrigin });
console.log(`Inferno server on :${port} (origin ${allowedOrigin}, floors ${floorsDir})`);
if (!auth)
  console.warn("GOOGLE_CLIENT_ID is not set: sign-in is disabled, everyone is a spectator.");
