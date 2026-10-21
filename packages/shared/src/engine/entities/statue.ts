import { bodyCanEnter, moveBody, pushBody } from "../bodies.js";
import type { TurnContext } from "../context.js";
import type { EntityType } from "../registry.js";
import { revealFor } from "../reveal.js";
import { die, isHazardTile } from "../transitions.js";
import { WORLD_PHASE, type RuntimeEntity } from "../types.js";

/**
 * Watcher statue. While the hero watches it, it is stone: it can be pushed like a block (and
 * fills lava or holes like one). The moment the hero stops watching, it steps one tile toward the
 * hero each world step, and reaching the hero kills.
 *
 * The hero watches a statue when it is lit (revealed) and lies in front of the hero: strictly
 * on the side the hero faces (facing up, any tile with a smaller y). Beside or behind, it moves.
 * It steps along the longer axis toward the hero first (ties: horizontal), else the other axis;
 * it will not enter walls, lava, visible holes, or anything solid, so walls and blocks hold it.
 * A hidden trap swallows it like a block. It weighs down plates and holds doors. Resets on death.
 */
export const statue: EntityType = {
  kind: "statue",
  worldPhase: WORLD_PHASE.statue,
  initialState: () => ({ filled: false, watched: true }),
  blocksMove: (e) => !e.state.filled,
  isBody: (e) => !e.state.filled,
  coversHazard: (e) => e.state.filled === true,
  onPushed: (ctx, e, dx, dy) => pushBody(ctx, e, dx, dy),
  onWorldStep(ctx, e) {
    if (e.state.filled) return;
    const watched = isWatched(ctx, e);
    if (watched !== e.state.watched) {
      e.state.watched = watched;
      ctx.markChanged(e);
    }
    if (watched) return;
    for (const [dx, dy] of stepsToward(ctx, e)) {
      const x = e.x + dx,
        y = e.y + dy;
      if (ctx.heroAt(x, y)) {
        e.x = x;
        e.y = y;
        ctx.markChanged(e);
        return die(ctx);
      }
      if (!bodyCanEnter(ctx, x, y, dx, dy, e) || isHazardTile(ctx, x, y)) continue;
      moveBody(ctx, e, x, y);
      return;
    }
  },
};

export function isWatched(ctx: TurnContext, e: RuntimeEntity): boolean {
  const { x, y, facing } = ctx.state.hero;
  const inFront =
    (facing === "up" && e.y < y) ||
    (facing === "down" && e.y > y) ||
    (facing === "left" && e.x < x) ||
    (facing === "right" && e.x > x);
  return inFront && revealFor(ctx.state)(e.x, e.y);
}

function stepsToward(ctx: TurnContext, e: RuntimeEntity): [number, number][] {
  const dx = ctx.state.hero.x - e.x;
  const dy = ctx.state.hero.y - e.y;
  const h: [number, number] = [Math.sign(dx), 0];
  const v: [number, number] = [0, Math.sign(dy)];
  const steps = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
  return steps.filter(([a, b]) => a !== 0 || b !== 0);
}
