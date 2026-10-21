import type { EntityType } from "../registry.js";
import { die, fallTo } from "../transitions.js";
import { landing, validateLanding } from "./pit.js";
import { stringProp } from "./props.js";

/**
 * Hidden trap. Looks like plain floor and is never sent to clients until it springs; with
 * `hint: true` it shows as a crack, which is indistinguishable from a harmless `crack`. Stepping
 * on it springs it: `effect: "burn"` (default) kills, `effect: "fall"` drops the hero to a lower
 * floor at `landing` like a pit. A pushed block or statue falls into it and fills it; the echo
 * dissolves in it. Either way it is revealed.
 *
 * Once sprung it stays revealed for good, through deaths (the crowd learns the floor); everything
 * else about it resets, so a block that filled it returns to its start.
 */
export const trap: EntityType = {
  kind: "trap",
  initialState: () => ({ discovered: false }),
  isHazard: (e) => e.state.discovered === true,
  hidden: (e) => !e.state.discovered && e.props.hint !== true,
  view: (e) =>
    e.state.discovered
      ? {
          kind: "trap",
          state: { discovered: true, effect: stringProp(e.props, "effect") ?? "burn" },
        }
      : { kind: "crack", state: {} },
  onEnter(ctx, e) {
    if (!e.state.discovered) {
      e.state.discovered = true;
      ctx.markChanged(e);
    }
    const l = landing(e.props);
    if (stringProp(e.props, "effect") === "fall" && l) return fallTo(ctx, l.floor, l.x, l.y);
    die(ctx);
  },
  onFloorReset: (current, initial) => ({
    ...initial,
    state: { ...initial.state, discovered: current.state.discovered },
  }),
  validate(e, floor, all) {
    const effect = stringProp(e.props, "effect") ?? "burn";
    if (effect === "burn") return [];
    if (effect !== "fall") return [`trap "${e.id}" effect must be "burn" or "fall"`];
    return validateLanding(`trap "${e.id}"`, e, floor, all);
  },
};

/** A harmless crack in the floor: decoration, and cover for hinted traps. */
export const crack: EntityType = { kind: "crack" };
