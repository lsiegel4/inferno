import { describe, expect, it } from "vitest";
import { parseFloor } from "../floor.js";
import { createGame } from "./game.js";
import { applyTurn } from "./turn.js";
import { encodeTerrain, toFloorState, turnDelta } from "./view.js";

const game = () =>
  createGame([
    parseFloor("#####\n#kS.#\n#####", {
      id: "f1",
      index: 1,
      minimumPlayers: 1,
      legend: { k: { id: "key-1", kind: "item", item: "key", opens: "red" } },
    }),
  ]);

describe("view", () => {
  it("builds the protocol floor state with entity props and state merged", () => {
    expect(toFloorState(game())).toEqual({
      floorId: "f1",
      index: 1,
      width: 5,
      height: 3,
      tiles: "#####\n#.S.#\n#####",
      explored: "#####\n#.S.#\n#####",
      entities: [
        {
          id: "key-1",
          kind: "item",
          x: 1,
          y: 1,
          state: { item: "key", opens: "red", taken: false },
        },
      ],
      minimumPlayers: 1,
    });
  });

  it("hides unrevealed tiles", () => {
    const s = game();
    expect(encodeTerrain(s.floors.f1!.def, (x) => x < 2)).toBe("##   \n#.   \n##   ");
  });

  it("drops hidden entities and marks them hidden in turn changes", () => {
    const s = game();
    s.hero.facing = "left";
    const r = applyTurn(s, { kind: "interact" });
    expect(toFloorState(r.state).entities).toEqual([]);
    expect(turnDelta(s, r.state, r.changed).changes).toEqual([
      { id: "key-1", kind: "item", x: 1, y: 1, state: { hidden: true } },
    ]);
  });

  describe("turn deltas in darkness", () => {
    // Torchlight radius 1 on a corridor: the hero lights only its neighbours.
    const dark = () =>
      createGame([
        parseFloor("#########\n#S....k.#\n#########", {
          id: "f1",
          index: 1,
          minimumPlayers: 1,
          reveal: { mode: "torchlight", radius: 1 },
          legend: { k: { id: "key-1", kind: "item", item: "key", opens: "red" } },
        }),
      ]);
    const right = { kind: "move", dir: "right" } as const;

    it("reports tiles that were revealed and tiles that went dark", () => {
      const s = dark();
      const r = applyTurn(s, right); // hero (1,1) -> (2,1)
      const d = turnDelta(s, r.state, r.changed);
      // Round light (Euclidean): radius 1 lights the hero's tile and its four neighbours.
      expect(d.revealed).toEqual([
        { x: 2, y: 0, ch: "#" },
        { x: 3, y: 1, ch: "." },
        { x: 2, y: 2, ch: "#" },
      ]);
      expect(d.hidden).toEqual([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ]);
    });

    it("sends entities that come into view; explored ones stay for the floor map", () => {
      let s = dark();
      for (let i = 0; i < 3; i++) s = applyTurn(s, right).state; // hero at (4,1)
      const into = applyTurn(s, right); // hero (5,1): key at (6,1) now lit
      expect(turnDelta(s, into.state, into.changed).changes).toEqual([
        {
          id: "key-1",
          kind: "item",
          x: 6,
          y: 1,
          state: { item: "key", opens: "red", taken: false },
        },
      ]);
      const back = applyTurn(into.state, { kind: "move", dir: "left" });
      // The key's tile is now explored, so it stays on the floor map although it went dark.
      expect(turnDelta(into.state, back.state, back.changed).changes).toEqual([]);
    });

    it("is empty in viewport mode", () => {
      const s = game();
      const r = applyTurn(s, right);
      expect(turnDelta(s, r.state, r.changed)).toEqual({
        changes: [],
        revealed: [],
        hidden: [],
        explored: [],
      });
    });
  });
});
