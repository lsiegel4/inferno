import {
  createGame,
  parseFloor,
  PROTOCOL_VERSION,
  type Action,
  type ClientMessage,
  type FloorDef,
  type ServerMessage,
} from "@inferno/shared";
import { describe, expect, it } from "vitest";
import { RULES } from "./config.js";
import { MemoryGameLog } from "./persistence/memory.js";
import { recoverGame } from "./recovery.js";
import { GameRoom, type Conn } from "./room.js";
import { FakeClock } from "./testing.js";

const right: Action = { kind: "move", dir: "right" };
const left: Action = { kind: "move", dir: "left" };

function floor(index: number, rows: string[], minimumPlayers = 1, legend = {}): FloorDef {
  return parseFloor(rows.join("\n"), { id: `f${index}`, index, minimumPlayers, legend });
}

const corridor = (min = 1) => [floor(1, ["#######", "#S...U#", "#######"], min)];

function setup(
  floors: FloorDef[] = corridor(),
  rng: () => number = () => 0,
  log = new MemoryGameLog(),
) {
  const clock = new FakeClock();
  const room = new GameRoom(createGame(floors), clock, rng, { log });

  function client(name: string | null) {
    const inbox: ServerMessage[] = [];
    const conn: Conn = { send: (m) => inbox.push(m) };
    room.connect(conn, name ? { userId: `u:${name}`, handle: name } : null);
    const send = <T extends ClientMessage["type"]>(
      type: T,
      data: Extract<ClientMessage, { type: T }>["data"],
    ) => room.receive(conn, { v: PROTOCOL_VERSION, type, data });
    const of = <T extends ServerMessage["type"]>(type: T) =>
      inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
    const errors = () => of("error").map((m) => m.data.code);
    return {
      conn,
      inbox,
      send,
      of,
      errors,
      vote: (tick: number, action: Action) => send("vote", { tick, action }),
    };
  }

  /**
   * Connect, say hello, and press Ready. Ready only counts while paused, so tests that need
   * N active players use a floor whose minimum is N.
   */
  function player(name: string) {
    const c = client(name);
    c.send("hello", {});
    c.send("ready", {});
    return c;
  }

  return { clock, room, client, player };
}

