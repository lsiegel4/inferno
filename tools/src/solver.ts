import { applyTurn, type Action, type GameState } from "@inferno/shared";

const BASE_ACTIONS: Action[] = [
  { kind: "move", dir: "up" },
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "jump" },
  { kind: "interact" },
  { kind: "wait" },
];

export interface Solution {
  actions: Action[];
  /** Steps on the route where at least one available action would kill the hero. */
  dangerSteps: number;
}

/** Everything that affects future play on the current floor (turn count excluded). */
export function stateKey(s: GameState): string {
  const floor = s.floors[s.currentFloor]!;
  return JSON.stringify([
    s.currentFloor,
    s.hero,
    s.inventory.map((i) => i.id),
    floor.entities.map((e) => [e.x, e.y, e.state]),
  ]);
}

function actionsFor(s: GameState): Action[] {
  return [...BASE_ACTIONS, ...s.inventory.map((i): Action => ({ kind: "use", itemId: i.id }))];
}

/**
 * Shortest route from `start` to climbing the current floor's stairs up (or ending the game),
 * by breadth-first search over engine states. Deaths, no-effect turns and leaving the floor any
 * other way are dead ends. Returns null if the floor cannot be finished.
 */
export function solveFloor(start: GameState, maxStates = 2_000_000): Solution | null {
  const floorId = start.currentFloor;
  const queue: { state: GameState; path: Action[] }[] = [{ state: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  for (let head = 0; head < queue.length; head++) {
    const { state, path } = queue[head]!;
    for (const action of actionsFor(state)) {
      const r = applyTurn(state, action);
      if (r.outcome === "floor_up" && state.currentFloor === floorId) {
        const actions = [...path, action];
        return { actions, dangerSteps: countDanger(start, actions) };
      }
      if (r.outcome) continue; // died, no_effect, fell, floor_down
      const key = stateKey(r.state);
      if (seen.has(key)) continue;
      if (seen.size >= maxStates) throw new Error(`gave up after ${maxStates} states`);
      seen.add(key);
      queue.push({ state: r.state, path: [...path, action] });
    }
  }
  return null;
}

function countDanger(start: GameState, actions: Action[]): number {
  let state = start;
  let danger = 0;
  for (const action of actions) {
    if (actionsFor(state).some((a) => applyTurn(state, a).outcome === "died")) danger++;
    state = applyTurn(state, action).state;
  }
  return danger;
}

/** A copy of `game` with the hero at the start of the given floor. */
export function atFloorStart(game: GameState, floorId: string): GameState {
  const s = structuredClone(game);
  const { start } = s.floors[floorId]!.def;
  s.currentFloor = floorId;
  s.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
  return s;
}

export function formatAction(a: Action): string {
  switch (a.kind) {
    case "move":
      return { up: "↑", down: "↓", left: "←", right: "→" }[a.dir];
    case "use":
      return `use(${a.itemId})`;
    default:
      return a.kind;
  }
}
