import type { EntityType } from "../registry.js";
import { terrainAt, TERRAIN } from "../../floor.js";
import { fallTo } from "../transitions.js";

interface Landing {
  floor: string;
  x: number;
  y: number;
}

function landing(props: Record<string, unknown>): Landing | null {
  const l = props.landing as Partial<Landing> | undefined;
  if (!l || typeof l.floor !== "string" || typeof l.x !== "number" || typeof l.y !== "number") {
    return null;
  }
  return { floor: l.floor, x: l.x, y: l.y };
}

/** Pit: stepping in drops the hero to a lower floor, at a landing spot set by the designer. */
export const pit: EntityType = {
  kind: "pit",
  onEnter(ctx, e) {
    const l = landing(e.props);
    if (l) fallTo(ctx, l.floor, l.x, l.y);
  },
  validate(e, floor, all) {
    const l = landing(e.props);
    if (!l) return [`pit "${e.id}" needs landing { floor, x, y }`];
    const target = all.get(l.floor);
    if (!target) return [`pit "${e.id}" lands on unknown floor "${l.floor}"`];
    if (target.index >= floor.index) return [`pit "${e.id}" must land on a lower floor`];
    const t = terrainAt(target, l.x, l.y);
    if (t === TERRAIN.wall || t === TERRAIN.lava) {
      return [`pit "${e.id}" lands on a wall or lava`];
    }
    return [];
  },
};
