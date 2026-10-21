import { describe, expect, it } from "vitest";
import { parseFloor, type FloorDef } from "../floor.js";
import type { Action } from "../protocol.js";
import { createGame, validateFloorSet } from "./game.js";
import { applyTurn } from "./turn.js";
import type { GameState } from "./types.js";

const up: Action = { kind: "move", dir: "up" };
const down: Action = { kind: "move", dir: "down" };
const left: Action = { kind: "move", dir: "left" };
const right: Action = { kind: "move", dir: "right" };
const interact: Action = { kind: "interact" };
const useStone: Action = { kind: "use", itemId: "stone" };

function floor(
  index: number,
  rows: string[],
  legend: Record<string, Record<string, unknown>> = {},
): FloorDef {
  return parseFloor(rows.join("\n"), { id: `f${index}`, index, minimumPlayers: 1, legend });
}

function play(state: GameState, actions: Action[]) {
  let result = applyTurn(state, actions[0]!);
  for (const a of actions.slice(1)) result = applyTurn(result.state, a);
  return result;
}

const pos = (s: GameState) => [s.hero.x, s.hero.y] as const;
const entity = (s: GameState, id: string) =>
  s.floors[s.currentFloor]!.entities.find((e) => e.id === id)!;
const at = (s: GameState, id: string) => [entity(s, id).x, entity(s, id).y] as const;

const BLOCK = { b: { id: "block", kind: "block" } };

describe("push blocks", () => {
  it("moving into a block pushes it one tile and the hero follows", () => {
    const s = createGame([floor(1, ["#######", "#S.b..#", "#######"], BLOCK)]);
    const r = play(s, [right, right]);
    expect(at(r.state, "block")).toEqual([4, 1]);
    expect(pos(r.state)).toEqual([3, 1]);
    expect(r.changed).toContain("block");
  });

  it.each([
    ["a wall", ["#####", "#S.b#", "#####"], {}],
    [
      "another block (no chains)",
      ["#######", "#S.bc.#", "#######"],
      { c: { id: "c", kind: "block" } },
    ],
    [
      "a blocking entity",
      ["#######", "#S.bs.#", "#######"],
      { s: { id: "s", kind: "sign", text: "x" } },
    ],
    ["stairs", ["######", "#S.bU#", "######"], {}],
  ])("a push into %s fails: the hero turns in place and the turn is used", (_, rows, extra) => {
    const s = createGame([floor(1, rows, { ...BLOCK, ...extra })]);
    const r = play(s, [right, right]);
    expect(at(r.state, "block")).toEqual([3, 1]);
    expect(pos(r.state)).toEqual([2, 1]);
    expect(r.events).toContainEqual({ type: "turned" });
    expect(r.state.turn).toBe(2);
  });

  it("the hero cannot jump over a block", () => {
    const s = createGame([floor(1, ["#######", "#S.b..#", "#######"], BLOCK)]);
    const r = play(s, [right, { kind: "jump" }]);
    expect(r.outcome).toBe("no_effect");
    expect(pos(r.state)).toEqual([2, 1]);
  });

  it("a block pushed into lava fills it: the tile becomes walkable floor, no longer jumpable", () => {
    const s = createGame([floor(1, ["########", "#S.bL..#", "########"], BLOCK)]);
    const filled = play(s, [right, right]);
    expect(entity(filled.state, "block").state.filled).toBe(true);
    expect(at(filled.state, "block")).toEqual([4, 1]);

    const walked = play(filled.state, [right, right]);
    expect(walked.outcome).toBeUndefined();
    expect(pos(walked.state)).toEqual([5, 1]);

    const jumped = applyTurn(filled.state, { kind: "jump" }); // the filled tile is not a hazard
    expect(jumped.outcome).toBe("no_effect");
    expect(pos(jumped.state)).toEqual([3, 1]);
  });

  it("a block pushed into a pit fills it, so the pit no longer drops the hero", () => {
    const f1 = floor(1, ["#####", "#S.U#", "#####"]);
    const f2 = floor(2, ["#######", "#S.bp.#", "#######"], {
      ...BLOCK,
      p: { id: "pit", kind: "pit", landing: { floor: "f1", x: 1, y: 1 } },
    });
    const s = play(createGame([f1, f2]), [right, right]).state; // climb to f2
    expect(s.currentFloor).toBe("f2");
    const filled = play(s, [right, right]);
    expect(entity(filled.state, "block").state.filled).toBe(true);
    const walked = play(filled.state, [right, right]);
    expect(walked.state.currentFloor).toBe("f2");
    expect(pos(walked.state)).toEqual([5, 1]);
  });

  it("on death blocks return to their start tiles and filled lava reverts", () => {
    const s = createGame([floor(1, ["########", "#S.bL..#", "#L.....#", "########"], BLOCK)]);
    const filled = play(s, [right, right]).state; // block fills (4,1)
    const dead = play(filled, [down, left, left]); // (3,2), (2,2), then lava at (1,2)
    expect(dead.outcome).toBe("died");
    expect(at(dead.state, "block")).toEqual([3, 1]);
    expect(entity(dead.state, "block").state.filled).toBe(false);
    // The lava at (4,1) is lava again: walking into it kills.
    const block = entity(dead.state, "block");
    expect(block.state.filled).toBe(false);
    dead.state.hero = { x: 3, y: 2, facing: "up", stairsLock: false };
    expect(play(dead.state, [right, up]).outcome).toBe("died");
  });

  it("leaving a floor preserves where blocks are", () => {
    const f1 = floor(1, ["#######", "#S.b.U#", "#.....#", "#######"], BLOCK);
    const f2 = floor(2, ["#####", "#DS.#", "#####"]);
    let s = play(createGame([f1, f2]), [right, right]).state; // block to (4,1), hero (3,1)
    s = play(s, [down, right, right, up]).state; // around the block to the stairs at (5,1)
    expect(s.currentFloor).toBe("f2");
    s = applyTurn(s, left).state; // stairs down
    expect(s.currentFloor).toBe("f1");
    expect(at(s, "block")).toEqual([4, 1]);
  });
});

