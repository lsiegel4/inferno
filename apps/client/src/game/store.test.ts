import { PROTOCOL_VERSION, type ServerMessage } from "@inferno/shared";
import { describe, expect, it } from "vitest";
import { viewFrom, welcome } from "../test-fixtures.js";
import { reduce, SIGN_OVERLAY_MS, withMyVote } from "./store.js";

const msg = (m: Omit<ServerMessage, "v">) => ({ v: PROTOCOL_VERSION, ...m }) as ServerMessage;
const right = { kind: "move", dir: "right" } as const;

describe("game view", () => {
  it("builds the view from welcome", () => {
    const v = viewFrom(welcome());
    expect(v.turn).toBe(3);
    expect(v.floor?.tiles).toEqual(["#####", "#.S.#", "#####"]);
    expect(v.floor?.entities["lever-a"]?.kind).toBe("lever");
    expect(v.you).toEqual({ role: "player", userId: "u1", handle: "ana" });
  });

  it("applies a turn: hero, entity changes, inventory, log, and clears the vote", () => {
    let v = withMyVote(viewFrom(welcome()), right);
    v = reduce(
      v,
      msg({
        type: "turn",
        data: {
          turn: 4,
          action: { kind: "interact" },
          hero: { x: 2, y: 1, facing: "right" },
          changes: [{ id: "lever-a", kind: "lever", x: 3, y: 1, state: { pulled: true } }],
          inventory: [{ id: "key-1", type: "key" }],
          outcome: "no_effect",
        },
      }),
      0,
    );
    expect(v.turn).toBe(4);
    expect(v.floor?.entities["lever-a"]?.state).toEqual({ pulled: true });
    expect(v.inventory).toEqual([{ id: "key-1", type: "key" }]);
    expect(v.log).toEqual([{ turn: 4, action: { kind: "interact" }, outcome: "no_effect" }]);
    expect(v.myVote).toBeNull();
  });

  it("removes entities sent as hidden, and updates revealed, hidden and explored tiles", () => {
    const v = reduce(
      viewFrom(welcome()),
      msg({
        type: "turn",
        data: {
          turn: 4,
          action: right,
          hero: { x: 3, y: 1, facing: "right" },
          changes: [{ id: "lever-a", kind: "lever", x: 3, y: 1, state: { hidden: true } }],
          revealed: [{ x: 0, y: 0, ch: "L" }],
          hidden: [{ x: 4, y: 2 }],
          explored: [{ x: 1, y: 1, ch: "U" }],
        },
      }),
      0,
    );
    expect(v.floor?.entities["lever-a"]).toBeUndefined();
    expect(v.floor?.tiles).toEqual(["L####", "#.S.#", "#### "]);
    expect(v.floor?.explored[1]).toBe("#US.#");
  });

  it("shows sign text for 2 seconds and logs it", () => {
    const v = reduce(
      viewFrom(welcome()),
      msg({
        type: "turn",
        data: {
          turn: 4,
          action: { kind: "interact" },
          hero: { x: 2, y: 1, facing: "right" },
          changes: [],
          sign: { text: "Beware" },
        },
      }),
      1_000,
    );
    expect(v.sign).toEqual({ text: "Beware", until: 1_000 + SIGN_OVERLAY_MS });
    expect(v.log.at(-1)?.sign).toBe("Beware");
  });

  it("tracks pausing, tallies, chat, session replacement and errors", () => {
    let v = viewFrom(welcome());
    v = reduce(
      v,
      msg({
        type: "paused",
        data: { presence: { active: 1, minimum: 2, spectators: 0, paused: true } },
      }),
      0,
    );
    expect(v.presence?.paused).toBe(true);
    v = reduce(
      v,
      msg({ type: "chat_message", data: { id: "c1", handle: "bo", text: "hi", at: "t" } }),
      0,
    );
    expect(v.chat).toHaveLength(1);
    v = reduce(v, msg({ type: "session_replaced", data: {} }), 0);
    expect(v.you).toEqual({ role: "spectator" });
    v = reduce(v, msg({ type: "error", data: { code: "RATE_LIMITED" } }), 0);
    expect(v.notice).toBe("RATE_LIMITED");
  });
});
