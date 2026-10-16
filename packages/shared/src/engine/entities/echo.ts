import { bodyCanEnter } from "../bodies.js";
import type { TurnContext } from "../context.js";
import { blocksJump, blocksMove, entityType, isRemoved, type EntityType } from "../registry.js";
import { TERRAIN, terrainAt } from "../../floor.js";
import { isCovered, isHazardTile, isIce } from "../transitions.js";
import { DELTAS, WORLD_PHASE, type RuntimeEntity } from "../types.js";
import type { Direction } from "../../protocol.js";

/** Kinds the echo can work with Interact. It cannot take items or use the hero's. */
const ECHO_INTERACTS = new Set(["lever", "switch", "mirror"]);

/**
 * The Shade of Dissent. Each turn, after the hero acts, it performs the crowd's runner-up vote:
 * the most popular action that did not win. When everyone agrees (or only one person votes) it
 * stands still. It moves, jumps, pushes blocks and statues, and pulls levers, switches and mirrors
 * like the hero, but cannot take or use items or climb stairs. It is a body: it presses plates,
 * holds doors and blocks patrols, the hero and beams.
 *
 * It is not alive. Lava, holes, a hidden trap, a patrol, raised fire or a beam dissolve it, and
 * it re-forms at its starting tile (the floor does not reset; a sprung trap stays revealed).
 * Resets with the floor when the hero dies.
 */
export const echo: EntityType = {
  kind: "echo",
  worldPhase: WORLD_PHASE.echo,
  initialState: (p) => ({ facing: "up", home: { x: p.x, y: p.y } }),
  blocksMove: () => true,
  isBody: () => true,
  onWorldStep(ctx, e) {
    const a = ctx.crowd.dissent;
    if (!a) return;
    switch (a.kind) {
      case "move": {
        e.state.facing = a.dir;
        ctx.markChanged(e);
        const [dx, dy] = DELTAS[a.dir];
        const x = e.x + dx,
          y = e.y + dy;
        if (!bodyCanEnter(ctx, x, y, dx, dy, e)) {
          const pushed = ctx.entitiesAt(x, y).find((o) => !isRemoved(o) && blocksMove(o));
          if (!pushed || !(entityType(pushed.kind).onPushed?.(ctx, pushed, dx, dy) ?? false))
            return;
          if (!bodyCanEnter(ctx, x, y, dx, dy, e)) return;
        }
        return step(ctx, e, x, y, a.dir);
      }
      case "jump": {
        const [dx, dy] = DELTAS[e.state.facing as Direction];
        const mx = e.x + dx,
          my = e.y + dy;
        const mid =
          terrainAt(ctx.floor.def, mx, my) === TERRAIN.wall ||
          ctx.heroAt(mx, my) ||
          ctx.entitiesAt(mx, my).some((o) => !isRemoved(o) && blocksJump(o));
        if (mid || !bodyCanEnter(ctx, e.x + 2 * dx, e.y + 2 * dy, dx, dy, e)) return;
        return step(ctx, e, e.x + 2 * dx, e.y + 2 * dy, e.state.facing as Direction);
      }
      case "interact": {
        const [dx, dy] = DELTAS[e.state.facing as Direction];
        for (const o of ctx.entitiesAt(e.x + dx, e.y + dy)) {
          if (!isRemoved(o) && ECHO_INTERACTS.has(o.kind)) entityType(o.kind).onInteract?.(ctx, o);
        }
        return;
      }
      default:
        return; // wait, use: nothing
    }
  },
};

/** Move the echo onto a tile, sliding on across ice, dissolving on anything deadly. */
function step(ctx: TurnContext, e: RuntimeEntity, x: number, y: number, dir: Direction): void {
  const [dx, dy] = DELTAS[dir];
  for (let guard = 0; guard < 1000; guard++) {
    e.x = x;
    e.y = y;
    ctx.markChanged(e);
    if (deadlyForEcho(ctx, x, y)) return dissolve(ctx, e);
    if (!isIce(ctx, x, y) || !bodyCanEnter(ctx, x + dx, y + dy, dx, dy, e)) return;
    x += dx;
    y += dy;
  }
}

function deadlyForEcho(ctx: TurnContext, x: number, y: number): boolean {
  if (isHazardTile(ctx, x, y)) return true;
  for (const o of ctx.entitiesAt(x, y)) {
    if (isRemoved(o)) continue;
    if (o.kind === "patrol") return true;
    if (o.kind === "trap" && !isCovered(ctx, x, y)) {
      if (!o.state.discovered) {
        o.state.discovered = true;
        ctx.markChanged(o);
      }
      return true;
    }
  }
  return false;
}

export function dissolve(ctx: TurnContext, e: RuntimeEntity): void {
  const home = e.state.home as { x: number; y: number };
  e.x = home.x;
  e.y = home.y;
  e.state.facing = "up";
  ctx.markChanged(e);
  ctx.emit({ type: "echo_dissolved", entityId: e.id });
}

/** Dissolve any echo standing on (x, y) (raised fire, a beam). */
export function dissolveEchoesAt(ctx: TurnContext, x: number, y: number): void {
  for (const o of ctx.entitiesAt(x, y)) {
    if (o.kind === "echo" && !isRemoved(o)) dissolve(ctx, o);
  }
}
