/**
 * Bridges the client's game view to the shared floor renderer (playtest/render.ts), which draws
 * every entity kind the engine knows.
 */
import type { Entity, FloorState } from "@inferno/shared";
import type { FloorView } from "../game/store.js";

/** Entities to draw in the main view: only those on currently visible tiles (beams reach across). */
export function visibleEntities(floor: FloorView): Entity[] {
  return Object.values(floor.entities).filter(
    (e) => e.kind === "beam" || (floor.tiles[e.y]?.[e.x] ?? " ") !== " ",
  );
}

/** The floor in protocol shape, as the renderer expects it. */
export function toSceneFloor(floor: FloorView, entities: Entity[]): FloorState {
  return {
    floorId: floor.floorId,
    index: floor.index,
    ...(floor.name ? { name: floor.name } : {}),
    width: floor.width,
    height: floor.height,
    tiles: floor.tiles.join("\n"),
    explored: floor.explored.join("\n"),
    entities,
    minimumPlayers: floor.minimumPlayers,
  };
}
