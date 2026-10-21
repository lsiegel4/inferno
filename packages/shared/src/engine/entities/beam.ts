import { TERRAIN, terrainAt } from "../../floor.js";
import type { TurnContext } from "../context.js";
import { blocksMove, isBody, isRemoved, type EntityType } from "../registry.js";
import { die } from "../transitions.js";
import { DELTAS, DIRECTIONS, type RuntimeEntity } from "../types.js";
import type { Direction } from "../../protocol.js";
import { isActive, receiveSignal } from "./activation.js";
import { dissolveEchoesAt } from "./echo.js";
import { stringListProp, validateTargets } from "./props.js";

type Tile = [number, number];

/**
 * Hellfire beam. An emitter (blocks movement) fires a beam in its `dir`. The beam runs until a
 * wall or something solid stops it: a closed door, a block, a statue, a patrol, a lever... Mirrors
 * turn it 90°. A receiver it reaches is lit. The beam burns: a hero ending a turn in it dies; the
 * echo dissolves. Beams give light, so they show their own path in the dark.
 *
 * Fires by default and its sources (lever, plate, switch) switch it off; with `off: true` it is
 * dark until switched on. The path is traced at the end of every turn, after doors settle.
 */
export const beam: EntityType = {
  kind: "beam",
  endPhase: 10,
  initialState: () => ({ firing: true, path: [], hits: [], latched: false, holders: [] }),
  blocksMove: () => true,
  onSignal(_ctx, e, on, source) {
    receiveSignal(e, on, source);
  },
  onTurnEnd(ctx, e) {
    const firing = e.props.off === true ? isActive(e) : !isActive(e);
    const { path, hits, hero } = firing ? trace(ctx, e) : { path: [], hits: [], hero: false };
    const before = JSON.stringify([e.state.firing, e.state.path]);
    e.state.firing = firing;
    e.state.path = path;
    e.state.hits = hits;
    if (JSON.stringify([firing, path]) !== before) ctx.markChanged(e);
    for (const [x, y] of path) dissolveEchoesAt(ctx, x, y);
    if (hero && ctx.outcome !== "died") die(ctx);
  },
  /** A lever's latch survives the reset (the lever stays pulled); everything else resets. */
  onFloorReset: (current, initial) =>
    current.state.latched ? { ...initial, state: { ...initial.state, latched: true } } : initial,
  extent: (e) => (e.state.firing ? (e.state.path as Tile[]) : []),
  lights: (e) => (e.state.path as Tile[]).map(([x, y]) => ({ x, y, radius: 0 })),
  view: (e) => ({
    kind: "beam",
    state: { dir: e.props.dir, firing: e.state.firing, path: e.state.path },
  }),
  validate: (e) =>
    (DIRECTIONS as readonly unknown[]).includes(e.props.dir)
      ? []
      : [`beam "${e.id}" needs dir up/down/left/right`],
};

/** Follow the beam from its emitter. `hits` are the solid tiles that stopped it. */
function trace(ctx: TurnContext, e: RuntimeEntity): { path: Tile[]; hits: Tile[]; hero: boolean } {
  let [dx, dy] = DELTAS[e.props.dir as Direction];
  let x = e.x,
    y = e.y;
  const path: Tile[] = [];
  const seen = new Set<string>();
  for (;;) {
    x += dx;
    y += dy;
    const key = `${x},${y},${dx},${dy}`;
    if (seen.has(key)) break;
    seen.add(key);
    if (terrainAt(ctx.floor.def, x, y) === TERRAIN.wall) break;
    const here = ctx.entitiesAt(x, y).filter((o) => !isRemoved(o));
    const mirror = here.find((o) => o.kind === "mirror");
    if (mirror) {
      path.push([x, y]);
      [dx, dy] = mirror.state.slant === "/" ? [-dy, -dx] : [dy, dx];
      continue;
    }
    if (ctx.heroAt(x, y)) {
      path.push([x, y]);
      return { path, hits: [], hero: true };
    }
    if (here.some((o) => o.kind === "echo")) {
      path.push([x, y]);
      continue; // it dissolves; the beam carries on through where it stood
    }
    if (here.some((o) => blocksMove(o) || isBody(o))) return { path, hits: [[x, y]], hero: false };
    path.push([x, y]);
  }
  return { path, hits: [], hero: false };
}

/** Mirror: blocks movement; Interact turns it between "/" and "\\". Resets on death. */
export const mirror: EntityType = {
  kind: "mirror",
  initialState: (p) => ({ slant: p.props.slant === "\\" ? "\\" : "/" }),
  blocksMove: () => true,
  onInteract(ctx, e) {
    e.state.slant = e.state.slant === "/" ? "\\" : "/";
    ctx.markChanged(e);
    return true;
  },
  validate: (e) =>
    e.props.slant === "/" || e.props.slant === "\\"
      ? []
      : [`mirror "${e.id}" slant must be / or \\`],
};

/**
 * Receiver: blocks movement; while a beam strikes it, it holds its `targets` on, like a plate.
 * With `latch: true`, the first strike switches them on for good (and may reach other floors).
 */
export const receiver: EntityType = {
  kind: "receiver",
  endPhase: 20,
  initialState: () => ({ lit: false, done: false }),
  blocksMove: () => true,
  onTurnEnd(ctx, e) {
    if (e.state.done) return;
    const lit = ctx.floor.entities.some(
      (b) =>
        b.kind === "beam" &&
        !isRemoved(b) &&
        (b.state.hits as Tile[]).some(([x, y]) => x === e.x && y === e.y),
    );
    if (lit === e.state.lit) return;
    e.state.lit = lit;
    ctx.markChanged(e);
    const latch = e.props.latch === true;
    if (latch) e.state.done = true;
    ctx.signal(stringListProp(e.props, "targets"), lit, { sourceId: e.id, latch });
  },
  onFloorReset: (current, initial) => (current.state.done ? current : initial),
  validate: (e, floor, all) => validateTargets("receiver", e, floor, all, e.props.latch === true),
};
