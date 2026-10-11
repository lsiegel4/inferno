import { describe, expect, it } from "vitest";
import { parseFloor, type Reveal } from "../floor.js";
import { createGame, validateFloorSet } from "./game.js";
import { clearLine, revealFor } from "./reveal.js";
import { applyTurn } from "./turn.js";
import type { GameState } from "./types.js";
import { toFloorState } from "./view.js";

const ROWS = [
  "###########",
  "#.........#",
  "#....#....#",
  "#.k..S..A.#",
  "#....#....#",
  "#.........#",
  "###########",
];

function game(reveal: Reveal, legend: Record<string, Record<string, unknown>> = {}): GameState {
  return createGame([
    parseFloor(ROWS.join("\n"), {
      id: "f1",
      index: 1,
      minimumPlayers: 1,
      reveal,
      legend: { k: { id: "key-1", kind: "item", item: "key", opens: "red" }, ...legend },
    }),
  ]);
}

/** Render revealed tiles as "#"/"." and unrevealed as " ", for readable assertions. */
function picture(s: GameState): string[] {
  return toFloorState(s).tiles.split("\n");
}

describe("reveal modes", () => {
  it("viewport reveals the whole floor (the default)", () => {
    const s = createGame([
      parseFloor(ROWS.join("\n").replace("k", ".").replace("A", "."), {
        id: "f1",
        index: 1,
        minimumPlayers: 1,
      }),
    ]);
    expect(s.floors.f1!.def.reveal).toEqual({ mode: "viewport" });
    expect(picture(s)).toEqual(ROWS.map((r) => r.replace("k", ".").replace("A", ".")));
  });

  it("torchlight reveals a Euclidean circle around the hero, through walls", () => {
    const s = game({ mode: "torchlight", radius: 2 }, { A: { id: "a", kind: "sign", text: "x" } });
    expect(picture(s)).toEqual([
      "           ",
      "     .     ",
      "    .#.    ",
      "   ..S..   ",
      "    .#.    ",
      "     .     ",
      "           ",
    ]);
  });

  it("line of sight is blocked by walls and blocking entities, but the blocker itself is lit", () => {
    const s = game(
      { mode: "line_of_sight", radius: 3 },
      { A: { id: "a", kind: "sign", text: "x" } },
    );
    const rows = picture(s);
    expect(rows[3]).toBe("  ...S...  ");
    expect(rows[1]![5]).toBe(" "); // hidden behind the wall at (5,2)
    expect(rows[2]![5]).toBe("#"); // the wall itself is lit
  });

  it("closed doors block sight; opening them lets light through", () => {
    const rows = ["#########", "#S..A...#", "#..a....#", "#########"];
    const legend = {
      A: { id: "door", kind: "door" },
      a: { id: "lever", kind: "lever", targets: ["door"] },
    };
    const make = () =>
      createGame([
        parseFloor(rows.join("\n"), {
          id: "f1",
          index: 1,
          minimumPlayers: 1,
          reveal: { mode: "line_of_sight", radius: 6 },
          legend,
        }),
      ]);
    const closed = make();
    expect(revealFor(closed)(5, 1)).toBe(false);
    const opened = make();
    opened.hero = { x: 3, y: 1, facing: "down", stairsLock: false };
    const r = applyTurn(opened, { kind: "interact" });
    r.state.hero.x = 1;
    expect(revealFor(r.state)(5, 1)).toBe(true);
  });

  it("light entities reveal around themselves with their own radius", () => {
    const s = game(
      { mode: "torchlight", radius: 0 },
      { A: { id: "lamp", kind: "light", radius: 1 } },
    );
    const reveal = revealFor(s);
    expect(reveal(5, 3)).toBe(true); // hero tile
    expect(reveal(4, 3)).toBe(false);
    expect([reveal(8, 3), reveal(7, 3), reveal(9, 3), reveal(8, 2)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(reveal(7, 2)).toBe(false); // diagonal is outside a radius-1 circle
  });

  it("items in darkness are not sent to clients until lit", () => {
    const dark = game(
      { mode: "torchlight", radius: 2 },
      { A: { id: "a", kind: "sign", text: "x" } },
    );
    expect(toFloorState(dark).entities.map((e) => e.id)).toEqual([]);
    dark.hero.x = 3;
    expect(toFloorState(dark).entities.map((e) => e.id)).toEqual(["key-1"]);
  });

  it("validation rejects bad light radii and bad reveal settings", () => {
    const bad = parseFloor("#####\n#SA.#\n#####", {
      id: "f1",
      index: 1,
      minimumPlayers: 1,
      legend: { A: { id: "lamp", kind: "light", radius: -1 } },
    });
    expect(validateFloorSet([bad])).toEqual([
      `floor "f1": light "lamp" radius must be a non-negative integer`,
    ]);
    expect(() =>
      parseFloor("#S#", { id: "f1", index: 1, minimumPlayers: 1, reveal: { mode: "torchlight" } }),
    ).toThrow(/reveal/);
  });
});

describe("torch", () => {
  const rows = ["########", "#t.S.L.#", "########"];
  const make = () =>
    createGame([
      parseFloor(rows.join("\n"), {
        id: "f1",
        index: 1,
        minimumPlayers: 1,
        reveal: { mode: "torchlight", radius: 1 },
        legend: { t: { id: "torch-1", kind: "item", item: "torch" } },
      }),
    ]);

  function holdingTorch(): GameState {
    let s = make();
    s.hero = { x: 2, y: 1, facing: "left", stairsLock: false };
    s = applyTurn(s, { kind: "interact" }).state;
    expect(s.inventory.map((i) => i.id)).toEqual(["torch-1"]);
    return s;
  }

  it("places a light on the faced open tile and is consumed", () => {
    const s = holdingTorch();
    s.hero.facing = "left"; // (1,1) is now empty floor
    const r = applyTurn(s, { kind: "use", itemId: "torch-1" });
    expect(r.outcome).toBeUndefined();
    expect(r.state.inventory).toEqual([]);
    const lamp = r.state.floors.f1!.entities.find((e) => e.kind === "light")!;
    expect([lamp.x, lamp.y]).toEqual([1, 1]);
    expect(r.changed).toContain(lamp.id);
  });

  it("cannot be placed on a wall", () => {
    const s = holdingTorch();
    s.hero.facing = "up";
    expect(applyTurn(s, { kind: "use", itemId: "torch-1" }).outcome).toBe("no_effect");
  });

  it("is returned on death and its light is removed", () => {
    let s = holdingTorch();
    s.hero.facing = "left";
    s = applyTurn(s, { kind: "use", itemId: "torch-1" }).state;
    s.hero = { x: 4, y: 1, facing: "right", stairsLock: false };
    const r = applyTurn(s, { kind: "move", dir: "right" }); // (5,1) is lava
    expect(r.outcome).toBe("died");
    expect(r.state.inventory.map((i) => i.id)).toEqual(["torch-1"]);
    const lamp = r.state.floors.f1!.entities.find((e) => e.kind === "light")!;
    expect(lamp.state.removed).toBe(true);
    expect(r.changed).toContain(lamp.id);
    expect(revealFor(r.state)(1, 1)).toBe(false);
    expect(toFloorState(r.state).entities.some((e) => e.kind === "light")).toBe(false);
  });
});

describe("clearLine", () => {
  it("ignores the endpoints and stops at opaque tiles in between", () => {
    const wallAt = (x: number, y: number) => x === 2 && y === 0;
    expect(clearLine(0, 0, 4, 0, wallAt)).toBe(false);
    expect(clearLine(0, 0, 2, 0, wallAt)).toBe(true);
    expect(clearLine(0, 0, 0, 4, wallAt)).toBe(true);
  });
});
