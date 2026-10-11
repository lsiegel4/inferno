import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { isAllowedOrigin, readCookie } from "./auth/origin.js";
import { type Auth, SESSION_COOKIE } from "./auth/sessions.js";
import { hashToken } from "./auth/tokens.js";
import type { Conn, GameRoom, Identity } from "./room.js";
import type { SocketRegistry } from "./sockets.js";

export interface WsDeps {
  room: GameRoom;
  auth: Auth | null;
  sockets: SocketRegistry;
  allowedOrigin: string;
}

function reject(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Serve the game WebSocket at /ws. The upgrade must come from the game's origin (prevents
 * cross-site WebSocket hijacking); the session cookie, if valid, makes the connection a player.
 */
export function attachWebSocket(server: Server, deps: WsDeps): WebSocketServer {
  const { room, auth, sockets, allowedOrigin } = deps;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return reject(socket, "404 Not Found");
    if (!isAllowedOrigin(req.headers.origin, allowedOrigin)) return reject(socket, "403 Forbidden");

    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    void (async () => {
      const user = auth ? await auth.resolve(token) : undefined;
      const identity: Identity | null = user ? { userId: user.id, handle: user.handle } : null;
      wss.handleUpgrade(req, socket, head, (ws) => {
        const conn: Conn = {
          send: (msg) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
          },
        };
        const unregister = user && token ? sockets.add(hashToken(token), ws) : () => {};
        room.connect(conn, identity);
        ws.on("message", (data) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(String(data));
          } catch {
            room.receiveMalformed(conn);
            return;
          }
          room.receive(conn, parsed);
        });
        ws.on("close", () => {
          unregister();
          room.disconnect(conn);
        });
      });
    })().catch(() => reject(socket, "500 Internal Server Error"));
  });

  return wss;
}