describe("connections", () => {
  it("requires hello first, then sends a welcome", () => {
    const { client } = setup();
    const c = client("ana");
    c.send("ready", {});
    expect(c.errors()).toEqual(["BAD_MESSAGE"]);
    c.send("hello", {});
    const welcome = c.of("welcome")[0]!.data;
    expect(welcome.you).toEqual({ role: "player", userId: "u:ana", handle: "ana" });
    expect(welcome.turn).toBe(0);
    expect(welcome.tally).toBeNull();
    expect(welcome.presence).toEqual({ active: 0, minimum: 1, spectators: 1, paused: true });
  });

  it("rejects malformed messages", () => {
    const { client, room } = setup();
    const c = client("ana");
    c.send("hello", {});
    room.receive(c.conn, { v: 1, type: "vote", data: { tick: "x" } });
    room.receiveMalformed(c.conn);
    expect(c.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE"]);
  });

  it("spectators cannot vote, ready or chat", () => {
    const { client } = setup();
    const s = client(null);
    s.send("hello", {});
    expect(s.of("welcome")[0]!.data.you).toEqual({ role: "spectator" });
    s.send("ready", {});
    s.vote(0, right);
    s.send("chat_send", { text: "hi" });
    expect(s.errors()).toEqual(["NOT_AUTHENTICATED", "NOT_AUTHENTICATED", "NOT_AUTHENTICATED"]);
  });

  it("a second connection for the same account replaces the first", () => {
    const { client } = setup();
    const first = client("ana");
    first.send("hello", {});
    const second = client("ana");
    second.send("hello", {});
    expect(first.of("session_replaced")).toHaveLength(1);
    first.send("ready", {});
    expect(first.errors()).toEqual(["NOT_AUTHENTICATED"]);
  });
});

describe("pausing", () => {
  it("starts paused; Ready resumes once the minimum is met", () => {
    const { player } = setup(corridor(2));
    const a = player("ana");
    expect(a.of("resumed")).toHaveLength(0);
    a.vote(0, right);
    expect(a.errors()).toEqual(["PAUSED"]);
    player("bo");
    expect(a.of("resumed")).toHaveLength(1);
  });

  it("Ready is only accepted while paused", () => {
    const { player } = setup();
    const a = player("ana");
    a.send("ready", {});
    expect(a.errors()).toEqual(["NOT_PAUSED"]);
  });

  it("pauses only after active players stay below the minimum for the grace period", () => {
    const { clock, player } = setup(corridor(2));
    const a = player("ana");
    player("bo"); // both Ready at t=0; Bo then goes quiet
    clock.advance(55_000);
    a.vote(0, left); // Ana stays active
    // Bo drops out of the 60 s window at t=60 s; the game pauses 10 s later.
    clock.advance(14_999);
    expect(a.of("paused")).toHaveLength(0);
    clock.advance(1);
    expect(a.of("paused")).toHaveLength(1);
  });

  it("chat does not count as activity", () => {
    const { clock, player } = setup();
    const a = player("ana");
    for (let t = 0; t < RULES.activityWindowMs + RULES.pauseGraceMs; t += 5_000) {
      a.send("chat_send", { text: "still here" });
      clock.advance(5_000);
    }
    expect(a.of("paused")).toHaveLength(1);
  });
});

describe("vote ticks", () => {
  it("a tick opens on the first vote and closes after 3 s if not everyone voted", () => {
    const { clock, player } = setup(corridor(2));
    const a = player("ana");
    player("bo");
    a.vote(0, right);
    expect(a.of("tally")[0]!.data).toMatchObject({ tick: 0, voted: 1, active: 2 });
    clock.advance(RULES.tickMaxMs - 1);
    expect(a.of("turn")).toHaveLength(0);
    clock.advance(1);
    expect(a.of("turn")[0]!.data).toMatchObject({ turn: 1, action: right, hero: { x: 2, y: 1 } });
  });

  it("ends early once every active player voted, but never before 1 s", () => {
    const { clock, player } = setup(corridor(2));
    const a = player("ana");
    const b = player("bo");
    a.vote(0, right);
    b.vote(0, right);
    clock.advance(RULES.tickMinMs - 1);
    expect(a.of("turn")).toHaveLength(0);
    clock.advance(1);
    expect(a.of("turn")).toHaveLength(1);

    clock.advance(500);
    a.vote(1, right);
    clock.advance(1_500);
    b.vote(1, right); // already past the minimum: closes immediately
    expect(a.of("turn")).toHaveLength(2);
  });

  it("plurality wins; ties are broken with the injected rng", () => {
    const first = setup(corridor(), () => 0);
    const a = first.player("ana");
    const b = first.player("bo");
    a.vote(0, right);
    b.vote(0, left);
    first.clock.advance(RULES.tickMinMs);
    expect(a.of("turn")[0]!.data.action).toEqual(right);

    const second = setup(corridor(), () => 0.99);
    const c = second.player("ana");
    const d = second.player("bo");
    c.vote(0, right);
    d.vote(0, left);
    second.clock.advance(RULES.tickMinMs);
    expect(c.of("turn")[0]!.data.action).toEqual(left);
  });

  it("passes the crowd's support and runner-up to the engine, records and replays it", async () => {
    const floors = [
      floor(1, ["########", "#S...e.#", "########"], 3, { e: { id: "e", kind: "echo" } }),
    ];
    const log = new MemoryGameLog();
    const { clock, player, room } = setup(floors, () => 0, log);
    const [a, b, c] = [player("ana"), player("bo"), player("cy")];
    a.vote(0, { kind: "wait" });
    b.vote(0, { kind: "wait" });
    c.vote(0, left);
    clock.advance(RULES.tickMinMs);
    const turn = a.of("turn")[0]!.data;
    expect(turn.crowd).toEqual({ support: 2 / 3, dissent: left });
    expect(turn.changes).toContainEqual(expect.objectContaining({ id: "e", x: 4, y: 1 }));
    expect(log.turns[0]!.record.crowd).toEqual({ support: 2 / 3, dissent: left });
    const recovered = await recoverGame(floors, log);
    expect(recovered.state).toEqual(room.gameState);
  });

  it("one vote per tick, for the current tick only", () => {
    const { player } = setup(corridor(2));
    const a = player("ana");
    player("bo");
    a.vote(1, right);
    a.vote(0, right);
    a.vote(0, left);
    expect(a.errors()).toEqual(["STALE_TICK", "ALREADY_VOTED"]);
  });

  it("invalid actions still use the turn", () => {
    const { clock, player } = setup();
    const a = player("ana");
    a.vote(0, { kind: "interact" });
    clock.advance(RULES.tickMinMs);
    expect(a.of("turn")[0]!.data).toMatchObject({ turn: 1, outcome: "no_effect" });
  });

  it("tally updates are batched to at most one per second", () => {
    const { clock, player } = setup(corridor(4));
    const players = ["a", "b", "c", "d"].map(player);
    players[0]!.vote(0, right);
    players[1]!.vote(0, right);
    players[2]!.vote(0, left);
    expect(players[0]!.of("tally")).toHaveLength(1); // the opening tally only
    clock.advance(RULES.broadcastIntervalMs);
    expect(players[0]!.of("tally").at(-1)!.data.voted).toBe(3);
  });
});

describe("turn messages", () => {
  it("sends floor changes, game over, and history", async () => {
    const floors = [floor(1, ["#####", "#SU.#", "#####"]), floor(2, ["#####", "#SU.#", "#####"])];
    const { clock, player, room } = setup(floors);
    const a = player("ana");
    a.vote(0, right);
    clock.advance(RULES.tickMinMs);
    expect(a.of("turn")[0]!.data).toMatchObject({ outcome: "floor_up", changes: [] });
    expect(a.of("floor_changed")[0]!.data.floor.floorId).toBe("f2");
    a.vote(1, right);
    clock.advance(RULES.tickMinMs);
    expect(a.of("game_over")[0]!.data).toEqual({ turn: 2 });
    a.vote(2, right);
    expect(a.errors()).toEqual(["GAME_OVER"]);

    expect(await room.historyPage(0, 1)).toMatchObject({ turns: [{ turn: 1 }], nextCursor: "1" });
    expect(await room.historyPage(1, 10)).toMatchObject({ turns: [{ turn: 2 }], nextCursor: null });
  });

  it("includes sign text and inventory changes", () => {
    const floors = [
      floor(1, ["#######", "#Sk.sU#", "#######"], 1, {
        k: { id: "key-1", kind: "item", item: "key", opens: "red" },
        s: { id: "sign-1", kind: "sign", text: "Hello" },
      }),
    ];
    const { clock, player } = setup(floors);
    const a = player("ana");
    const play = (action: Action) => {
      a.vote(a.of("turn").length, action);
      clock.advance(RULES.tickMinMs);
      return a.of("turn").at(-1)!.data;
    };
    play(right); // bump into the key: turn in place, facing it
    expect(play({ kind: "interact" }).inventory).toEqual([{ id: "key-1", type: "key" }]);
    play(right);
    play(right);
    play(right); // bump into the sign
    expect(play({ kind: "interact" }).sign).toEqual({ text: "Hello" });
  });
});

describe("darkness", () => {
  it("turn messages carry revealed and hidden tiles", () => {
    const dark = parseFloor("#######\n#S...U#\n#######", {
      id: "f1",
      index: 1,
      minimumPlayers: 1,
      reveal: { mode: "torchlight", radius: 1 },
    });
    const { clock, player } = setup([dark]);
    const a = player("ana");
    expect(a.of("welcome")[0]!.data.floor.tiles).toBe(" #     \n#S.    \n #     ");
    a.vote(0, right);
    clock.advance(RULES.tickMinMs);
    const turn = a.of("turn")[0]!.data;
    expect(turn.revealed).toEqual([
      { x: 2, y: 0, ch: "#" },
      { x: 3, y: 1, ch: "." },
      { x: 2, y: 2, ch: "#" },
    ]);
    expect(turn.hidden).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ]);
  });
});

describe("chat", () => {
  it("broadcasts messages, rate-limits, and rejects long ones", () => {
    const { clock, player } = setup();
    const a = player("ana");
    const b = player("bo");
    a.send("chat_send", { text: "go right" });
    expect(b.of("chat_message")[0]!.data).toMatchObject({ handle: "ana", text: "go right" });
    a.send("chat_send", { text: "again" });
    expect(a.of("error")[0]!.data).toMatchObject({ code: "RATE_LIMITED", retryAfterMs: 2_000 });
    clock.advance(RULES.chatIntervalMs);
    a.send("chat_send", { text: "x".repeat(201) });
    expect(a.errors()).toEqual(["RATE_LIMITED", "CHAT_TOO_LONG"]);
  });
});
