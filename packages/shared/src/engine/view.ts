/** Convert engine state into protocol shapes sent to clients. */
import type { Entity, FloorState, Hero } from "../protocol.js";
import type { FloorDef } from "../floor.js";
import { isHidden } from "./registry.js";
import { revealFor } from "./reveal.js";
import type { GameState, RuntimeEntity } from "./types.js";

/** Decides whether a tile is revealed to clients (see reveal.ts for darkness). */
export type RevealFn = (x: number, y: number) => boolean;
export const revealAll: RevealFn = () => true;

/** Terrain rows joined by "\n"; unrevealed tiles become " ". */
export function encodeTerrain(def: FloorDef, reveal: RevealFn = revealAll): string {
  return def.terrain
    .map((row, y) => [...row].map((ch, x) => (reveal(x, y) ? ch : " ")).join(""))
    .join("\n");
}

export function toProtocolEntity(e: RuntimeEntity): Entity {
  return { id: e.id, kind: e.kind, x: e.x, y: e.y, state: { ...e.props, ...e.state } };
}

function visibleEntities(entities: readonly RuntimeEntity[], reveal: RevealFn): Entity[] {
  return entities.filter((e) => !isHidden(e) && reveal(e.x, e.y)).map(toProtocolEntity);
}

/** The current floor as clients see it: unrevealed terrain and entities are left out. */
export function toFloorState(state: GameState, reveal: RevealFn = revealFor(state)): FloorState {
  const floor = state.floors[state.currentFloor]!;
  const { def } = floor;
  return {
    floorId: def.id,
    index: def.index,
    width: def.width,
    height: def.height,
    tiles: encodeTerrain(def, reveal),
    entities: visibleEntities(floor.entities, reveal),
    minimumPlayers: def.minimumPlayers,
  };
}

export function toProtocolHero(state: GameState): Hero {
  const { x, y, facing } = state.hero;
  return { x, y, facing };
}

/**
 * Entities to send in a `turn` message. A changed entity that became hidden is sent with
 * `state.hidden: true` so clients can remove it. Changes on unrevealed tiles are left out.
 */
export function turnChanges(
  state: GameState,
  changed: readonly string[],
  reveal: RevealFn = revealFor(state),
): Entity[] {
  const floor = state.floors[state.currentFloor]!;
  return changed.flatMap((id) => {
    const e = floor.entities.find((x) => x.id === id);
    if (!e) return [];
    const out = toProtocolEntity(e);
    if (isHidden(e)) return [{ ...out, state: { hidden: true } }];
    return reveal(e.x, e.y) ? [out] : [];
  });
}
