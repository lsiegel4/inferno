import { describe, expect, it } from "vitest";
import { parseFloor } from "../floor.js";
import { createGame } from "./game.js";
import { applyTurn } from "./turn.js";
import { encodeTerrain, toFloorState, turnChanges } from "./view.js";

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
    expect(turnChanges(r.state, r.changed)).toEqual([
      { id: "key-1", kind: "item", x: 1, y: 1, state: { hidden: true } },
    ]);
  });
});
