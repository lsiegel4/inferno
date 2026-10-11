import { fileURLToPath } from "node:url";
import { createGame, type ServerMessage } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { Bot } from "@inferno/tools";
import { describe, expect, it } from "vitest";
import { GameRoom, type Conn } from "./room.js";
import { FakeClock } from "./testing.js";

/** Deterministic PRNG (mulberry32) so the playthrough is reproducible. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("bot harness", () => {
  it("50 simulated voters finish a floor", () => {
    const dir = fileURLToPath(new URL("../../../floors", import.meta.url));
    const floors = loadFloorsFromDir(dir).filter((f) => f.index === 1); // one floor: stairs end the game
    const clock = new FakeClock();
    const room = new GameRoom(createGame(floors), clock, seeded(1));

    const queue: [Conn, ServerMessage][] = [];
    const bots = Array.from({ length: 50 }, (_, i) => {
      const bot = new Bot(floors, { focus: 0.6, rng: seeded(100 + i) });
      const conn: Conn = { send: (m) => queue.push([conn, m]) };
      return { bot, conn, name: `bot${i}` };
    });
    const byConn = new Map(bots.map((b) => [b.conn, b]));
    const pump = () => {
      while (queue.length) {
        const [conn, msg] = queue.shift()!;
        for (const reply of byConn.get(conn)!.bot.onMessage(msg)) room.receive(conn, reply);
      }
    };

    for (const { conn, name } of bots) {
      room.connect(conn, { userId: `bot:${name}`, handle: name });
      room.receive(conn, { v: 1, type: "hello", data: {} });
      pump();
    }

    for (let t = 0; t < 30 * 60_000 && !bots[0]!.bot.gameOver; t += 250) {
      clock.advance(250);
      pump();
    }
    expect(bots.every((b) => b.bot.gameOver)).toBe(true);
    room.stop();
  }, 60_000);
});
