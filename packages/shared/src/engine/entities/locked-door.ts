import type { EntityType } from "../registry.js";
import { stringProp } from "./props.js";

/**
 * Locked door: opened by using a key whose `opens` matches the door's `lock`.
 * The key is consumed and, because the door stays open on reset, never returned (game design §7).
 */
export const lockedDoor: EntityType = {
  kind: "locked_door",
  initialState: () => ({ open: false }),
  blocksMove: (e) => !e.state.open,
  onUse(ctx, e, item) {
    if (e.state.open || item.type !== "key") return false;
    if (stringProp(item.props, "opens") !== stringProp(e.props, "lock")) return false;
    e.state.open = true;
    ctx.markChanged(e);
    ctx.spendItem(item, false);
    ctx.emit({ type: "item_used", itemId: item.id, on: e.id });
    return true;
  },
  onFloorReset: (current) => current,
  validate: (e) => (stringProp(e.props, "lock") ? [] : [`locked door "${e.id}" has no lock`]),
};
