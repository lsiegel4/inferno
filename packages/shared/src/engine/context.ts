import type { TurnOutcome } from "../protocol.js";
import { entityType } from "./registry.js";
import type { FloorRuntime, GameEvent, GameState, InventoryItem, RuntimeEntity } from "./types.js";

/** Mutable view of one turn in progress, handed to entity hooks. */
export class TurnContext {
  readonly events: GameEvent[] = [];
  readonly changed = new Set<string>();
  outcome: TurnOutcome | undefined;

  constructor(readonly state: GameState) {}

  get floor(): FloorRuntime {
    return this.state.floors[this.state.currentFloor]!;
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
    this.changed.add(e.id);
  }

  setOutcome(outcome: TurnOutcome): void {
    this.outcome ??= outcome;
  }

  /** Send an on/off signal to each target entity id on the current floor. */
  signal(targets: readonly string[], on: boolean): void {
    for (const id of targets) {
      const target = this.entityById(id);
      if (target) entityType(target.kind).onSignal?.(this, target, on);
    }
  }

  giveItem(item: InventoryItem): void {
    this.state.inventory.push(item);
  }

  /** Remove an item from the inventory and remember it for floor resets. */
  spendItem(item: InventoryItem, returnOnReset: boolean): void {
    this.state.inventory = this.state.inventory.filter((i) => i.id !== item.id);
    this.floor.spent.push({ item, returnOnReset });
  }
}
