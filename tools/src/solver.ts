/**
 * Floor solver and analyser: breadth-first search over engine states.
 *
 * - solveFloor: the shortest route that climbs the floor's stairs up (holding the items in the
 *   floor's `carry` list). Used by the bots and the `solve` CLI.
 * - analyseFloor: the same search over every reachable state, deaths included, to find softlocks:
 *   states reachable from the floor's start from which the stairs can no longer be reached.
 * - solveCampaign: every floor in order, each starting from the state the previous floor's route
 *   left behind (inventory, cross-floor effects), the way the crowd will actually meet it.
 *
 * On floors with an echo, each turn is an (action, runner-up vote) pair, since the runner-up
 * drives the echo. The search assumes a perfectly coordinated crowd: support is 1 when it agrees,
 * and 0.6 when it deliberately splits its vote.
 */
import { createHash } from "node:crypto";
import {
  actionKey,
  applyTurn,
  UNANIMOUS,
  type Action,
  type Crowd,
  type GameState,
} from "@inferno/shared";

const BASE_ACTIONS: Action[] = [
  { kind: "move", dir: "up" },
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "jump" },
  { kind: "interact" },
  { kind: "wait" },
];

/** Runner-up votes that make the echo do something (wait and use leave it standing). */
const DISSENT_ACTIONS: Action[] = BASE_ACTIONS.filter((a) => a.kind !== "wait");

/** Support assumed when the crowd splits its vote on purpose. */
export const SPLIT_SUPPORT = 0.6;

export interface Move {
  action: Action;
  crowd: Crowd;
}

export interface Solution {
  actions: Action[];
  moves: Move[];
  /** Steps on the route where at least one available move would kill the hero. */
  dangerSteps: number;
  /** Steps on the route that need a deliberate runner-up vote (to drive the echo). */
  splitSteps: number;
}

export interface Analysis {
  solution: Solution | null;
  /** Distinct states reached. */
  states: number;
  /** Reachable states that can no longer finish the floor; null if not checked. */
  softlocks: number | null;
  /** The shortest route into a softlock, when there is one. */
  softlockRoute?: Move[];
}

/** Everything that affects future play on the current floor (turn count excluded). */
export function stateKey(s: GameState): string {
  const floor = s.floors[s.currentFloor]!;
  return JSON.stringify([
    s.currentFloor,
    s.hero,
    s.inventory.map((i) => i.id),
    floor.frozen ?? 0,
    floor.entities.map((e) => [e.x, e.y, e.state]),
  ]);
}

function hashKey(s: GameState): string {
  return createHash("sha1").update(stateKey(s)).digest("base64");
}

function hasEcho(s: GameState): boolean {
  return s.floors[s.currentFloor]!.entities.some((e) => e.kind === "echo");
}

export function movesFor(s: GameState): Move[] {
  const actions = [
    ...BASE_ACTIONS,
    ...s.inventory.map((i): Action => ({ kind: "use", itemId: i.id })),
  ];
  const unanimous = actions.map((action) => ({ action, crowd: UNANIMOUS }));
  if (!hasEcho(s)) return unanimous;
  const split: Move[] = [];
  for (const action of actions) {
    for (const dissent of DISSENT_ACTIONS) {
      if (actionKey(dissent) === actionKey(action)) continue;
      split.push({ action, crowd: { support: SPLIT_SUPPORT, dissent } });
    }
  }
  return [...unanimous, ...split];
}

/**
 * A copy of the state holding only the floors a turn on the current floor can touch: the floor
 * itself, its neighbours (stairs up and down) and pit landing floors. Cloning 30 floors every turn would
 * dominate the search; signals to floors left out are simply dropped.
 */
export function trimState(s: GameState): GameState {
  const keep = new Set([s.currentFloor]);
  const i = s.floorOrder.indexOf(s.currentFloor);
  if (i > 0) keep.add(s.floorOrder[i - 1]!);
  if (i + 1 < s.floorOrder.length) keep.add(s.floorOrder[i + 1]!);
  for (const e of s.floors[s.currentFloor]!.entities) {
    const landing = e.props.landing as { floor?: unknown } | undefined;
    if (typeof landing?.floor === "string") keep.add(landing.floor);
  }
  const floors = Object.fromEntries(
    Object.entries(s.floors).filter(([id]) => keep.has(id)),
  ) as GameState["floors"];
  return structuredClone({ ...s, floors });
}

