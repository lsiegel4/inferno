import type { Action } from "../protocol.js";
import { TERRAIN, terrainAt } from "../floor.js";
import { TurnContext } from "./context.js";
import { blocksJump, blocksMove, entityType, isRemoved, itemType } from "./registry.js";
import { isBlocked, moveHeroTo } from "./transitions.js";
import { DELTAS, type GameState, type RuntimeEntity, type TurnResult } from "./types.js";

/**
 * Apply one hero action (the winning vote). Pure: returns a new state.
 * Every call consumes a turn, including actions that turn out to be invalid (`no_effect`).
 */
export function applyTurn(state: GameState, action: Action): TurnResult {
  const next = structuredClone(state);
  const ctx = new TurnContext(next);

  if (next.gameOver) {
    return { state: next, outcome: "no_effect", events: [], changed: [] };
  }

  const effective = perform(ctx, action);
  if (!effective) ctx.setOutcome("no_effect");
  endTurn(ctx);
  next.turn += 1;

  return {
    state: next,
    ...(ctx.outcome ? { outcome: ctx.outcome } : {}),
    events: ctx.events,
    changed: [...ctx.changed],
  };
}

/** Returns false if the action had no effect. */
function perform(ctx: TurnContext, action: Action): boolean {
  const hero = ctx.state.hero;
  switch (action.kind) {
    case "move": {
      hero.facing = action.dir;
      const [dx, dy] = DELTAS[action.dir];
      const tx = hero.x + dx,
        ty = hero.y + dy;
      if (isBlocked(ctx, tx, ty)) push(ctx, tx, ty, dx, dy);
      if (isBlocked(ctx, tx, ty)) {
        ctx.emit({ type: "turned" }); // turn in place; still uses the turn
      } else {
        moveHeroTo(ctx, hero.x + dx, hero.y + dy);
      }
      return true;
    }
    case "jump": {
      const [dx, dy] = DELTAS[hero.facing];
      const mx = hero.x + dx,
        my = hero.y + dy;
      const lx = hero.x + 2 * dx,
        ly = hero.y + 2 * dy;
      const midBlocked =
        terrainAt(ctx.floor.def, mx, my) === TERRAIN.wall ||
        ctx.entitiesAt(mx, my).some(blocksJump);
      if (midBlocked || isBlocked(ctx, lx, ly)) return false;
      moveHeroTo(ctx, lx, ly);
      return true;
    }
    case "interact": {
      return facedEntities(ctx).some((e) => entityType(e.kind).onInteract?.(ctx, e) ?? false);
    }
    case "use": {
      const item = ctx.state.inventory.find((i) => i.id === action.itemId);
      if (!item) return false;
      if (facedEntities(ctx).some((e) => entityType(e.kind).onUse?.(ctx, e, item) ?? false)) {
        return true;
      }
      const [dx, dy] = DELTAS[hero.facing];
      return itemType(item.type)?.onUseAt?.(ctx, item, hero.x + dx, hero.y + dy) ?? false;
    }
    case "wait":
      return true;
  }
}

/** Let blocking entities in the way move aside (pushable blocks). Only the first one is tried. */
function push(ctx: TurnContext, x: number, y: number, dx: number, dy: number): void {
  const blocker = ctx.entitiesAt(x, y).find(blocksMove);
  if (blocker) entityType(blocker.kind).onPushed?.(ctx, blocker, dx, dy);
}

/** End-of-turn hooks (pressure plates, doors waiting to close) on the current floor. */
function endTurn(ctx: TurnContext): void {
  for (const e of [...ctx.floor.entities]) {
    if (!isRemoved(e)) entityType(e.kind).onTurnEnd?.(ctx, e);
  }
}

function facedEntities(ctx: TurnContext): RuntimeEntity[] {
  const { x, y, facing } = ctx.state.hero;
  const [dx, dy] = DELTAS[facing];
  return ctx.entitiesAt(x + dx, y + dy);
}
