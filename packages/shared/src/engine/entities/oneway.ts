import type { EntityType } from "../registry.js";
import { DELTAS, DIRECTIONS } from "../types.js";
import type { Direction } from "../../protocol.js";

/**
 * One-way tile (an arrow in the floor). It can be entered only travelling in its `dir` (walking,
 * jumping, sliding or pushed); leaving is free. It commits the crowd to a route.
 */
export const oneway: EntityType = {
  kind: "oneway",
  blocksEntry(e, dx, dy) {
    if (dx === 0 && dy === 0) return false;
    const [ax, ay] = DELTAS[e.props.dir as Direction];
    return dx !== ax || dy !== ay;
  },
  validate: (e) =>
    (DIRECTIONS as readonly unknown[]).includes(e.props.dir)
      ? []
      : [`oneway "${e.id}" needs dir up/down/left/right`],
};
