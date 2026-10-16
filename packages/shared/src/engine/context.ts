import type { Action, TurnOutcome } from "../protocol.js";
import { cloneEntity, cloneItem } from "./clone.js";
import { entityType, type SignalSource } from "./registry.js";
import {
  UNANIMOUS,
  type Crowd,
  type FloorRuntime,
  type GameEvent,
  type GameState,
  type InventoryItem,
  type RuntimeEntity,
} from "./types.js";

/** Separates a floor id from an entity id in a cross-floor signal target ("floor-3/door-a"). */
export const REMOTE_SEPARATOR = "/";

/** Mutable view of one turn in progress, handed to entity hooks. */
export class TurnContext {
  readonly events: GameEvent[] = [];
  readonly changed = new Set<string>();
  outcome: TurnOutcome | undefined;
  /** While set, `floor` is this floor instead of the hero's (cross-floor signals). */
  private remoteFloor: string | null = null;
  /** Floors whose mutable parts this turn has already copied (see `floor`). */
  private readonly owned = new Set<string>();

  constructor(
    readonly state: GameState,
    readonly action: Action = { kind: "wait" },
    readonly crowd: Crowd = UNANIMOUS,
  ) {}

  /**
   * The floor hooks are working on. Floors are copy-on-write: `applyTurn` starts from a shallow
   * copy of the state, and a floor's entities and spent items are copied the first time a turn
   * touches it. Floor definitions and reset baselines never change and stay shared.
   */
  get floor(): FloorRuntime {
    const id = this.remoteFloor ?? this.state.currentFloor;
    if (!this.owned.has(id)) {
      const f = this.state.floors[id]!;
      this.state.floors[id] = {
        ...f,
        entities: f.entities.map(cloneEntity),
        spent: f.spent.map((sp) => ({ item: cloneItem(sp.item), returnOnReset: sp.returnOnReset })),
      };
      this.owned.add(id);
    }
    return this.state.floors[id]!;
  }

  /** True if the hero stands on (x, y) of the floor hooks are currently working on. */
  heroAt(x: number, y: number): boolean {
    if (this.remoteFloor && this.remoteFloor !== this.state.currentFloor) return false;
    return this.state.hero.x === x && this.state.hero.y === y;
  }

  entitiesAt(x: number, y: number): RuntimeEntity[] {
    return this.floor.entities.filter((e) => e.x === x && e.y === y);
  }

  entityById(id: string): RuntimeEntity | undefined {
    return this.floor.entities.find((e) => e.id === id);
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  markChanged(e: RuntimeEntity): void {
    // Only entities on the hero's floor are sent to clients as changes.
    if (this.remoteFloor && this.remoteFloor !== this.state.currentFloor) return;
    this.changed.add(e.id);
  }

  /** The first outcome wins, except that a real outcome replaces "no_effect". */
  setOutcome(outcome: TurnOutcome): void {
    if (this.outcome === undefined || this.outcome === "no_effect") this.outcome = outcome;
  }

  /**
   * Send an on/off signal from `source` to each target. A target is an entity id on the current
   * floor, or "floorId/entityId" for an entity on another floor (latching signals only).
   */
  signal(targets: readonly string[], on: boolean, source: SignalSource): void {
    for (const id of targets) {
      const sep = id.indexOf(REMOTE_SEPARATOR);
      if (sep >= 0) {
        if (source.latch)
          this.onFloor(id.slice(0, sep), () => this.signalOne(id.slice(sep + 1), on, source));
        continue;
      }
      this.signalOne(id, on, source);
    }
  }

  private signalOne(id: string, on: boolean, source: SignalSource): void {
    const target = this.entityById(id);
    if (target) entityType(target.kind).onSignal?.(this, target, on, source);
  }

  /** Run `fn` with `floor` pointing at another floor. */
  onFloor(floorId: string, fn: () => void): void {
    if (!this.state.floors[floorId]) return;
    const previous = this.remoteFloor;
    this.remoteFloor = floorId;
    try {
      fn();
    } finally {
      this.remoteFloor = previous;
    }
  }

  giveItem(item: InventoryItem): void {
    this.state.inventory.push(item);
  }

  /** Take back an item that was spent on this floor (e.g. a weight stone picked up again). */
  reclaimItem(item: InventoryItem): void {
    this.floor.spent = this.floor.spent.filter((s) => s.item.id !== item.id);
    this.giveItem(item);
  }

  /** Remove an item from the inventory and remember it for floor resets. */
  spendItem(item: InventoryItem, returnOnReset: boolean): void {
    this.state.inventory = this.state.inventory.filter((i) => i.id !== item.id);
    this.floor.spent.push({ item, returnOnReset });
  }
}
