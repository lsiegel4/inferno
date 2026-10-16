import { TERRAIN, terrainAt } from "../../floor.js";
import type { TurnContext } from "../context.js";
import { coversHazard, isBody, isRemoved, type EntityType } from "../registry.js";
import { DELTAS, DIRECTIONS, OPPOSITE, WORLD_PHASE, type RuntimeEntity } from "../types.js";
import type { Direction } from "../../protocol.js";

/**
 * Moving platform (a ferry over lava). Each world step it moves one tile in its direction; when
 * the next tile is not open lava it turns back, so it shuttles across a lava lake. It covers the
 * lava under it and carries the hero standing on it. Nothing else rides it: bodies cannot enter
 * its tile. A puzzle element: on death it returns to its start.
 *
 * Props: `dir` (up/down/left/right), the direction it starts moving in.
 */
export const platform: EntityType = {
  kind: "platform",
  worldPhase: WORLD_PHASE.platform,
  initialState: (p) => ({ dir: p.props.dir }),
  coversHazard: () => true,
  onWorldStep(ctx, e) {
    const dir = e.state.dir as Direction;
    for (const d of [dir, OPPOSITE[dir]]) {
      const [dx, dy] = DELTAS[d];
      if (!canFloat(ctx, e, e.x + dx, e.y + dy)) continue;
      const carrying = ctx.heroAt(e.x, e.y);
      e.x += dx;
      e.y += dy;
      e.state.dir = d;
      ctx.markChanged(e);
      if (carrying) {
        ctx.state.hero.x = e.x;
        ctx.state.hero.y = e.y;
        ctx.emit({ type: "hero_moved" });
      }
      return;
    }
  },
  validate(e, floor) {
    const problems: string[] = [];
    if (!(DIRECTIONS as readonly unknown[]).includes(e.props.dir)) {
      problems.push(`platform "${e.id}" needs dir up/down/left/right`);
    }
    if (terrainAt(floor, e.x, e.y) !== TERRAIN.lava) {
      problems.push(`platform "${e.id}" must start on lava (legend "on": "L")`);
    }
    return problems;
  },
};

/** Open lava: lava terrain with nothing covering it and nothing standing in it. */
function canFloat(ctx: TurnContext, self: RuntimeEntity, x: number, y: number): boolean {
  if (terrainAt(ctx.floor.def, x, y) !== TERRAIN.lava) return false;
  return !ctx
    .entitiesAt(x, y)
    .some((o) => o !== self && !isRemoved(o) && (coversHazard(o) || isBody(o)));
}
