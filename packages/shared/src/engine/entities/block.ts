import { pushBody } from "../bodies.js";
import type { EntityType } from "../registry.js";

/**
 * Push block. Moving into it pushes it one tile, if that tile is free: no wall, no stairs, no
 * blocking entity or other body (so no chains of blocks). On ice it slides until stopped. The
 * hero cannot jump over it. Pushed into lava or a hole, it fills the tile (state.filled) and from
 * then on is plain floor. A puzzle element: on death it returns to its start tile (the default
 * reset), which also un-fills lava and holes.
 */
export const block: EntityType = {
  kind: "block",
  initialState: () => ({ filled: false }),
  blocksMove: (e) => !e.state.filled,
  isBody: (e) => !e.state.filled,
  coversHazard: (e) => e.state.filled === true,
  onPushed: (ctx, e, dx, dy) => pushBody(ctx, e, dx, dy),
};
