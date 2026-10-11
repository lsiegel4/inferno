/** Entry point: load floors, start the game room, serve HTTP and WebSocket. */
import { resolve } from "node:path";
import { createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { systemClock } from "./clock.js";
import { buildHttp } from "./http.js";
import { GameRoom } from "./room.js";
import { attachWebSocket } from "./ws.js";

const port = Number(process.env.PORT ?? 3000);
const floorsDir = resolve(process.env.FLOORS_DIR ?? "../../floors");
const devAuth = process.env.NODE_ENV === "development";

const room = new GameRoom(createGame(loadFloorsFromDir(floorsDir)), systemClock);
const app = buildHttp(room);
await app.listen({ port, host: "0.0.0.0" });
attachWebSocket(app.server, room, { devAuth });
console.log(`Inferno server on :${port} (floors: ${floorsDir}${devAuth ? ", dev login on" : ""})`);
