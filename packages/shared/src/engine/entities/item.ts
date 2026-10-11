import type { EntityType } from "../registry.js";
import { stringProp } from "./props.js";

export const ITEM_TYPES = ["key", "torch", "weight"] as const;

/**
 * Item lying on the floor. Blocks movement (it is picked up with Interact while facing it).
 * Once taken it disappears for good: a floor reset does not respawn it (items are kept on death).
 */
export const item: EntityType = {
  kind: "item",
  initialState: () => ({ taken: false }),
  blocksMove: (e) => !e.state.taken,
  hidden: (e) => e.state.taken === true,
  onInteract(ctx, e) {
    if (e.state.taken) return false;
    const { item: type, ...rest } = e.props;
    e.state.taken = true;
    ctx.markChanged(e);
    ctx.giveItem({ id: e.id, type: String(type), props: rest });
    ctx.emit({ type: "item_picked_up", itemId: e.id });
    return true;
  },
  onFloorReset: (current) => current,
  validate(e) {
    const type = stringProp(e.props, "item");
    if (!type || !(ITEM_TYPES as readonly string[]).includes(type)) {
      return [`item "${e.id}" has invalid item type "${String(e.props.item)}"`];
    }
    if (type === "key" && !stringProp(e.props, "opens")) return [`key "${e.id}" has no "opens"`];
    return [];
  },
};
