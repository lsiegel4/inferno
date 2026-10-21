import { bodyAt } from "../bodies.js";
import type { InventoryItem } from "../types.js";
import type { TurnContext } from "../context.js";
import { isRemoved, type EntityType, type ItemType } from "../registry.js";
import type { RuntimeEntity } from "../types.js";
import { validateTargets } from "./props.js";
import { stringListProp } from "./props.js";

/**
 * Pressure plate (walkable). Weighed down by the hero standing on it, a body on it (block,
 * statue, patrol, the echo), or a weight stone placed on it. While weighed down it switches its
 * `targets` on; when released, off. Evaluated at the end of every turn; signals are sent only
 * when the state changes.
 *
 * Weight stone: `use(weight)` while facing the plate, or while standing on it (plates are
 * walkable, so a crowd can rarely turn to face one), places the stone; Interact while facing the
 * plate picks the stone back up. A stone left on a plate returns to the inventory on death (the plate
 * resets to empty and the stone is a returnable spent item).
 */
export const plate: EntityType = {
  kind: "plate",
  initialState: () => ({ pressed: false, stone: null }),
  onTurnEnd(ctx, e) {
    const pressed = ctx.heroAt(e.x, e.y) || e.state.stone !== null || bodyAt(ctx, e.x, e.y);
    if (pressed === e.state.pressed) return;
    e.state.pressed = pressed;
    ctx.markChanged(e);
    ctx.signal(stringListProp(e.props, "targets"), pressed, { sourceId: e.id, latch: false });
  },
  onUse: (ctx, e, item) => placeStone(ctx, e, item),
  onInteract(ctx, e) {
    const stone = e.state.stone as InventoryItem | null;
    if (!stone) return false;
    e.state.stone = null;
    ctx.markChanged(e);
    ctx.reclaimItem(stone);
    ctx.emit({ type: "item_picked_up", itemId: stone.id });
    return true;
  },
  validate: (e, floor, all) => validateTargets("plate", e, floor, all, false),
};

function placeStone(ctx: TurnContext, e: RuntimeEntity, item: InventoryItem): boolean {
  if (item.type !== "weight" || e.state.stone !== null) return false;
  e.state.stone = item;
  ctx.markChanged(e);
  ctx.spendItem(item, true);
  ctx.emit({ type: "item_used", itemId: item.id, on: e.id });
  return true;
}

/** Weight stone not used on a faced plate: put it on the plate the hero stands on, if any. */
export const weight: ItemType = {
  type: "weight",
  onUseAt(ctx, item) {
    const { x, y } = ctx.state.hero;
    const under = ctx.entitiesAt(x, y).find((e) => e.kind === "plate" && !isRemoved(e));
    return under ? placeStone(ctx, under, item) : false;
  },
};
