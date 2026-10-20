import type { Action } from "../protocol.js";
import { cloneItem } from "./clone.js";
import { TurnContext } from "./context.js";
import { blocksJump, blocksMove, entityType, isRemoved, itemType } from "./registry.js";
import { die, isBlocked, isHazardTile, moveHeroTo } from "./transitions.js";
import {
  DELTAS,
  UNANIMOUS,
  WORLD_PHASE,
  type Crowd,
  type GameState,
  type RuntimeEntity,
  type TurnResult,
} from "./types.js";

/**
 * Apply one hero action (the winning vote). Pure: returns a new state.
 * Every call consumes a turn, including actions that turn out to be invalid (`no_effect`).
 *
 * Turn order: the hero acts first, then the world moves (platforms, the echo, patrols, statues,
 * fire vents), then end-of-turn rules settle (plates, doors, beams). `crowd` describes the vote
 * (support for the winner, the runner-up action); crowd-driven mechanics read it.
 */
export function applyTurn(state: GameState, action: Action, crowd: Crowd = UNANIMOUS): TurnResult {
  // Copy-on-write: floors are copied when the turn first touches them (TurnContext.floor).
  const next: GameState = {
    ...state,
    hero: { ...state.hero },
    inventory: state.inventory.map(cloneItem),
    floors: { ...state.floors },
  };
  const ctx = new TurnContext(next, action, crowd);

  if (next.gameOver) {
    return { state: next, outcome: "no_effect", events: [], changed: [] };
  }

  const effective = perform(ctx, action);
  if (!ctx.outcome) worldStep(ctx);
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
      if (isBlocked(ctx, tx, ty, dx, dy)) push(ctx, tx, ty, dx, dy);
      if (isBlocked(ctx, tx, ty, dx, dy)) {
        ctx.emit({ type: "turned" }); // turn in place; still uses the turn
      } else {
        moveHeroTo(ctx, tx, ty);
      }
      return true;
    }
    case "jump": {
      const landing = jumpLanding(ctx);
      if (!landing) return false;
      moveHeroTo(ctx, landing[0], landing[1]);
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
  const blocker = ctx.entitiesAt(x, y).find((e) => !isRemoved(e) && blocksMove(e));
  if (blocker) entityType(blocker.kind).onPushed?.(ctx, blocker, dx, dy);
}

function byPhase(entities: readonly RuntimeEntity[], phase: (e: RuntimeEntity) => number) {
  return entities
    .map((e, i) => ({ e, i, p: phase(e) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.e);
}

/**
 * The world moves after the hero, on the hero's floor. An hourglass freezes everything but the
 * echo (which is driven by votes, not by time). Afterwards the hero dies if it ends the world
 * step on something deadly (a patrol, a raised fire vent).
 */
function worldStep(ctx: TurnContext): void {
  const floor = ctx.floor;
  const frozen = (floor.frozen ?? 0) > 0;
  if (frozen) floor.frozen = floor.frozen! - 1;
  const movers = byPhase(
    floor.entities.filter((e) => !isRemoved(e) && entityType(e.kind).onWorldStep),
    (e) => entityType(e.kind).worldPhase ?? 0,
  );
  for (const e of movers) {
    const t = entityType(e.kind);
    if (frozen && t.worldPhase !== WORLD_PHASE.echo) continue;
    t.onWorldStep!(ctx, e);
    if (ctx.outcome) return;
  }
  const { x, y } = ctx.state.hero;
  for (const e of ctx.entitiesAt(x, y)) {
    if (!isRemoved(e) && entityType(e.kind).killsHero?.(ctx, e)) return die(ctx);
  }
}

/**
 * End-of-turn hooks (pressure plates, doors waiting to close, beams) on the current floor, in
 * ascending endPhase. If one of them kills the hero (a beam), they run once more on the reset
 * floor so plates and doors match it.
 */
function endTurn(ctx: TurnContext): void {
  const deaths = () => ctx.events.filter((e) => e.type === "died").length;
  for (let pass = 0; pass < 2; pass++) {
    const before = deaths();
    const entities = byPhase(
      ctx.floor.entities.filter((e) => !isRemoved(e)),
      (e) => entityType(e.kind).endPhase ?? 0,
    );
    for (const e of entities) {
      entityType(e.kind).onTurnEnd?.(ctx, e);
      if (deaths() > before) break;
    }
    if (deaths() === before) return;
  }
}

function facedEntities(ctx: TurnContext): RuntimeEntity[] {
  const { x, y, facing } = ctx.state.hero;
  const [dx, dy] = DELTAS[facing];
  return ctx.entitiesAt(x + dx, y + dy);
}

/**
 * Where a jump from the hero's tile would land, or null if it cannot be made. Only lava and
 * visible holes can be jumped (an unsprung trap is not a hole yet), never anything that blocks
 * jumps, and the landing tile must be enterable.
 */
function jumpLanding(ctx: TurnContext): [number, number] | null {
  const { hero } = ctx.state;
  const [dx, dy] = DELTAS[hero.facing];
  const mx = hero.x + dx,
    my = hero.y + dy;
  const lx = mx + dx,
    ly = my + dy;
  if (!isHazardTile(ctx, mx, my)) return null;
  if (ctx.entitiesAt(mx, my).some((e) => !isRemoved(e) && blocksJump(e))) return null;
  return isBlocked(ctx, lx, ly, dx, dy) ? null : [lx, ly];
}

/** True if a jump would do something now: what clients use to offer the Jump action. */
export function canJump(state: GameState): boolean {
  if (state.gameOver) return false;
  return jumpLanding(new TurnContext({ ...state, floors: { ...state.floors } })) !== null;
}
