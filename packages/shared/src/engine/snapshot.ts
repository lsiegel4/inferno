/**
 * Game snapshots for crash recovery (ADR-0009). A snapshot holds only what changes during play;
 * floor layouts come from the floor files when the snapshot is restored.
 */
import type { FloorDef } from "../floor.js";
import { createGame } from "./game.js";
import type { FloorRuntime, GameState } from "./types.js";

/** Per-floor runtime state without the static definition and reset baseline. */
export type FloorSnapshot = Omit<FloorRuntime, "def" | "initial">;

export interface GameSnapshot {
  version: 1;
  floorOrder: string[];
  currentFloor: string;
  hero: GameState["hero"];
  inventory: GameState["inventory"];
  turn: number;
  gameOver: boolean;
  floors: Record<string, FloorSnapshot>;
}

export class SnapshotMismatchError extends Error {}

export function serializeGame(state: GameState): GameSnapshot {
  const floors: Record<string, FloorSnapshot> = {};
  for (const [id, floor] of Object.entries(state.floors)) {
    const rest: Partial<FloorRuntime> = { ...floor };
    delete rest.def;
    delete rest.initial;
    floors[id] = structuredClone(rest) as FloorSnapshot;
  }
  return structuredClone({
    version: 1,
    floorOrder: state.floorOrder,
    currentFloor: state.currentFloor,
    hero: state.hero,
    inventory: state.inventory,
    turn: state.turn,
    gameOver: state.gameOver,
    floors,
  });
}

/** Rebuild a game from floor files plus a snapshot. The floor set must match the snapshot's. */
export function restoreGame(floorDefs: readonly FloorDef[], snap: GameSnapshot): GameState {
  const state = createGame(floorDefs);
  if (JSON.stringify(state.floorOrder) !== JSON.stringify(snap.floorOrder)) {
    throw new SnapshotMismatchError(
      `floor files (${state.floorOrder.join(", ")}) do not match the snapshot (${snap.floorOrder.join(", ")})`,
    );
  }
  for (const id of state.floorOrder)
    Object.assign(state.floors[id]!, structuredClone(snap.floors[id]));
  state.currentFloor = snap.currentFloor;
  state.hero = structuredClone(snap.hero);
  state.inventory = structuredClone(snap.inventory);
  state.turn = snap.turn;
  state.gameOver = snap.gameOver;
  return state;
}
