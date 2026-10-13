import type { EntityType } from "../registry.js";
import { stringListProp } from "./props.js";

/**
 * Lever: blocks movement; Interact pulls it (one-way) and switches on its `targets`.
 * Stays pulled on floor reset, matching the doors it opened (which stay open).
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
  validate(e, floor) {
    const targets = stringListProp(e.props, "targets");
    if (targets.length === 0) return [`lever "${e.id}" has no targets`];
    const ids = new Set(floor.entities.map((x) => x.id));
    return targets.filter((t) => !ids.has(t)).map((t) => `lever "${e.id}" targets unknown "${t}"`);
  },
};
