import { fileURLToPath } from "node:url";
import { createGame, parseFloor } from "@inferno/shared";
import { describe, expect, it } from "vitest";
import { loadFloorsFromDir } from "./load-floors.js";
import { atFloorStart, solveFloor } from "./solver.js";

const floor = (rows: string[], legend: Record<string, Record<string, unknown>> = {}) =>
  parseFloor(rows.join("\n"), { id: "f1", index: 1, minimumPlayers: 1, legend });

describe("solveFloor", () => {
  it("finds the shortest route, including levers and jumps", () => {
    const game = createGame([
      floor(["#######", "#S.L.A#", "#.a..U#", "#######"], {
        a: { id: "lever", kind: "lever", targets: ["door"] },
        A: { id: "door", kind: "door" },
      }),
    ]);
    const solution = solveFloor(game)!;
    expect(solution.actions.length).toBeGreaterThan(0);
    expect(solution.dangerSteps).toBeGreaterThan(0);
  });

  it("returns null when the stairs are unreachable", () => {
    const game = createGame([floor(["#####", "#S#U#", "#####"])]);
    expect(solveFloor(game)).toBeNull();
  });

  it("solves the checked-in floors", () => {
    const dir = fileURLToPath(new URL("../../floors", import.meta.url));
    const game = createGame(loadFloorsFromDir(dir));
    for (const id of game.floorOrder) {
      expect(solveFloor(atFloorStart(game, id)), id).not.toBeNull();
    }
  });
});
