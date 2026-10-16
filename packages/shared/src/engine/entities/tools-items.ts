import type { EntityType, ItemType } from "../registry.js";
import { isHazardTile } from "../transitions.js";

/**
 * Plank: `use` while facing lava or a hole lays a bridge over it for good. The bridge survives
 * deaths and the plank is never returned, so a plank laid in the wrong place is lost.
 */
export const plank: ItemType = {
  type: "plank",
  onUseAt(ctx, item, x, y) {
    if (!isHazardTile(ctx, x, y)) return false;
    const id = `${item.id}-bridge`;
    ctx.floor.entities.push({ id, kind: "bridge", x, y, props: {}, state: { placed: true } });
    ctx.changed.add(id);
    ctx.spendItem(item, false);
    ctx.emit({ type: "item_used", itemId: item.id, on: id });
    return true;
  },
};

/** A laid plank: covers the lava or hole under it, permanently. */
export const bridge: EntityType = {
  kind: "bridge",
  coversHazard: () => true,
  keepOnReset: () => true,
};

export const HOURGLASS_TURNS = 3;

/**
 * Hourglass: `use` (facing anything) freezes this floor's world for the next three world steps:
 * platforms, patrols, statues and fire vents stand still. The echo still acts (it follows votes,
 * not time). Returned if the hero dies on this floor.
 */
export const hourglass: ItemType = {
  type: "hourglass",
  onUseAt(ctx, item) {
    if ((ctx.floor.frozen ?? 0) > 0) return false;
    ctx.floor.frozen = HOURGLASS_TURNS;
    ctx.spendItem(item, true);
    ctx.emit({ type: "item_used", itemId: item.id, on: ctx.floor.def.id });
    return true;
  },
};
