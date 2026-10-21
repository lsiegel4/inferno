/** Convert engine state into protocol shapes sent to clients. */
import type { Entity, FloorState, Hero, InventoryItemView } from "../protocol.js";
import type { FloorDef } from "../floor.js";
import { exploredFn } from "./explored.js";
import { entityType, isHidden } from "./registry.js";
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

/**
 * Props that describe hidden wiring rather than what can be seen: which doors a lever, plate or
 * switch drives, where a portal leads, a patrol's whole route. Clients are not sent them; the
 * crowd has to find out by trying (game design: non-local consequences).
 */
const WIRING_PROPS = new Set(["targets", "to", "route", "landing", "on"]);

export function toProtocolEntity(e: RuntimeEntity): Entity {
  const custom = entityType(e.kind).view?.(e);
  if (custom) return { id: e.id, kind: custom.kind, x: e.x, y: e.y, state: custom.state };
  const props = Object.fromEntries(Object.entries(e.props).filter(([k]) => !WIRING_PROPS.has(k)));
  return { id: e.id, kind: e.kind, x: e.x, y: e.y, state: { ...props, ...e.state } };
}

function visibleEntities(entities: readonly RuntimeEntity[], reveal: RevealFn): Entity[] {
  return entities.filter((e) => isVisible(e, reveal)).map(toProtocolEntity);
}

/**
 * Is the entity in view? Its own tile must be revealed, or, for something that reaches across the
 * floor (a beam), any tile it covers.
 */
export function isVisible(e: RuntimeEntity, reveal: RevealFn): boolean {
  if (isHidden(e)) return false;
  if (reveal(e.x, e.y)) return true;
  return (entityType(e.kind).extent?.(e) ?? []).some(([x, y]) => reveal(x, y));
}

/** Entities are sent when their tile is revealed now or has been explored (for the floor map). */
function entityVisibility(state: GameState): RevealFn {
  const reveal = revealFor(state);
  const explored = exploredFn(state);
  return (x, y) => reveal(x, y) || explored(x, y);
}

/** The current floor as clients see it: unrevealed terrain and entities are left out. */
export function toFloorState(state: GameState, reveal: RevealFn = revealFor(state)): FloorState {
  const floor = state.floors[state.currentFloor]!;
  const { def } = floor;
  const explored = exploredFn(state);
  const visible: RevealFn = (x, y) => reveal(x, y) || explored(x, y);
  return {
    floorId: def.id,
    index: def.index,
    ...(def.name ? { name: def.name } : {}),
    width: def.width,
    height: def.height,
    tiles: encodeTerrain(def, reveal),
    explored: encodeTerrain(def, explored),
    entities: visibleEntities(floor.entities, visible),
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
  /** Tiles added to the explored floor map this turn. */
  explored: { x: number; y: number; ch: string }[];
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
  const eb = exploredFn(before);
  const ea = exploredFn(after);
  const vb = entityVisibility(before);
  const va = entityVisibility(after);
  const floorBefore = before.floors[before.currentFloor]!;
  const floorAfter = after.floors[after.currentFloor]!;
  const { def } = floorAfter;

  const revealed: TurnDelta["revealed"] = [];
  const hidden: TurnDelta["hidden"] = [];
  const explored: TurnDelta["explored"] = [];
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      const was = rb(x, y);
      const now = ra(x, y);
      if (now && !was) revealed.push({ x, y, ch: def.terrain[y]![x]! });
      else if (was && !now) hidden.push({ x, y });
      if (ea(x, y) && !eb(x, y)) explored.push({ x, y, ch: def.terrain[y]![x]! });
    }
  }

  const wasVisible = new Map(floorBefore.entities.map((e) => [e.id, isVisible(e, vb)] as const));
  const changedIds = new Set(changed);
  const changes: Entity[] = [];
  for (const e of floorAfter.entities) {
    const was = wasVisible.get(e.id) ?? false;
    const now = isVisible(e, va);
    if (now && (!was || changedIds.has(e.id))) changes.push(toProtocolEntity(e));
    else if (!now && was)
      changes.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, state: { hidden: true } });
  }
  return { changes, revealed, hidden, explored };
}

export function toProtocolInventory(state: GameState): InventoryItemView[] {
  return state.inventory.map((i) => ({ id: i.id, type: i.type as InventoryItemView["type"] }));
}