type Step = { to: "goal" } | { to: "dead" } | { to: "state"; state: GameState; died: boolean };

/** What a move leads to, seen from `floorId` (the floor being solved). */
function step(
  floorId: string,
  carry: readonly string[],
  s: GameState,
  move: Move,
  full: boolean,
): Step {
  const r = applyTurn(s, move.action, move.crowd);
  const back = (x: number, y: number): Step => {
    if (!full) return { to: "dead" };
    const state = structuredClone(r.state);
    state.currentFloor = floorId;
    state.hero = { x, y, facing: "up", stairsLock: false };
    return { to: "state", state, died: false };
  };
  switch (r.outcome) {
    case "floor_up": {
      const held = new Set(r.state.inventory.map((i) => i.id));
      if (carry.every((c) => held.has(c))) return { to: "goal" };
      // Left without something a later floor needs: the crowd must come back down for it.
      const up = s.floors[floorId]!.def.stairsUp!;
      return back(up.x, up.y);
    }
    case "floor_down":
    case "fell": {
      // Assume the crowd climbs back: it arrives at this floor's start, the floor as it left it.
      const { start } = s.floors[floorId]!.def;
      return back(start.x, start.y);
    }
    case "died":
      return { to: "state", state: r.state, died: true };
    default:
      return { to: "state", state: r.state, died: false };
  }
}

interface ExploreOptions {
  /** Explore everything reachable (for softlocks) instead of stopping at the first route. */
  full: boolean;
  maxStates: number;
}

function explore(start: GameState, opts: ExploreOptions): Analysis {
  const s0 = trimState(start);
  const floorId = s0.currentFloor;
  const carry = s0.floors[floorId]!.def.carry;
  const ids = new Map<string, number>([[hashKey(s0), 0]]);
  const queue: (GameState | null)[] = [s0];
  const parent: number[] = [-1];
  const via: (Move | null)[] = [null];
  // Full mode: edges (from → to); to = -1 means the move finishes the floor.
  const edgeFrom: number[] = [];
  const edgeTo: number[] = [];
  let goal: { from: number; move: Move } | null = null;

  for (let head = 0; head < queue.length; head++) {
    const state = queue[head]!;
    queue[head] = null; // free memory: only keys are kept
    for (const move of movesFor(state)) {
      const r = step(floorId, carry, state, move, opts.full);
      if (r.to === "dead") continue;
      if (r.to === "goal") {
        goal ??= { from: head, move };
        if (!opts.full) return finish(s0, parent, via, goal, ids.size, null);
        edgeFrom.push(head);
        edgeTo.push(-1);
        continue;
      }
      if (!opts.full && r.died) continue;
      const key = hashKey(r.state);
      let id = ids.get(key);
      if (id === undefined) {
        if (ids.size >= opts.maxStates) throw new Error(`gave up after ${opts.maxStates} states`);
        id = ids.size;
        ids.set(key, id);
        queue.push(r.state);
        parent.push(head);
        via.push(move);
      }
      if (opts.full) {
        edgeFrom.push(head);
        edgeTo.push(id);
      }
    }
  }
  if (!opts.full) return finish(s0, parent, via, goal, ids.size, null);

  // Which states can still finish? Walk the edges backwards from the finishing moves.
  const n = ids.size;
  const preds: number[][] = Array.from({ length: n }, () => []);
  const canFinish = new Uint8Array(n);
  const work: number[] = [];
  for (let i = 0; i < edgeFrom.length; i++) {
    const to = edgeTo[i]!;
    const from = edgeFrom[i]!;
    if (to === -1) {
      if (!canFinish[from]) {
        canFinish[from] = 1;
        work.push(from);
      }
    } else {
      preds[to]!.push(from);
    }
  }
  while (work.length) {
    const v = work.pop()!;
    for (const u of preds[v]!) {
      if (!canFinish[u]) {
        canFinish[u] = 1;
        work.push(u);
      }
    }
  }
  let softlocks = 0;
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (!canFinish[i]) {
      softlocks++;
      if (first < 0) first = i; // BFS order: the shallowest softlock
    }
  }
  const result = finish(s0, parent, via, goal, n, softlocks);
  if (first >= 0) result.softlockRoute = routeTo(parent, via, first);
  return result;
}

