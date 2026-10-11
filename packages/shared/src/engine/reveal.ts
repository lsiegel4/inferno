/**
 * Darkness (game design §7a): which tiles of the current floor are revealed to players.
 *
 * Light sources are the hero (the floor's torchlight radius) and every `light` entity (its own
 * `radius` prop, or the floor radius). A tile is lit when it is within a source's radius,
 * measured as Euclidean distance (dx² + dy² ≤ r²). In line_of_sight mode the straight line
 * from the source to the tile must also be clear: walls and move-blocking entities (closed
 * doors, levers, signs, unpicked items...) stop sight, though the blocking tile itself is lit.
 * Lines are traced with Bresenham's algorithm.
 *
 * A lit tile is revealed even if the hero has no line of sight to it, so light sources show
 * what is around them. Nothing is remembered: tiles go dark again when no source reaches them.
 */
import { TERRAIN, terrainAt } from "../floor.js";
import { blocksMove, isRemoved } from "./registry.js";
import type { GameState } from "./types.js";
import type { RevealFn } from "./view.js";

interface Source {
  x: number;
  y: number;
  radius: number;
}

export function revealFor(state: GameState): RevealFn {
  const floor = state.floors[state.currentFloor]!;
  const { reveal } = floor.def;
  if (reveal.mode === "viewport") return () => true;

  const sources: Source[] = [{ x: state.hero.x, y: state.hero.y, radius: reveal.radius }];
  for (const e of floor.entities) {
    if (e.kind !== "light" || isRemoved(e)) continue;
    const r = e.props.radius;
    sources.push({ x: e.x, y: e.y, radius: typeof r === "number" ? r : reveal.radius });
  }

  const opaque = (x: number, y: number): boolean =>
    terrainAt(floor.def, x, y) === TERRAIN.wall ||
    floor.entities.some((e) => e.x === x && e.y === y && blocksMove(e));

  const lit = new Set<string>();
  for (const s of sources) {
    for (let y = s.y - s.radius; y <= s.y + s.radius; y++) {
      for (let x = s.x - s.radius; x <= s.x + s.radius; x++) {
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy > s.radius * s.radius) continue;
        if (reveal.mode === "line_of_sight" && !clearLine(s.x, s.y, x, y, opaque)) continue;
        lit.add(`${x},${y}`);
      }
    }
  }
  return (x, y) => lit.has(`${x},${y}`);
}

/** True if no tile strictly between (x0, y0) and (x1, y1) on a Bresenham line is opaque. */
export function clearLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opaque: (x: number, y: number) => boolean,
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if ((x !== x1 || y !== y1) && opaque(x, y)) return false;
  }
  return true;
}
