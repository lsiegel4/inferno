/** Hero movement onto tiles, floor transitions, and death with floor reset. */
import { TERRAIN, terrainAt } from "../floor.js";
import type { TurnContext } from "./context.js";
import {
  blocksEntry,
  blocksMove,
  coversHazard,
  entityType,
  isHazardEntity,
  isRemoved,
} from "./registry.js";
import { cloneEntity, cloneJson } from "./clone.js";
import { DELTAS } from "./types.js";

/**
 * True if the hero cannot enter this tile (wall or a blocking entity). Lava is enterable. With a
 * direction of travel, one-way tiles that refuse that direction also block.
 */
export function isBlocked(ctx: TurnContext, x: number, y: number, dx = 0, dy = 0): boolean {
  if (terrainAt(ctx.floor.def, x, y) === TERRAIN.wall) return true;
  return ctx.entitiesAt(x, y).some((e) => blocksMove(e) || blocksEntry(e, dx, dy));
}

/** True if something (e.g. a block that filled it) turns this tile's hazard into plain floor. */
export function isCovered(ctx: TurnContext, x: number, y: number): boolean {
  return ctx.entitiesAt(x, y).some(coversHazard);
}

/** True if this tile is lava or a hole (pit, trap, collapsed floor) that nothing covers. */
export function isHazardTile(ctx: TurnContext, x: number, y: number): boolean {
  if (isCovered(ctx, x, y)) return false;
  return (
    terrainAt(ctx.floor.def, x, y) === TERRAIN.lava || ctx.entitiesAt(x, y).some(isHazardEntity)
  );
}

export function isIce(ctx: TurnContext, x: number, y: number): boolean {
  return terrainAt(ctx.floor.def, x, y) === TERRAIN.ice && !isCovered(ctx, x, y);
}

/**
 * Move the hero onto a tile and apply whatever is there. On ice the hero keeps sliding in the
 * direction it faces until something blocks it or it reaches a tile that is not ice.
 */
export function moveHeroTo(ctx: TurnContext, x: number, y: number): void {
  const hero = ctx.state.hero;
  const [dx, dy] = DELTAS[hero.facing];
  for (let guard = 0; guard < 1000; guard++) {
    enterTile(ctx, x, y);
    if (ctx.outcome && ctx.outcome !== "no_effect") return;
    if (hero.x !== x || hero.y !== y || !isIce(ctx, x, y)) return; // teleported, or off the ice
    if (isBlocked(ctx, x + dx, y + dy, dx, dy)) return;
    x += dx;
    y += dy;
  }
}

function enterTile(ctx: TurnContext, x: number, y: number): void {
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
    if (isRemoved(e)) continue;
    entityType(e.kind).onEnter?.(ctx, e);
    if (ctx.outcome && ctx.outcome !== "no_effect") return;
    if (hero.x !== x || hero.y !== y) return; // teleported
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
    const copy = cloneEntity(kept);
    if (JSON.stringify(copy) !== JSON.stringify(current)) ctx.changed.add(copy.id);
    return copy;
  });
  // Entities placed during play (not in the floor file, e.g. a torch's light) are removed. They
  // are kept as tombstones (state.removed) so clients can be told they disappeared. A few (a laid
  // plank) are permanent and survive the reset unchanged.
  const initialIds = new Set(floor.initial.map((e) => e.id));
  for (const e of previous) {
    if (initialIds.has(e.id) || e.state.removed === true) continue;
    if (entityType(e.kind).keepOnReset?.(e)) {
      floor.entities.push(cloneEntity(e));
      continue;
    }
    floor.entities.push({ ...cloneEntity(e), state: { ...cloneJson(e.state), removed: true } });
    ctx.changed.add(e.id);
  }
  for (const s of floor.spent) if (s.returnOnReset) state.inventory.push(s.item);
  floor.spent = [];
  floor.frozen = 0;
  const { start } = floor.def;
  state.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
  ctx.setOutcome("died");
  ctx.emit({ type: "died", floorId: floor.def.id });
}
