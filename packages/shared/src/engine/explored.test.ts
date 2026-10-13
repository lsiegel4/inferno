import { describe, expect, it } from "vitest";
import { parseFloor } from "../floor.js";
import type { Action } from "../protocol.js";
import { cameraOrigin, VIEW_HEIGHT, VIEW_WIDTH } from "./explored.js";
import { createGame } from "./game.js";
import { restoreGame, serializeGame } from "./snapshot.js";
import { applyTurn } from "./turn.js";
import { toFloorState, turnDelta } from "./view.js";

const right: Action = { kind: "move", dir: "right" };

/** A 30-wide corridor: wider than the 9-tile camera window. */
function corridor(reveal?: Record<string, unknown>) {
  const w = 30;
  const rows = ["#".repeat(w), `#S${".".repeat(w - 4)}U#`, "#".repeat(w)];
  return createGame([
    parseFloor(rows.join("\n"), {
      id: "f1",
      index: 1,
      minimumPlayers: 1,
      ...(reveal ? { reveal } : {}),
    }),
  ]);
}

const exploredColumns = (explored: string) =>
  [...explored.split("\n")[1]!].map((c, x) => (c === " " ? null : x)).filter((x) => x !== null);

describe("camera window", () => {
  it("centres on the hero and clamps to the floor edges", () => {
    const floor = { width: 30, height: 40 };
    expect(cameraOrigin({ x: 15, y: 20 }, floor)).toEqual({ x: 11, y: 14 });
    expect(cameraOrigin({ x: 1, y: 1 }, floor)).toEqual({ x: 0, y: 0 });
    expect(cameraOrigin({ x: 29, y: 39 }, floor)).toEqual({
      x: 30 - VIEW_WIDTH,
      y: 40 - VIEW_HEIGHT,
    });
    expect(cameraOrigin({ x: 2, y: 2 }, { width: 5, height: 3 })).toEqual({ x: 0, y: 0 });
  });
});

describe("explored floor map", () => {
  it("starts with the camera window and grows as the hero moves", () => {
    let s = corridor();
    expect(exploredColumns(toFloorState(s).explored)).toEqual([...Array(9).keys()]);
    s = applyTurn(s, right).state; // hero x=2: window still starts at 0
    s = applyTurn(s, right).state; // x=3
    s = applyTurn(s, right).state; // x=4
    const r = applyTurn(s, right); // x=5: window now 1..9, so column 9 is new
    expect(turnDelta(s, r.state, r.changed).explored.map((t) => t.x)).toEqual([9, 9, 9]);
    expect(exploredColumns(toFloorState(r.state).explored)).toEqual([...Array(10).keys()]);
  });

  it("on dark floors only lit tiles are explored", () => {
    const s = corridor({ mode: "torchlight", radius: 2 });
    expect(exploredColumns(toFloorState(s).explored)).toEqual([0, 1, 2, 3]);
  });

  it("is kept through a death and saved in snapshots", () => {
    const rows = ["#".repeat(20), `#S${".".repeat(10)}L.....U#`, "#".repeat(20)];
    let s = createGame([parseFloor(rows.join("\n"), { id: "f1", index: 1, minimumPlayers: 1 })]);
    for (let i = 0; i < 10; i++) s = applyTurn(s, right).state;
    const exploredBefore = toFloorState(s).explored;
    const died = applyTurn(s, right); // hero at x=11 steps into the lava at x=12
    expect(died.outcome).toBe("died");
    expect(died.state.hero.x).toBe(1); // back at the start...
    expect(toFloorState(died.state).explored).toBe(exploredBefore); // ...but the map is kept
    const restored = restoreGame(
      [parseFloor(rows.join("\n"), { id: "f1", index: 1, minimumPlayers: 1 })],
      serializeGame(died.state),
    );
    expect(toFloorState(restored).explored).toBe(toFloorState(died.state).explored);
  });
});
