/** Hero movement onto tiles, floor transitions, and death with floor reset. */
import { TERRAIN, terrainAt } from "../floor.js";
import type { TurnContext } from "./context.js";
import { blocksMove, coversHazard, entityType } from "./registry.js";

/** True if the hero cannot enter this tile (wall or a blocking entity). Lava is enterable. */
export function isBlocked(ctx: TurnContext, x: number, y: number): boolean {
  if (terrainAt(ctx.floor.def, x, y) === TERRAIN.wall) return true;
  return ctx.entitiesAt(x, y).some(blocksMove);
}

/** True if something (e.g. a block that filled it) turns this tile's hazard into plain floor. */
export function isCovered(ctx: TurnContext, x: number, y: number): boolean {
  return ctx.entitiesAt(x, y).some(coversHazard);
}

/** Move the hero onto a tile and apply whatever is there. */
export function moveHeroTo(ctx: TurnContext, x: number, y: number): void {
  const hero = ctx.state.hero;
  hero.x = x;
  hero.y = y;
  hero.stairsLock = false;
  ctx.emit({ type: "hero_moved" });

  const t = terrainAt(ctx.floor.def, x, y);
  if (isCovered(ctx, x, y)) return;
  if (t === TERRAIN.lava) return die(ctx);
  if (t === TERRAIN.stairsUp) return climb(ctx);
  if (t === TERRAIN.stairsDown) return descend(ctx);
  for (const e of ctx.entitiesAt(x, y)) {
    entityType(e.kind).onEnter?.(ctx, e);
    if (ctx.outcome) return;
  }
}

/** Stairs up: arrive at the next floor's start point. Climbing the last floor ends the game. */
function climb(ctx: TurnContext): void {
  const { state } = ctx;
  const i = state.floorOrder.indexOf(state.currentFloor);
  const next = state.floorOrder[i + 1];
  if (!next) {
    state.gameOver = true;
    ctx.setOutcome("floor_up");
    ctx.emit({ type: "game_over" });
    return;
  }
  const from = state.currentFloor;
  state.currentFloor = next;
  const { start } = state.floors[next]!.def;
  state.hero.x = start.x;
  state.hero.y = start.y;
  ctx.setOutcome("floor_up");
  ctx.emit({ type: "floor_changed", from, to: next, how: "up" });
}

/** Stairs down: arrive on the previous floor's stairs-up tile, locked until stepping off. */
function descend(ctx: TurnContext): void {
  const { state } = ctx;
  const i = state.floorOrder.indexOf(state.currentFloor);
  const prev = state.floorOrder[i - 1];
  const target = prev ? state.floors[prev]!.def.stairsUp : null;
  if (!prev || !target) return; // rejected by floor validation; treat as plain floor
  const from = state.currentFloor;
  state.currentFloor = prev;
  state.hero.x = target.x;
  state.hero.y = target.y;
  state.hero.stairsLock = true;
  ctx.setOutcome("floor_down");
  ctx.emit({ type: "floor_changed", from, to: prev, how: "down" });
}

/** Pit fall: land on a designer-chosen tile of a lower floor. The landing tile is not triggered. */
export function fallTo(ctx: TurnContext, floorId: string, x: number, y: number): void {
  const { state } = ctx;
  const from = state.currentFloor;
  state.currentFloor = floorId;
  state.hero.x = x;
  state.hero.y = y;
  state.hero.stairsLock = false;
  ctx.setOutcome("fell");
  ctx.emit({ type: "floor_changed", from, to: floorId, how: "fell" });
}

/**
 * Death: the hero returns to the floor's start and the floor resets (game design §7.2).
 * Each entity type decides what survives the reset; returnable spent items go back.
 */
export function die(ctx: TurnContext): void {
  const { state } = ctx;
  const floor = ctx.floor;
  const previous = floor.entities;
  floor.entities = floor.initial.map((initial) => {
    const current = previous.find((e) => e.id === initial.id) ?? initial;
    const t = entityType(initial.kind);
    const kept = t.onFloorReset ? t.onFloorReset(current, initial) : initial;
    const copy = structuredClone(kept);
    if (JSON.stringify(copy) !== JSON.stringify(current)) ctx.changed.add(copy.id);
    return copy;
  });
  // Entities placed during play (not in the floor file, e.g. a torch's light) are removed. They
  // are kept as tombstones (state.removed) so clients can be told they disappeared.
  const initialIds = new Set(floor.initial.map((e) => e.id));
  for (const e of previous) {
    if (initialIds.has(e.id) || e.state.removed === true) continue;
    floor.entities.push({ ...structuredClone(e), state: { ...e.state, removed: true } });
    ctx.changed.add(e.id);
  }
  for (const s of floor.spent) if (s.returnOnReset) state.inventory.push(s.item);
  floor.spent = [];
  const { start } = floor.def;
  state.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
  ctx.setOutcome("died");
  ctx.emit({ type: "died", floorId: floor.def.id });
}
