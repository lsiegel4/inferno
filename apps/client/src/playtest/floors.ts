/** The checked-in floor files, bundled at build time, plus solver routes if they were exported. */
import { parseFloor, type Action, type Crowd, type FloorDef } from "@inferno/shared";

const grids = import.meta.glob<string>("../../../../floors/*/grid.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const metas = import.meta.glob<unknown>("../../../../floors/*/floor.json", {
  import: "default",
  eager: true,
});

export function loadFloors(): FloorDef[] {
  return Object.keys(grids)
    .map((path) => {
      const dir = path.slice(0, path.lastIndexOf("/"));
      return parseFloor(grids[path]!, metas[`${dir}/floor.json`]);
    })
    .sort((a, b) => a.index - b.index);
}

export interface FloorSolution {
  floorId: string;
  moves: { action: Action; crowd: Crowd }[];
  dangerSteps: number;
  splitSteps: number;
  states: number;
  softlocks: number | null;
}

// Written by `pnpm --filter @inferno/tools export-solutions`; absent in a fresh checkout.
const solutionFiles = import.meta.glob<FloorSolution[]>("../../solutions.json", {
  import: "default",
  eager: true,
});

export function loadSolutions(): Map<string, FloorSolution> {
  const list = Object.values(solutionFiles)[0] ?? [];
  return new Map(list.map((s) => [s.floorId, s]));
}
