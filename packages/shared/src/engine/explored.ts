/**
 * The shared explored-floor map (game design §9.1). A tile is explored once it has appeared in
 * the camera window while revealed (on dark floors: while lit). Explored tiles are part of the
 * game state, so they are saved in snapshots, rebuilt identically on replay, and kept on death.
 */
import { revealFor } from "./reveal.js";
import type { GameState } from "./types.js";

/** Size of the follow camera's window, in tiles. */
export const VIEW_WIDTH = 9;
export const VIEW_HEIGHT = 13;

/** Top-left tile of the camera window: centred on the hero, clamped to the floor's edges. */
export function cameraOrigin(
  hero: { x: number; y: number },
  floor: { width: number; height: number },
): { x: number; y: number } {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.max(0, max), v));
  return {
    x: clamp(hero.x - Math.floor(VIEW_WIDTH / 2), floor.width - VIEW_WIDTH),
    y: clamp(hero.y - Math.floor(VIEW_HEIGHT / 2), floor.height - VIEW_HEIGHT),
  };
}

/** Mark every revealed tile in the camera window as explored (mutates `state`). */
export function exploreAroundHero(state: GameState): void {
  const floor = state.floors[state.currentFloor]!;
  const { width, height } = floor.def;
  const reveal = revealFor(state);
  const origin = cameraOrigin(state.hero, floor.def);
  const explored = new Set(floor.explored);
  const before = explored.size;
  for (let y = origin.y; y < Math.min(height, origin.y + VIEW_HEIGHT); y++) {
    for (let x = origin.x; x < Math.min(width, origin.x + VIEW_WIDTH); x++) {
      if (reveal(x, y)) explored.add(y * width + x);
    }
  }
  if (explored.size !== before) floor.explored = [...explored].sort((a, b) => a - b);
}

/** Lookup for a floor's explored tiles. */
export function exploredFn(state: GameState): (x: number, y: number) => boolean {
  const floor = state.floors[state.currentFloor]!;
  const set = new Set(floor.explored);
  return (x, y) => set.has(y * floor.def.width + x);
}
