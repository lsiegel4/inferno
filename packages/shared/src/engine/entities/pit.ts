import type { EntityType } from "../registry.js";
import { terrainAt, TERRAIN, type FloorDef, type PlacedEntity } from "../../floor.js";
import { fallTo } from "../transitions.js";

interface Landing {
  floor: string;
  x: number;
  y: number;
}

export function landing(props: Record<string, unknown>): Landing | null {
  const l = props.landing as Partial<Landing> | undefined;
  if (!l || typeof l.floor !== "string" || typeof l.x !== "number" || typeof l.y !== "number") {
    return null;
  }
  return { floor: l.floor, x: l.x, y: l.y };
}

export function validateLanding(
  what: string,
  e: PlacedEntity,
  floor: FloorDef,
  all: ReadonlyMap<string, FloorDef>,
): string[] {
  const l = landing(e.props);
  if (!l) return [`${what} needs landing { floor, x, y }`];
  const target = all.get(l.floor);
  if (!target) return [`${what} lands on unknown floor "${l.floor}"`];
  if (target.index >= floor.index) return [`${what} must land on a lower floor`];
  const t = terrainAt(target, l.x, l.y);
  if (t === TERRAIN.wall || t === TERRAIN.lava) {
    return [`${what} lands on a wall or lava`];
  }
  return [];
}

/** Pit: stepping in drops the hero to a lower floor, at a landing spot set by the designer. */
export const pit: EntityType = {
  kind: "pit",
  isHazard: () => true,
  onEnter(ctx, e) {
    const l = landing(e.props);
    if (l) fallTo(ctx, l.floor, l.x, l.y);
  },
  validate: (e, floor, all) => validateLanding(`pit "${e.id}"`, e, floor, all),
};
