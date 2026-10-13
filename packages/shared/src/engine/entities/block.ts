import { TERRAIN, terrainAt } from "../../floor.js";
import { blocksMove, coversHazard, isRemoved, type EntityType } from "../registry.js";

/**
 * Push block. Moving into it pushes it one tile, if that tile is free: no wall, no stairs, no
 * blocking entity (so no chains of blocks). The hero cannot jump over it. Pushed into lava or a
 * pit, it fills the tile (state.filled) and from then on is plain floor. A puzzle element: on
 * death it returns to its start tile (the default reset), which also un-fills lava and pits.
 */
export const block: EntityType = {
  kind: "block",
  initialState: () => ({ filled: false }),
  blocksMove: (e) => !e.state.filled,
  coversHazard: (e) => e.state.filled === true,
  onPushed(ctx, e, dx, dy) {
    if (e.state.filled) return false;
    const x = e.x + dx;
    const y = e.y + dy;
    const t = terrainAt(ctx.floor.def, x, y);
    if (t === TERRAIN.wall || t === TERRAIN.stairsUp || t === TERRAIN.stairsDown) return false;
    const there = ctx.entitiesAt(x, y).filter((o) => !isRemoved(o));
    if (there.some(blocksMove)) return false;
    const covered = there.some(coversHazard);
    const hazard = t === TERRAIN.lava || there.some((o) => o.kind === "pit");
    e.x = x;
    e.y = y;
    if (hazard && !covered) e.state.filled = true;
    ctx.markChanged(e);
    return true;
  },
};
