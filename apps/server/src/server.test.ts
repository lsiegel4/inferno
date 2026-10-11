import type { AddressInfo } from "node:net";
import { createGame, parseFloor, type ServerMessage } from "@inferno/shared";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Auth } from "./auth/sessions.js";
import { MemorySessionStore, MemoryUserStore } from "./auth/stores.js";
import { systemClock } from "./clock.js";
import { buildHttp } from "./http.js";
import { GameRoom } from "./room.js";
import { SocketRegistry } from "./sockets.js";
import { fakeVerifier } from "./testing.js";
import { attachWebSocket } from "./ws.js";

const ORIGIN = "http://localhost:5173";
const floors = [parseFloor("#####\n#S.U#\n#####", { id: "f1", index: 1, minimumPlayers: 1 })];
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function start({ authEnabled = true } = {}) {
  const room = new GameRoom(createGame(floors), systemClock);
  const users = new MemoryUserStore();
  const auth = authEnabled
    ? new Auth(users, new MemorySessionStore(), fakeVerifier, systemClock)
    : null;
  const sockets = new SocketRegistry();
  const app = buildHttp({ room, auth, users, sockets, allowedOrigin: ORIGIN });
  await app.listen({ port: 0, host: "127.0.0.1" });
  attachWebSocket(app.server, { room, auth, sockets, allowedOrigin: ORIGIN });
  cleanup.push(async () => {
    room.stop();
    await app.close();
  });
  const port = (app.server.address() as AddressInfo).port;

  /** Sign in and return the session cookie ("inferno_session=...") and the response. */
  async function signIn(sub = "alice") {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      headers: { origin: ORIGIN },
      payload: { idToken: `good:${sub}` },
    });
    const setCookie = String(res.headers["set-cookie"]);
    return { res, setCookie, cookie: setCookie.split(";")[0]! };
  }

  return { app, port, room, signIn };
}

function connect(port: number, headers: Record<string, string>) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
  const inbox: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  ws.on("message", (d) => {
    inbox.push(JSON.parse(String(d)) as ServerMessage);
    waiters.splice(0).forEach((w) => w());
  });
  const next = async <T extends ServerMessage["type"]>(type: T) => {
    for (;;) {
      const found = inbox.find((m) => m.type === type);
      if (found) return found as Extract<ServerMessage, { type: T }>;
      await new Promise<void>((r) => waiters.push(r));
    }
  };
  const opened = new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("unexpected-response", (_req, res) => reject(new Error(String(res.statusCode))));
    ws.on("error", reject);
  });
  const closed = new Promise<number>((r) => ws.on("close", (code) => r(code)));
  cleanup.push(async () => ws.close());
  const hello = () => ws.send(JSON.stringify({ v: 1, type: "hello", data: {} }));
  return { ws, next, opened, closed, hello };
}

describe("sign-in", () => {
  it("sets an HttpOnly, Secure, SameSite=Lax session cookie for 30 days", async () => {
    const { signIn } = await start();
    const { res, setCookie } = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ isNew: true });
    expect(setCookie).toMatch(/^inferno_session=[\w-]{43};/);
    expect(setCookie).toContain("Max-Age=2592000");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("rejects state-changing requests from other origins", async () => {
    const { app } = await start();
    for (const origin of [undefined, "https://evil.example"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/google",
        headers: origin ? { origin } : {},
        payload: { idToken: "good:alice" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "BAD_ORIGIN" });
    }
  });

  it("rejects invalid Google tokens, and answers 503 when sign-in is not configured", async () => {
    const { app } = await start();
    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      headers: { origin: ORIGIN },
      payload: { idToken: "forged" },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ error: "INVALID_GOOGLE_TOKEN" });

    const off = await start({ authEnabled: false });
    expect((await off.signIn()).res.statusCode).toBe(503);
  });
});

describe("profile", () => {
  it("GET /me needs a valid session", async () => {
    const { app, signIn } = await start();
    expect((await app.inject("/api/v1/me")).json()).toEqual({ error: "NOT_AUTHENTICATED" });
    const stale = await app.inject({
      url: "/api/v1/me",
      headers: { cookie: "inferno_session=nope" },
    });
    expect(stale.json()).toEqual({ error: "INVALID_SESSION" });
    const { cookie } = await signIn();
    const me = await app.inject({ url: "/api/v1/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(String(me.headers["set-cookie"])).toContain("Max-Age=2592000"); // cookie expiry slides
  });

  it("PUT /me/handle validates, enforces uniqueness (ignoring case), and renames in game", async () => {
    const { app, signIn, port } = await start();
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const put = (cookie: string, handle: string) =>
      app.inject({
        method: "PUT",
        url: "/api/v1/me/handle",
        headers: { cookie, origin: ORIGIN },
        payload: { handle },
      });
    expect((await put(alice.cookie, "no spaces")).statusCode).toBe(422);
    expect((await put(alice.cookie, "Ana")).json()).toEqual({ handle: "Ana" });
    expect((await put(bob.cookie, "ana")).statusCode).toBe(409);

    const c = connect(port, { origin: ORIGIN, cookie: alice.cookie });
    await c.opened;
    c.hello();
    expect((await c.next("welcome")).data.you).toMatchObject({ role: "player", handle: "Ana" });
  });
});

describe("WebSocket auth", () => {
  it("rejects upgrades from other origins", async () => {
    const { port } = await start();
    await expect(connect(port, { origin: "https://evil.example" }).opened).rejects.toThrow("403");
    await expect(connect(port, {}).opened).rejects.toThrow("403");
  });

  it("signed-in connections are players; others are spectators", async () => {
    const { port, signIn } = await start();
    const { cookie } = await signIn();
    const player = connect(port, { origin: ORIGIN, cookie });
    await player.opened;
    player.hello();
    expect((await player.next("welcome")).data.you.role).toBe("player");

    const spectator = connect(port, { origin: ORIGIN });
    await spectator.opened;
    spectator.hello();
    expect((await spectator.next("welcome")).data.you).toEqual({ role: "spectator" });
  });

  it("logout closes that session's connections and invalidates the cookie", async () => {
    const { app, port, signIn } = await start();
    const { cookie } = await signIn();
    const c = connect(port, { origin: ORIGIN, cookie });
    await c.opened;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie, origin: ORIGIN },
    });
    expect(res.statusCode).toBe(204);
    expect(await c.closed).toBe(4001);
    const me = await app.inject({ url: "/api/v1/me", headers: { cookie } });
    expect(me.json()).toEqual({ error: "INVALID_SESSION" });
  });
});

describe("public endpoints", () => {
  it("serves health and history", async () => {
    const { app } = await start();
    expect((await app.inject("/api/v1/health")).json()).toEqual({ ok: true, leader: true });
    expect((await app.inject("/api/v1/history")).json()).toEqual({ turns: [], nextCursor: null });
    expect((await app.inject("/api/v1/history?limit=0")).statusCode).toBe(400);
  });
});
