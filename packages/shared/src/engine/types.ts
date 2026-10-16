import type { Action, Direction, Hero, TurnOutcome } from "../protocol.js";
import type { FloorDef } from "../floor.js";

/** An entity at runtime: static `props` from the floor legend plus mutable `state`. */
export interface RuntimeEntity {
  id: string;
  kind: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
}

export interface InventoryItem {
  /** Instance id (the id of the entity it was picked up from). Used in `use(itemId)`. */
  id: string;
  /** Item type, e.g. "key", "torch", "weight". */
  type: string;
  props: Record<string, unknown>;
}

/** An item used on a floor, remembered so a floor reset can decide whether to return it. */
export interface SpentItem {
  item: InventoryItem;
  returnOnReset: boolean;
}

export interface FloorRuntime {
  def: FloorDef;
  entities: RuntimeEntity[];
  /** Entities as they were when the floor was first loaded; the baseline for floor resets. */
  initial: RuntimeEntity[];
  spent: SpentItem[];
  /** World steps still frozen by an hourglass (0 or absent: the world moves normally). */
  frozen?: number;
}

export interface GameHero extends Hero {
  /**
   * True while the hero stands on the stairs-up tile it arrived on by going down.
   * Stepping off clears it; the hero must step off and back on to climb (game design §6).
   */
  stairsLock: boolean;
}

export interface GameState {
  /** Floor ids in floor order (index 1 first). */
  floorOrder: string[];
  floors: Record<string, FloorRuntime>;
  currentFloor: string;
  hero: GameHero;
  inventory: InventoryItem[];
  turn: number;
  gameOver: boolean;
}

/**
 * How the crowd voted for this turn (ADR-0017 plurality). `support` is the winning action's share
 * of the votes cast (1 with a single voter). `dissent` is the runner-up action, the one the
 * Shade of Dissent performs; null when everyone agreed.
 */
export interface Crowd {
  support: number;
  dissent: Action | null;
}

export const UNANIMOUS: Crowd = { support: 1, dissent: null };

export type GameEvent =
  | { type: "hero_moved" }
  | { type: "turned" }
  | { type: "died"; floorId: string }
  | { type: "floor_changed"; from: string; to: string; how: "up" | "down" | "fell" }
  | { type: "item_picked_up"; itemId: string }
  | { type: "item_used"; itemId: string; on: string }
  | { type: "sign_read"; entityId: string; text: string }
  | { type: "entity_changed"; entityId: string }
  | { type: "echo_dissolved"; entityId: string }
  | { type: "game_over" };

export interface TurnResult {
  state: GameState;
  outcome?: TurnOutcome;
  events: GameEvent[];
  /** Ids of entities on the current floor whose position or state changed this turn. */
  changed: string[];
}

export const DELTAS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * World-step phases (EntityType.worldPhase), lowest first. Platforms carry the hero before
 * anything else moves; the echo acts on the crowd's dissent; patrols and statues then move;
 * timed hazards (fire vents) advance last.
 */
export const WORLD_PHASE = { platform: 10, echo: 20, patrol: 30, statue: 40, timer: 50 } as const;

export const DIRECTIONS = ["up", "down", "left", "right"] as const;

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
