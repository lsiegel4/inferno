import type { EntityType } from "../registry.js";
import { WORLD_PHASE, type RuntimeEntity } from "../types.js";
import { dissolveEchoesAt } from "./echo.js";
import { numberProp } from "./props.js";

/**
 * Fire vent: a walkable tile that flares on a fixed rhythm. Its cycle is `period` world steps
 * long (default 2); it is raised for the first `on` steps of the cycle (default 1), offset by
 * `phase` (default 0). A hero that ends a turn on a raised vent burns. Stepping onto a raised
 * vent is safe if it drops this turn: only where you stand after the world moves matters.
 * Clients see `up` (raised now) and `next` (raised after the next world step).
 * Timed by world steps on this floor, so an hourglass freezes it. Resets on death.
 */
export const vent: EntityType = {
  kind: "vent",
  worldPhase: WORLD_PHASE.timer,
  initialState: (p) => cycle(p.props, numberProp(p.props, "phase", 0)),
  onWorldStep(ctx, e) {
    Object.assign(e.state, cycle(e.props, (e.state.t as number) + 1));
    ctx.markChanged(e);
    if (e.state.up) dissolveEchoesAt(ctx, e.x, e.y);
  },
  killsHero: (_ctx, e) => e.state.up === true,
  validate(e) {
    const period = numberProp(e.props, "period", 2);
    const burn = numberProp(e.props, "burn", 1);
    if (!Number.isInteger(period) || period < 2) return [`vent "${e.id}" period must be ≥ 2`];
    if (!Number.isInteger(burn) || burn < 1 || burn >= period) {
      return [`vent "${e.id}" burn must be between 1 and period - 1`];
    }
    return [];
  },
};

function cycle(props: RuntimeEntity["props"], step: number): Record<string, unknown> {
  const period = numberProp(props, "period", 2);
  const burn = numberProp(props, "burn", 1);
  const t = ((step % period) + period) % period;
  return { t, up: t < burn, next: (t + 1) % period < burn };
}
