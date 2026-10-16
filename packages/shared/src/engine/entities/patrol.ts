import { bodyCanEnter } from "../bodies.js";
import type { EntityType } from "../registry.js";
import { die, isHazardTile } from "../transitions.js";
import { DELTAS, WORLD_PHASE } from "../types.js";
import type { Direction } from "../../protocol.js";
import { stringProp } from "./props.js";

const STEPS: Record<string, Direction | null> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
  W: null,
};

/**
 * Patrol (a demon on its rounds). Walks its `route`, a looping string of steps (U, D, L, R, or W
 * to wait), one step per world step. Touching it kills: walking into it, or it walking into you.
 * It cannot be jumped over (nor can any enemy). It is a body: it weighs down plates and
 * holds doors. When its next tile is blocked (a wall, a closed door, a block, the echo...) or is
 * lava or a hole, it waits there and tries again next turn, so a pushed block can pin it in place.
 * Clients see only `next`, the step it will try next turn, not the whole route. Resets on death.
 */
export const patrol: EntityType = {
  kind: "patrol",
  worldPhase: WORLD_PHASE.patrol,
  initialState: (p) => ({ i: 0, next: nextStep(p.props, 0) }),
  isBody: () => true,
  blocksJump: () => true,
  onEnter: (ctx) => die(ctx),
  killsHero: () => true,
  onWorldStep(ctx, e) {
    const route = stringProp(e.props, "route") ?? "W";
    const i = e.state.i as number;
    const dir = STEPS[route[i % route.length]!];
    if (dir) {
      const [dx, dy] = DELTAS[dir];
      const x = e.x + dx,
        y = e.y + dy;
      if (ctx.heroAt(x, y)) {
        e.x = x;
        e.y = y;
        ctx.markChanged(e);
        return die(ctx);
      }
      if (!bodyCanEnter(ctx, x, y, dx, dy, e) || isHazardTile(ctx, x, y)) return; // wait it out
      e.x = x;
      e.y = y;
    }
    e.state.i = (i + 1) % route.length;
    e.state.next = nextStep(e.props, e.state.i as number);
    ctx.markChanged(e);
  },
  view: (e) => ({ kind: "patrol", state: { next: e.state.next } }),
  validate(e) {
    const route = stringProp(e.props, "route");
    if (!route || !/^[UDLRW]+$/.test(route))
      return [`patrol "${e.id}" route must be U/D/L/R/W steps`];
    return [];
  },
};

function nextStep(props: Record<string, unknown>, i: number): string {
  const route = stringProp(props, "route") ?? "W";
  return STEPS[route[i % route.length]!] ?? "wait";
}
