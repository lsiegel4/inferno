import type { AddressInfo } from "node:net";
import { createGame, parseFloor, type ServerMessage } from "@inferno/shared";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { systemClock } from "./clock.js";
import { buildHttp } from "./http.js";
import { GameRoom } from "./room.js";
import { attachWebSocket } from "./ws.js";

const floors = [parseFloor("#####\n#S.U#\n#####", { id: "f1", index: 1, minimumPlayers: 1 })];
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function start(devAuth: boolean) {
  const room = new GameRoom(createGame(floors), systemClock);
  const app = buildHttp(room);
  await app.listen({ port: 0, host: "127.0.0.1" });
  attachWebSocket(app.server, room, { devAuth });
  cleanup.push(async () => {
    room.stop();
    await app.close();
  });
  return { app, port: (app.server.address() as AddressInfo).port };
}

function connect(port: number, query = "") {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
  const inbox: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  ws.on("message", (d) => {
    inbox.push(JSON.parse(String(d)) as ServerMessage);
    waiters.splice(0).forEach((w) => w());
  });
  const next = async (type: ServerMessage["type"]) => {
    for (;;) {
      const found = inbox.find((m) => m.type === type);
      if (found) return found;
      await new Promise<void>((r) => waiters.push(r));
    }
  };
  const open = new Promise<void>((r) => ws.on("open", () => r()));
  cleanup.push(async () => ws.close());
  return { ws, next, open };
}

describe("WebSocket transport", () => {
  it("dev login works only in development mode", async () => {
    const dev = await start(true);
    const c = connect(dev.port, "?dev_user=ana");
    await c.open;
    c.ws.send(JSON.stringify({ v: 1, type: "hello", data: {} }));
    const welcome = await c.next("welcome");
    expect(welcome.type === "welcome" && welcome.data.you).toMatchObject({
      role: "player",
      handle: "ana",
    });

    const prod = await start(false);
    const p = connect(prod.port, "?dev_user=ana");
    await p.open;
    p.ws.send(JSON.stringify({ v: 1, type: "hello", data: {} }));
    const w2 = await p.next("welcome");
    expect(w2.type === "welcome" && w2.data.you).toEqual({ role: "spectator" });
  });

  it("answers invalid JSON with BAD_MESSAGE", async () => {
    const { port } = await start(true);
    const c = connect(port);
    await c.open;
    c.ws.send("not json");
    const err = await c.next("error");
    expect(err.type === "error" && err.data.code).toBe("BAD_MESSAGE");
  });

  it("serves health and history over HTTP", async () => {
    const { app } = await start(false);
    expect((await app.inject("/api/v1/health")).json()).toEqual({ ok: true, leader: true });
    expect((await app.inject("/api/v1/history")).json()).toEqual({ turns: [], nextCursor: null });
    expect((await app.inject("/api/v1/history?limit=0")).statusCode).toBe(400);
  });
});
