/** Convert engine state into protocol shapes sent to clients. */
import type { Entity, FloorState, Hero, InventoryItemView } from "../protocol.js";
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

export interface TurnDelta {
  /** Entities that changed or came into view; ones that left view are sent with state.hidden. */
  changes: Entity[];
  /** Tiles that became visible this turn (darkness). */
  revealed: { x: number; y: number; ch: string }[];
  /** Tiles that went dark this turn (darkness). */
  hidden: { x: number; y: number }[];
}

/**
 * What a `turn` message must carry for a turn that stayed on the same floor: changed entities,
 * entities that came into or went out of view, and tiles that were revealed or went dark.
 */
export function turnDelta(
  before: GameState,
  after: GameState,
  changed: readonly string[],
): TurnDelta {
  const rb = revealFor(before);
  const ra = revealFor(after);
  const floorBefore = before.floors[before.currentFloor]!;
  const floorAfter = after.floors[after.currentFloor]!;
  const { def } = floorAfter;

  const revealed: TurnDelta["revealed"] = [];
  const hidden: TurnDelta["hidden"] = [];
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      const was = rb(x, y);
      const now = ra(x, y);
      if (now && !was) revealed.push({ x, y, ch: def.terrain[y]![x]! });
      else if (was && !now) hidden.push({ x, y });
    }
  }

  const wasVisible = new Map(
    floorBefore.entities.map((e) => [e.id, !isHidden(e) && rb(e.x, e.y)] as const),
  );
  const changedIds = new Set(changed);
  const changes: Entity[] = [];
  for (const e of floorAfter.entities) {
    const was = wasVisible.get(e.id) ?? false;
    const now = !isHidden(e) && ra(e.x, e.y);
    if (now && (!was || changedIds.has(e.id))) changes.push(toProtocolEntity(e));
    else if (!now && was)
      changes.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, state: { hidden: true } });
  }
  return { changes, revealed, hidden };
}

export function toProtocolInventory(state: GameState): InventoryItemView[] {
  return state.inventory.map((i) => ({ id: i.id, type: i.type as InventoryItemView["type"] }));
}