function routeTo(parent: number[], via: (Move | null)[], node: number): Move[] {
  const moves: Move[] = [];
  for (let v = node; v > 0; v = parent[v]!) moves.push(via[v]!);
  return moves.reverse();
}

function finish(
  s0: GameState,
  parent: number[],
  via: (Move | null)[],
  goal: { from: number; move: Move } | null,
  states: number,
  softlocks: number | null,
): Analysis {
  if (!goal) return { solution: null, states, softlocks };
  const moves = [...routeTo(parent, via, goal.from), goal.move];
  return {
    solution: {
      actions: moves.map((m) => m.action),
      moves,
      dangerSteps: countDanger(s0, moves),
      splitSteps: moves.filter((m) => m.crowd.dissent !== null).length,
    },
    states,
    softlocks,
  };
}

function countDanger(start: GameState, moves: Move[]): number {
  let state = start;
  let danger = 0;
  for (const move of moves) {
    if (movesFor(state).some((m) => applyTurn(state, m.action, m.crowd).outcome === "died"))
      danger++;
    state = applyTurn(state, move.action, move.crowd).state;
  }
  return danger;
}

/**
 * Shortest route from `start` to climbing the current floor's stairs up (or ending the game).
 * Deaths and leaving the floor any other way are dead ends. Returns null if the floor cannot be
 * finished.
 */
export function solveFloor(start: GameState, maxStates = 2_000_000): Solution | null {
  return explore(start, { full: false, maxStates }).solution;
}

/** Shortest route with the search figures, without the softlock check. */
export function solveFloorWithStats(start: GameState, maxStates = 2_000_000): Analysis {
  return explore(start, { full: false, maxStates });
}

/** Shortest route plus a softlock check over every reachable state. */
export function analyseFloor(start: GameState, maxStates = 1_500_000): Analysis {
  return explore(start, { full: true, maxStates });
}

/** A copy of `game` with the hero at the start of the given floor. */
export function atFloorStart(game: GameState, floorId: string): GameState {
  const s = structuredClone(game);
  const { start } = s.floors[floorId]!.def;
  s.currentFloor = floorId;
  s.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
  return s;
}

export interface FloorReport extends Analysis {
  floorId: string;
  /** Set when the analysis could not run (e.g. too many states). */
  error?: string;
}

/**
 * Solve every floor in order. Each floor starts from the state the previous floor's route left
 * (so carried items and cross-floor levers count). With `softlocks`, each floor is also fully
 * analysed; if that is too big, it falls back to just solving and reports the error.
 */
export function solveCampaign(
  game: GameState,
  opts: {
    softlocks: boolean;
    maxStates?: number;
    /** Only analyse floors this accepts; the others are just solved, to carry their state on. */
    analyse?: (floorId: string) => boolean;
    /** Stop once this floor is done. */
    stopAfter?: (floorId: string) => boolean;
    onFloor?: (r: FloorReport) => void;
  },
): FloorReport[] {
  const reports: FloorReport[] = [];
  let state = atFloorStart(game, game.floorOrder[0]!);
  for (const floorId of game.floorOrder) {
    if (state.currentFloor !== floorId) state = atFloorStart(state, floorId);
    let report: FloorReport;
    try {
      report =
        opts.softlocks && (opts.analyse?.(floorId) ?? true)
          ? { floorId, ...analyseFloor(state, opts.maxStates) }
          : { floorId, ...explore(state, { full: false, maxStates: opts.maxStates ?? 2_000_000 }) };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      report = { floorId, ...explore(state, { full: false, maxStates: 4_000_000 }), error };
    }
    reports.push(report);
    opts.onFloor?.(report);
    if (opts.stopAfter?.(floorId)) break;
    if (report.solution) {
      for (const m of report.solution.moves) state = applyTurn(state, m.action, m.crowd).state;
    }
  }
  return reports;
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

export function formatMove(m: Move): string {
  const a = formatAction(m.action);
  return m.crowd.dissent ? `${a}|${formatAction(m.crowd.dissent)}` : a;
}
