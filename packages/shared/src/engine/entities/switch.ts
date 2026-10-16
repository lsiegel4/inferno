import type { EntityType } from "../registry.js";
import { stringListProp, validateTargets } from "./props.js";

/**
 * Switch (toggle lever): blocks movement; Interact flips it. While on it holds its targets on
 * like a plate does; flipping it back lets go. Several switches on one door make an any-of,
 * all-of (`need`) or lights-out (`parity`) lock; see activation.ts. A puzzle element: switches
 * and the doors they hold reset on death.
 */
export const toggleSwitch: EntityType = {
  kind: "switch",
  initialState: () => ({ on: false }),
  blocksMove: () => true,
  onInteract(ctx, e) {
    e.state.on = !e.state.on;
    ctx.markChanged(e);
    ctx.signal(stringListProp(e.props, "targets"), e.state.on as boolean, {
      sourceId: e.id,
      latch: false,
    });
    return true;
  },
  validate: (e, floor, all) => validateTargets("switch", e, floor, all, false),
};
