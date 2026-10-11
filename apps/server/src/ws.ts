import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { HANDLE_PATTERN } from "@inferno/shared";
import { WebSocket, WebSocketServer } from "ws";
import type { Conn, GameRoom, Identity } from "./room.js";

export interface WsOptions {
  /** Accept `?dev_user=<name>` as a login. Development only; removed in Phase 3. */
  devAuth: boolean;
}

function devIdentity(url: URL, opts: WsOptions): Identity | null {
  const name = url.searchParams.get("dev_user");
  if (!opts.devAuth || !name || !HANDLE_PATTERN.test(name)) return null;
  return { userId: `dev:${name}`, handle: name };
}

/** Serve the game WebSocket at /ws on an existing HTTP server. */
export function attachWebSocket(server: Server, room: GameRoom, opts: WsOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn: Conn = {
        send: (msg) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
        },
      };
      room.connect(conn, devIdentity(url, opts));
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
      ws.on("close", () => room.disconnect(conn));
    });
  });

  return wss;
}
