import type { EntityType } from "../registry.js";
import { stringListProp, validateTargets } from "./props.js";

/**
 * Lever: blocks movement; Interact pulls it (one-way) and switches on its `targets`, which may
 * be on other floors ("floorId/entityId"). Stays pulled on floor reset, matching the doors it
 * opened (which stay open).
 */
export const lever: EntityType = {
  kind: "lever",
  initialState: () => ({ pulled: false }),
  blocksMove: () => true,
  onInteract(ctx, e) {
    if (e.state.pulled) return false;
    e.state.pulled = true;
    ctx.markChanged(e);
    ctx.signal(stringListProp(e.props, "targets"), true, { sourceId: e.id, latch: true });
    return true;
  },
  onFloorReset: (current) => current,
  validate: (e, floor, all) => validateTargets("lever", e, floor, all, true),
};
