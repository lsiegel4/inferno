/**
 * Bodies: solid things other than the hero that occupy a tile (blocks, statues, patrols, the
 * echo). Shared rules for where they may go, pushing, sliding on ice and filling holes.
 */
import { TERRAIN, terrainAt } from "../floor.js";
import type { TurnContext } from "./context.js";
import { blocksEntry, blocksMove, isBody, isRemoved } from "./registry.js";
import { isCovered, isHazardTile, isIce } from "./transitions.js";
import type { RuntimeEntity } from "./types.js";

/** Is any body other than `self` on this tile? */
export function bodyAt(ctx: TurnContext, x: number, y: number, self?: RuntimeEntity): boolean {
  return ctx.entitiesAt(x, y).some((o) => o !== self && isBody(o));
}

/** Is the tile weighed down: the hero or any body stands on it? */
export function weighed(ctx: TurnContext, x: number, y: number): boolean {
  return ctx.heroAt(x, y) || bodyAt(ctx, x, y);
}

/**
 * May a body travelling (dx, dy) move onto this tile? Not a wall or stairs, nothing blocking,
 * no other body, no hero, no moving platform. Hazards are allowed: what happens there is up to
 * the body (a block fills lava, the echo dissolves).
 */
export function bodyCanEnter(
  ctx: TurnContext,
  x: number,
  y: number,
  dx: number,
  dy: number,
  self: RuntimeEntity,
): boolean {
  const t = terrainAt(ctx.floor.def, x, y);
  if (t === TERRAIN.wall || t === TERRAIN.stairsUp || t === TERRAIN.stairsDown) return false;
  if (ctx.heroAt(x, y)) return false;
  const there = ctx.entitiesAt(x, y).filter((o) => o !== self && !isRemoved(o));
  return !there.some(
    (o) => blocksMove(o) || blocksEntry(o, dx, dy) || isBody(o) || o.kind === "platform",
  );
}

/**
 * Push a solid body (block, statue) one tile, sliding on across ice. Pushed into a hole it fills
 * it (state.filled) and from then on is plain floor; a hidden trap it falls into is revealed.
 * Returns false if it could not move.
 */
export function pushBody(ctx: TurnContext, e: RuntimeEntity, dx: number, dy: number): boolean {
  if (e.state.filled) return false;
  if (!bodyCanEnter(ctx, e.x + dx, e.y + dy, dx, dy, e)) return false;
  moveBody(ctx, e, e.x + dx, e.y + dy);
  while (
    !e.state.filled &&
    isIce(ctx, e.x, e.y) &&
    bodyCanEnter(ctx, e.x + dx, e.y + dy, dx, dy, e)
  ) {
    moveBody(ctx, e, e.x + dx, e.y + dy);
  }
  return true;
}

/**
 * Move a solid body (block, statue) onto a tile. Onto a hole it falls in and fills it; a hidden
 * trap there springs (and is revealed) the same way.
 */
export function moveBody(ctx: TurnContext, e: RuntimeEntity, x: number, y: number): void {
  const trap = ctx.entitiesAt(x, y).find((o) => o.kind === "trap" && !isRemoved(o));
  const hole = isHazardTile(ctx, x, y) || (trap !== undefined && !isCovered(ctx, x, y));
  e.x = x;
  e.y = y;
  ctx.markChanged(e);
  if (!hole) return;
  e.state.filled = true;
  if (trap && !trap.state.discovered) {
    trap.state.discovered = true;
    ctx.markChanged(trap);
  }
}