describe("pressure plates", () => {
  const doors = { A: { id: "A", kind: "door" }, B: { id: "B", kind: "door" } };

  it("the hero standing on a plate holds its doors open; stepping off closes them", () => {
    const s = createGame([
      floor(1, ["#########", "#S.p.AB.#", "#########"], {
        ...doors,
        p: { id: "plate", kind: "plate", targets: ["A", "B"] },
      }),
    ]);
    const on = play(s, [right, right]);
    expect(entity(on.state, "plate").state.pressed).toBe(true);
    expect(entity(on.state, "A").state.open).toBe(true);
    expect(entity(on.state, "B").state.open).toBe(true);
    const off = applyTurn(on.state, left);
    expect(entity(off.state, "plate").state.pressed).toBe(false);
    expect(entity(off.state, "A").state.open).toBe(false);
    expect(entity(off.state, "B").state.open).toBe(false);
  });

  it("a block on a plate keeps it pressed", () => {
    const s = createGame([
      floor(1, ["#########", "#S.bp.A.#", "#########"], {
        ...BLOCK,
        A: doors.A,
        p: { id: "plate", kind: "plate", targets: ["A"] },
      }),
    ]);
    const r = play(s, [right, right, left]); // push block onto the plate, step back
    expect(at(r.state, "block")).toEqual([4, 1]);
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("a door cannot close on a block or the hero; it closes once the doorway is clear", () => {
    const s = createGame([
      floor(1, ["##########", "#S.pbA...#", "##########"], {
        ...BLOCK,
        A: doors.A,
        p: { id: "plate", kind: "plate", targets: ["A"] },
      }),
    ]);
    let r = play(s, [right, right]); // hero on the plate: door opens
    expect(entity(r.state, "A").state.open).toBe(true);
    r = applyTurn(r.state, right); // push the block into the doorway, hero leaves the plate
    expect(at(r.state, "block")).toEqual([5, 1]);
    expect(entity(r.state, "A").state.open).toBe(true); // block in the doorway
    r = applyTurn(r.state, right); // push the block through; the hero is now in the doorway
    expect(pos(r.state)).toEqual([5, 1]);
    expect(entity(r.state, "A").state.open).toBe(true);
    r = applyTurn(r.state, right); // doorway clear
    expect(pos(r.state)).toEqual([6, 1]);
    expect(entity(r.state, "A").state.open).toBe(false);
  });

  it("lever-opened doors stay open regardless of plates, also through a floor reset", () => {
    const s = createGame([
      floor(1, ["#######", "#S.pA.#", "#.a...#", "#L....#", "#######"], {
        A: doors.A,
        a: { id: "lever", kind: "lever", targets: ["A"] },
        p: { id: "plate", kind: "plate", targets: ["A"] },
      }),
    ]);
    let r = play(s, [right, down, interact]); // pull the lever below (2,1)
    expect(entity(r.state, "A").state.latched).toBe(true);
    r = play(r.state, [right, left]); // on and off the plate
    expect(entity(r.state, "A").state.open).toBe(true);
    r = play(r.state, [left, down, down]); // (1,2) then lava at (1,3)
    expect(r.outcome).toBe("died");
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("after a death, plate-held doors close and plates release", () => {
    const s = createGame([
      floor(1, ["########", "#S.bp.A#", "#L.....#", "########"], {
        ...BLOCK,
        A: doors.A,
        p: { id: "plate", kind: "plate", targets: ["A"] },
      }),
    ]);
    let r = play(s, [right, right]); // block on the plate, door open
    expect(entity(r.state, "A").state.open).toBe(true);
    r = play(r.state, [down, left, left]); // (3,2), (2,2), lava at (1,2)
    expect(r.outcome).toBe("died");
    expect(at(r.state, "block")).toEqual([3, 1]);
    expect(entity(r.state, "plate").state.pressed).toBe(false);
    expect(entity(r.state, "A").state.open).toBe(false);
  });

  it("validation rejects plates without targets or with unknown ones", () => {
    const bad = floor(1, ["######", "#Spq.#", "######"], {
      p: { id: "p", kind: "plate", targets: [] },
      q: { id: "q", kind: "plate", targets: ["nope"] },
    });
    expect(validateFloorSet([bad])).toEqual([
      `floor "f1": plate "p" has no targets`,
      `floor "f1": plate "q" targets unknown "nope"`,
    ]);
  });
});

describe("weight stone", () => {
  const weightFloor = () =>
    createGame([
      floor(1, ["########", "#Sw.p.A#", "#..L...#", "########"], {
        w: { id: "stone", kind: "item", item: "weight" },
        A: { id: "A", kind: "door" },
        p: { id: "plate", kind: "plate", targets: ["A"] },
      }),
    ]);
  /** Pick up the stone and stand at (3,1) facing the plate at (4,1). */
  const ready = () => play(weightFloor(), [right, interact, right, right]).state;

  it("use(weight) facing a plate places the stone and presses the plate", () => {
    const s = ready();
    expect(s.inventory.map((i) => i.id)).toEqual(["stone"]);
    const r = applyTurn(s, useStone);
    expect(r.outcome).toBeUndefined();
    expect(r.state.inventory).toEqual([]);
    expect(entity(r.state, "plate").state.pressed).toBe(true);
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("Interact facing the plate picks the stone back up and releases it", () => {
    const r = play(ready(), [useStone, interact]);
    expect(r.state.inventory.map((i) => i.id)).toEqual(["stone"]);
    expect(entity(r.state, "plate").state.pressed).toBe(false);
    expect(entity(r.state, "A").state.open).toBe(false);
    // Reusable: place it again.
    expect(applyTurn(r.state, useStone).outcome).toBeUndefined();
  });

  it("a stone left on a plate returns to the inventory on death and the plate releases", () => {
    const r = play(ready(), [useStone, down]); // (3,2) is lava
    expect(r.outcome).toBe("died");
    expect(r.state.inventory.map((i) => i.id)).toEqual(["stone"]);
    expect(entity(r.state, "plate").state.stone).toBeNull();
    expect(entity(r.state, "A").state.open).toBe(false);
  });

  it("a stone picked back up is not duplicated by a later death", () => {
    const r = play(ready(), [useStone, interact, down]);
    expect(r.outcome).toBe("died");
    expect(r.state.inventory.map((i) => i.id)).toEqual(["stone"]);
  });

  it("using the stone on anything but an empty plate has no effect", () => {
    const s = play(weightFloor(), [right, interact, down]).state; // facing down at (1,1)... floor
    expect(applyTurn(s, useStone).outcome).toBe("no_effect");
    const placed = applyTurn(ready(), useStone).state;
    placed.inventory.push({ id: "stone2", type: "weight", props: {} });
    expect(applyTurn(placed, { kind: "use", itemId: "stone2" }).outcome).toBe("no_effect");
  });
});
