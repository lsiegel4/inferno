import { describe, expect, it } from "vitest";
import { parseFloor } from "../floor.js";
import type { Action } from "../protocol.js";
import { createGame } from "./game.js";
import { restoreGame, serializeGame, SnapshotMismatchError } from "./snapshot.js";
import { applyTurn } from "./turn.js";

const floors = () => [
  parseFloor("######\n#SaA.#\n#..LU#\n######", {
    id: "f1",
    index: 1,
    minimumPlayers: 1,
    legend: {
      a: { id: "lever", kind: "lever", targets: ["door"] },
      A: { id: "door", kind: "door" },
    },
  }),
  parseFloor("####\n#SU#\n####", { id: "f2", index: 2, minimumPlayers: 1 }),
];

describe("snapshots", () => {
  it("round-trips the game state", () => {
    let s = createGame(floors());
    s.hero.facing = "right";
    const actions: Action[] = [{ kind: "interact" }, { kind: "move", dir: "down" }];
    for (const a of actions) s = applyTurn(s, a).state;
    const restored = restoreGame(floors(), JSON.parse(JSON.stringify(serializeGame(s))));
    expect(restored).toEqual(s);
  });

  it("continues identically after restore", () => {
    const s = createGame(floors());
    const restored = restoreGame(floors(), serializeGame(s));
    const a: Action = { kind: "move", dir: "down" };
    expect(applyTurn(restored, a)).toEqual(applyTurn(s, a));
  });

  it("refuses a snapshot taken with a different floor set", () => {
    const snap = serializeGame(createGame(floors()));
    expect(() => restoreGame(floors().slice(0, 1), snap)).toThrow(SnapshotMismatchError);
  });
});
