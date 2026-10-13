/**
 * Integration tests against DynamoDB Local (`pnpm db:up`). Skipped when it is not reachable,
 * except in CI, where a missing database is a failure.
 */
import { randomUUID } from "node:crypto";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import {
  parseFloor,
  PROTOCOL_VERSION,
  serializeGame,
  type Action,
  type ClientMessage,
  type FloorDef,
} from "@inferno/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HandleTakenError } from "../../auth/stores.js";
import { RULES } from "../../config.js";
import { recoverGame } from "../../recovery.js";
import { GameRoom, type Conn } from "../../room.js";
import { FakeClock } from "../../testing.js";
import { StaleLeaderError } from "../types.js";
import { DynamoGameLog } from "./game-log.js";
import { Lease } from "./lease.js";
import { DynamoSessionStore } from "./sessions.js";
import { createTables, deleteTables, documentClient, tableNames } from "./tables.js";
import { DynamoUserStore } from "./users.js";

const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const db = documentClient(endpoint);
const tables = tableNames(`test-${randomUUID().slice(0, 8)}-`);
const available = await db
  .send(new ListTablesCommand({}))
  .then(() => true)
  .catch(() => false);
if (!available && process.env.CI) throw new Error(`DynamoDB Local is not reachable at ${endpoint}`);

/** A corridor floor long enough for many turns: the hero walks back and forth. */
const floors: FloorDef[] = [
  parseFloor("##########\n#S......U#\n##########", { id: "f1", index: 1, minimumPlayers: 1 }),
];
const left: Action = { kind: "move", dir: "left" };
const right: Action = { kind: "move", dir: "right" };

async function waitFor(check: () => boolean, ms = 3_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** A room on the shared tables with one ready player who can vote. */
async function startLeader(clock: FakeClock, opts: { snapshotEvery?: number } = {}) {
  const lease = new Lease(db, tables.lease, randomUUID(), clock);
  expect(await lease.tryAcquire()).toBe(true);
  const log = new DynamoGameLog(db, tables, lease, clock);
  const recovered = await recoverGame(floors, log);
  let stale: StaleLeaderError | null = null;
  const room = new GameRoom(recovered.state, clock, () => 0, {
    log,
    snapshotEvery: opts.snapshotEvery ?? 100,
    onStale: (e) => (stale = e),
  });
  const conn: Conn = { send: () => {} };
  const send = (msg: Omit<ClientMessage, "v">) =>
    room.receive(conn, { v: PROTOCOL_VERSION, ...msg });
  room.connect(conn, { userId: "u1", handle: "ana" });
  send({ type: "hello", data: {} });
  send({ type: "ready", data: {} });
  /** Vote, let the tick close, and wait for the durable write to land. */
  const play = async (action: Action) => {
    const turn = room.gameState.turn;
    send({ type: "vote", data: { tick: turn, action } });
    clock.advance(RULES.tickMinMs);
    await waitFor(() => room.gameState.turn === turn + 1 || stale !== null);
  };
  return { room, log, lease, play, isStale: () => stale !== null };
}

describe.skipIf(!available)("DynamoDB persistence", () => {
  beforeAll(async () => {
    await createTables(db, tables);
  });
  afterAll(async () => {
    await deleteTables(db, tables);
  });

  it("users: lookup by Google sub, handle uniqueness ignoring case, renames free the old handle", async () => {
    const users = new DynamoUserStore(db, tables.users);
    await users.create({ id: "a", googleSub: "sub-a", handle: "Ana" });
    expect(await users.findBySub("sub-a")).toEqual({ id: "a", googleSub: "sub-a", handle: "Ana" });
    await expect(
      users.create({ id: "b", googleSub: "sub-b", handle: "ana" }),
    ).rejects.toBeInstanceOf(HandleTakenError);
    await users.create({ id: "b", googleSub: "sub-b", handle: "Bo" });
    await expect(users.setHandle("b", "ANA")).rejects.toBeInstanceOf(HandleTakenError);
    await users.setHandle("a", "Anastasia");
    expect(await users.isHandleTaken("ana")).toBe(false);
    await users.setHandle("b", "ana");
    expect((await users.get("b"))?.handle).toBe("ana");
  });

  it("sessions: put, get, delete, and revoke all for a user", async () => {
    const sessions = new DynamoSessionStore(db, tables.sessions);
    const s = (tokenHash: string, userId: string) => ({
      tokenHash,
      userId,
      expiresAt: 2e12,
      renewedAt: 1,
    });
    await sessions.put(s("h1", "u"));
    await sessions.put(s("h2", "u"));
    await sessions.put(s("h3", "other"));
    expect(await sessions.get("h1")).toEqual(s("h1", "u"));
    await sessions.delete("h1");
    expect(await sessions.get("h1")).toBeUndefined();
    await sessions.deleteAllForUser("u");
    expect(await sessions.get("h2")).toBeUndefined();
    expect(await sessions.get("h3")).toBeDefined();
  });

  it("recovers the identical state after a crash, from a snapshot plus replay", async () => {
    const clock = new FakeClock();
    const a = await startLeader(clock, { snapshotEvery: 5 });
    const moves = [right, right, right, left, right, right, left, right, right, right, left, right];
    for (const m of moves) await a.play(m);
    expect(a.room.gameState.turn).toBe(12);
    // Crash: the room just stops, without releasing its lease or saving anything.
    a.room.stop();

    const snapshot = await a.log.latestSnapshot();
    expect(snapshot?.turn).toBe(10); // snapshots at 5 and 10; recovery replays 11 and 12
    const recovered = await recoverGame(floors, a.log);
    expect(serializeGame(recovered.state)).toEqual(serializeGame(a.room.gameState));
    expect(recovered.recentTurns.map((t) => t.turn)).toEqual(
      [...Array(12).keys()].map((i) => i + 1),
    );

    // Replaying the whole log from scratch reproduces the snapshot state too.
    const noSnapshots = Object.assign(Object.create(a.log) as DynamoGameLog, {
      latestSnapshot: async () => undefined,
    });
    const fromScratch = await recoverGame(floors, noSnapshots);
    expect(serializeGame(fromScratch.state)).toEqual(serializeGame(recovered.state));
  });

  it("two leaders: the stale one is fenced off and no turn is written twice", async () => {
    await deleteTables(db, tables);
    await createTables(db, tables);
    const clock = new FakeClock();
    const a = await startLeader(clock);
    await a.play(right);

    // While A's lease is live, B cannot take over.
    const b = new Lease(db, tables.lease, randomUUID(), clock);
    expect(await b.tryAcquire()).toBe(false);

    // A stalls past its lease; B takes over with a higher epoch.
    clock.advance(a.lease.ttlMs + 1);
    const leaderB = await startLeader(clock);
    expect(leaderB.lease.epoch).toBe(a.lease.epoch + 1);
    await leaderB.play(right);

    // A wakes up and tries to play: its write is rejected and it shuts down.
    await a.play(right);
    expect(a.isStale()).toBe(true);
    expect(await a.lease.renew()).toBe(false);

    const turns = await leaderB.log.turnsAfter(0);
    expect(turns.map((t) => t.turn)).toEqual([1, 2]);
    leaderB.room.stop();
  });
});
