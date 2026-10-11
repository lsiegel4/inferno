import { describe, expect, it } from "vitest";
import { FloorFormatError, parseFloor } from "./floor.js";

const meta = (legend: Record<string, unknown> = {}) => ({
  id: "f1",
  index: 1,
  minimumPlayers: 2,
  legend,
});

function problems(grid: string, m: unknown): string[] {
  try {
    parseFloor(grid, m);
    return [];
  } catch (e) {
    if (e instanceof FloorFormatError) return e.problems;
    throw e;
  }
}

describe("parseFloor", () => {
  it("parses terrain, start, stairs and legend entities", () => {
    const f = parseFloor(
      "#####\n#SaU#\n#####\n",
      meta({ a: { id: "lever-a", kind: "lever", targets: [] } }),
    );
    expect(f).toMatchObject({ id: "f1", index: 1, minimumPlayers: 2, width: 5, height: 3 });
    expect(f.start).toEqual({ x: 1, y: 1 });
    expect(f.stairsUp).toEqual({ x: 3, y: 1 });
    expect(f.terrain[1]).toBe("#S.U#");
    expect(f.entities).toEqual([
      { id: "lever-a", kind: "lever", x: 2, y: 1, props: { targets: [] } },
    ]);
  });

  it("reports every problem at once", () => {
    expect(
      problems(
        "###\n#?\n###",
        meta({ L: { id: "x", kind: "door" }, z: { id: "z", kind: "door" } }),
      ),
    ).toEqual([
      "row 1 has length 2, expected 3",
      'legend character "L" is a terrain character',
      'unknown character "?" at 1,1',
      "no start (S)",
      'legend character "z" is not used in the grid',
    ]);
  });

  it("rejects duplicate starts, duplicate legend characters and duplicate ids", () => {
    expect(problems("#SSaa#", meta({ a: { id: "d", kind: "door" } }))).toEqual([
      "more than one start (S) at 2,0",
      'legend character "a" appears more than once',
      'duplicate entity id "d"',
    ]);
  });

  it("rejects invalid metadata", () => {
    expect(problems("#S#", { id: "f1", index: 0, minimumPlayers: 1 })[0]).toMatch(/^index:/);
  });
});
