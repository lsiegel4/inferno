/**
 * Entity-type registry (ADR-0019). Each mechanic is a self-contained module implementing
 * EntityType and registered once in entities/index.ts; the core engine only calls these hooks.
 */
import type { FloorDef, PlacedEntity } from "../floor.js";
import type { InventoryItem, RuntimeEntity } from "./types.js";
import type { TurnContext } from "./context.js";

export interface EntityType {
  kind: string;
  /** Initial mutable state for a freshly loaded entity. */
  initialState?(placed: PlacedEntity): Record<string, unknown>;
  /** Does this entity stop the hero from entering its tile? Default: false. */
  blocksMove?(e: RuntimeEntity): boolean;
  /** Does this entity stop the hero from jumping over it? Default: same as blocksMove. */
  blocksJump?(e: RuntimeEntity): boolean;
  /** Interact while facing this entity. Return false if it had no effect. */
  onInteract?(ctx: TurnContext, e: RuntimeEntity): boolean;
  /** `use(item)` while facing this entity. Return false if it had no effect. */
  onUse?(ctx: TurnContext, e: RuntimeEntity, item: InventoryItem): boolean;
  /** The hero stepped or landed on this entity's tile. */
  onEnter?(ctx: TurnContext, e: RuntimeEntity): void;
  /** A linked lever/plate switched this entity on or off. */
  onSignal?(ctx: TurnContext, e: RuntimeEntity, on: boolean, signal: SignalSource): void;
  /**
   * The hero moved into this (blocking) entity, travelling (dx, dy). Return true if the entity
   * moved out of the way (e.g. a pushed block); the hero then enters the tile.
   */
  onPushed?(ctx: TurnContext, e: RuntimeEntity, dx: number, dy: number): boolean;
  /**
   * Directional blocking (one-way tiles): may something travelling (dx, dy) enter this tile?
   * Checked in addition to blocksMove. Default: no extra restriction.
   */
  blocksEntry?(e: RuntimeEntity, dx: number, dy: number): boolean;
  /**
   * Is this a body: something solid that occupies its tile, weighs down pressure plates and keeps
   * doors from closing on it (blocks, statues, patrols, the echo)? Default: false.
   */
  isBody?(e: RuntimeEntity): boolean;
  /** Is this tile a hole (pit, trap, collapsed floor)? Pushed blocks fill holes. Default: false. */
  isHazard?(e: RuntimeEntity): boolean;
  /**
   * The world's move, after the hero acts (turn order: hero first, then the world). Entities
   * step in ascending `worldPhase` (default 0); see turn.ts for the phases.
   */
  worldPhase?: number;
  onWorldStep?(ctx: TurnContext, e: RuntimeEntity): void;
  /** After the world step: does this entity kill the hero standing on its tile? */
  killsHero?(ctx: TurnContext, e: RuntimeEntity): boolean;
  /** Called for every entity on the current floor after the world step, each turn. */
  onTurnEnd?(ctx: TurnContext, e: RuntimeEntity): void;
  /** Order of onTurnEnd calls, ascending (default 0). Beams run late, after doors settle. */
  endPhase?: number;
  /** Other tiles this entity covers (a beam's path): it is in view if any of them is. */
  extent?(e: RuntimeEntity): [number, number][];
  /** Light this entity casts, for darkness (lamps, beams). Default: none. */
  lights?(e: RuntimeEntity): { x: number; y: number; radius?: number }[];
  /**
   * What clients see. Default: the entity's kind with its props and state, minus wiring props
   * (see view.ts). Return a different kind to disguise it (a hinted trap looks like a crack).
   */
  view?(e: RuntimeEntity): { kind: string; state: Record<string, unknown> };
  /**
   * Does this entity cover its tile's hazard (e.g. a block that filled lava or a pit)? A covered
   * tile is plain floor: lava does not kill and other entities there do not trigger.
   */
  coversHazard?(e: RuntimeEntity): boolean;
  /**
   * Floor reset after a death. Default: restore the initial entity (puzzle elements reset).
   * Return the entity to keep (e.g. `current` for doors, which stay open).
   */
  onFloorReset?(current: RuntimeEntity, initial: RuntimeEntity): RuntimeEntity;
  /** Hidden from clients (e.g. a picked-up item). Default: visible. */
  hidden?(e: RuntimeEntity): boolean;
  /** Extra floor-file validation for this kind. */
  validate?(e: PlacedEntity, floor: FloorDef, all: ReadonlyMap<string, FloorDef>): string[];
}

/** Who sent a signal. Latching signals (levers) hold their target on for good. */
export interface SignalSource {
  sourceId: string;
  latch: boolean;
}

/**
 * Item behaviour for `use(item)` when no faced entity handles it, e.g. placing a torch on an
 * empty tile. Registered per item type alongside entity types.
 */
export interface ItemType {
  type: string;
  /** Use the item on the tile at (x, y) that the hero faces. Return false if it had no effect. */
  onUseAt?(ctx: TurnContext, item: InventoryItem, x: number, y: number): boolean;
}

const types = new Map<string, EntityType>();
const itemTypes = new Map<string, ItemType>();

export function registerItemType(t: ItemType): void {
  if (itemTypes.has(t.type)) throw new Error(`Item type "${t.type}" registered twice`);
  itemTypes.set(t.type, t);
}

export function itemType(type: string): ItemType | undefined {
  return itemTypes.get(type);
}

export function registerEntityType(t: EntityType): void {
  if (types.has(t.kind)) throw new Error(`Entity type "${t.kind}" registered twice`);
  types.set(t.kind, t);
}

export function entityType(kind: string): EntityType {
  const t = types.get(kind);
  if (!t) throw new Error(`Unknown entity kind "${kind}"`);
  return t;
}

export function hasEntityType(kind: string): boolean {
  return types.has(kind);
}

/** Entities placed during play (e.g. a torch's light) are marked removed on floor reset. */
export function isRemoved(e: RuntimeEntity): boolean {
  return e.state.removed === true;
}

export function blocksMove(e: RuntimeEntity): boolean {
  if (isRemoved(e)) return false;
  return entityType(e.kind).blocksMove?.(e) ?? false;
}

export function blocksJump(e: RuntimeEntity): boolean {
  const t = entityType(e.kind);
  return t.blocksJump ? t.blocksJump(e) : blocksMove(e);
}

export function coversHazard(e: RuntimeEntity): boolean {
  if (isRemoved(e)) return false;
  return entityType(e.kind).coversHazard?.(e) ?? false;
}

export function isBody(e: RuntimeEntity): boolean {
  if (isRemoved(e)) return false;
  return entityType(e.kind).isBody?.(e) ?? false;
}

export function isHazardEntity(e: RuntimeEntity): boolean {
  if (isRemoved(e)) return false;
  return entityType(e.kind).isHazard?.(e) ?? false;
}

export function blocksEntry(e: RuntimeEntity, dx: number, dy: number): boolean {
  if (isRemoved(e)) return false;
  return entityType(e.kind).blocksEntry?.(e, dx, dy) ?? false;
}

export function isHidden(e: RuntimeEntity): boolean {
  return isRemoved(e) || (entityType(e.kind).hidden?.(e) ?? false);
}
