import { TERRAIN, terrainAt } from "../../floor.js";
import { blocksMove, isRemoved, type EntityType, type ItemType } from "../registry.js";

/**
 * Light source (darkness, game design §7a). Reveals tiles within its `radius` prop, or the
 * floor's torchlight radius when it has none. Does not block movement.
 */
export const light: EntityType = {
  kind: "light",
  validate(e) {
    const r = e.props.radius;
    if (r === undefined || (typeof r === "number" && Number.isInteger(r) && r >= 0)) return [];
    return [`light "${e.id}" radius must be a non-negative integer`];
  },
};

/**
 * Torch: `use` while facing an open tile (not a wall, nothing blocking, no light already) places
 * a light there and consumes the torch. Like other items used on a floor, the torch is returned
 * on floor reset and its light is removed.
 */
export const torch: ItemType = {
  type: "torch",
  onUseAt(ctx, item, x, y) {
    if (terrainAt(ctx.floor.def, x, y) === TERRAIN.wall) return false;
    const here = ctx.entitiesAt(x, y).filter((e) => !isRemoved(e));
    if (here.some(blocksMove) || here.some((e) => e.kind === "light")) return false;
    const id = `${item.id}-light`;
    const placed = { id, kind: "light", x, y, props: {}, state: { placed: true } };
    ctx.floor.entities = ctx.floor.entities.filter((e) => e.id !== id).concat(placed);
    ctx.changed.add(id);
    ctx.spendItem(item, true);
    ctx.emit({ type: "item_used", itemId: item.id, on: id });
    return true;
  },
};
