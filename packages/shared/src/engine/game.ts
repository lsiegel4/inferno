import "./entities/index.js";
import { TERRAIN, type FloorDef } from "../floor.js";
import { exploreAroundHero } from "./explored.js";
import { entityType, hasEntityType } from "./registry.js";
import type { FloorRuntime, GameState, RuntimeEntity } from "./types.js";

export class FloorSetError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid floor set:\n- ${problems.join("\n- ")}`);
  }
}

/** Cross-floor validation: ordering, entity kinds, and each kind's own rules. */
export function validateFloorSet(floors: readonly FloorDef[]): string[] {
  const problems: string[] = [];
  const byId = new Map(floors.map((f) => [f.id, f]));
  if (byId.size !== floors.length) problems.push("duplicate floor ids");
  const sorted = [...floors].sort((a, b) => a.index - b.index);
  sorted.forEach((f, i) => {
    if (f.index !== i + 1) problems.push(`floor indexes must be 1..${floors.length} without gaps`);
    const hasStairsDown = f.terrain.some((row) => row.includes(TERRAIN.stairsDown));
    if (hasStairsDown && (i === 0 || !sorted[i - 1]!.stairsUp)) {
      problems.push(`floor "${f.id}" has stairs down but no previous floor with stairs up`);
    }
    if (i < sorted.length - 1 && !f.stairsUp) problems.push(`floor "${f.id}" has no stairs up`);
    for (const e of f.entities) {
      if (!hasEntityType(e.kind)) {
        problems.push(`floor "${f.id}": unknown entity kind "${e.kind}" (${e.id})`);
        continue;
      }
      for (const p of entityType(e.kind).validate?.(e, f, byId) ?? []) {
        problems.push(`floor "${f.id}": ${p}`);
      }
    }
  });
  return [...new Set(problems)];
}

function loadFloor(def: FloorDef): FloorRuntime {
  const initial: RuntimeEntity[] = def.entities.map((p) => ({
    id: p.id,
    kind: p.kind,
    x: p.x,
    y: p.y,
    props: p.props,
    state: entityType(p.kind).initialState?.(p) ?? {},
  }));
  return { def, initial, entities: structuredClone(initial), spent: [], explored: [] };
}

/** A new game: hero at floor 1's start, empty inventory. Throws FloorSetError if invalid. */
export function createGame(floors: readonly FloorDef[]): GameState {
  const problems = validateFloorSet(floors);
  if (problems.length) throw new FloorSetError(problems);
  const sorted = [...floors].sort((a, b) => a.index - b.index);
  const first = sorted[0]!;
  const state: GameState = {
    floorOrder: sorted.map((f) => f.id),
    floors: Object.fromEntries(sorted.map((f) => [f.id, loadFloor(f)])),
    currentFloor: first.id,
    hero: { x: first.start.x, y: first.start.y, facing: "up", stairsLock: false },
    inventory: [],
    turn: 0,
    gameOver: false,
  };
  exploreAroundHero(state);
  return state;
}
