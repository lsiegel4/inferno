import type { EntityType } from "../registry.js";
import { numberProp, stringListProp, validateTargets } from "./props.js";

/**
 * Altar of Accord: blocks movement. Interact succeeds only if the crowd speaks as one: the
 * winning vote's share of all votes cast must be at least `threshold` (default 0.75). Then it
 * switches its targets on for good, like a lever (and may reach other floors). Otherwise it stays
 * silent and tells everyone how united the crowd was; try again.
 */
export const altar: EntityType = {
  kind: "altar",
  initialState: () => ({ done: false }),
  blocksMove: () => true,
  onInteract(ctx, e) {
    if (e.state.done) return false;
    const threshold = numberProp(e.props, "threshold", 0.75);
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    if (ctx.crowd.support + 1e-9 < threshold) {
      ctx.emit({
        type: "sign_read",
        entityId: e.id,
        text: `The altar stays cold. Only ${pct(ctx.crowd.support)} of you spoke as one; it demands ${pct(threshold)}.`,
      });
      return true;
    }
    e.state.done = true;
    ctx.markChanged(e);
    ctx.signal(stringListProp(e.props, "targets"), true, { sourceId: e.id, latch: true });
    return true;
  },
  onFloorReset: (current) => current,
  view: (e) => ({
    kind: "altar",
    state: { done: e.state.done, threshold: numberProp(e.props, "threshold", 0.75) },
  }),
  validate(e, floor, all) {
    const t = numberProp(e.props, "threshold", 0.75);
    const problems = validateTargets("altar", e, floor, all, true);
    if (!(t > 0 && t <= 1)) problems.push(`altar "${e.id}" threshold must be in (0, 1]`);
    return problems;
  },
};

/**
 * Vigil stone (walkable). Stand on it and Wait for `turns` turns in a row (default 5) and it
 * switches its targets on for good. Any other action, or stepping off, starts the count again.
 * Clients see the count. A completed vigil stays completed; an unfinished count resets on death.
 */
export const vigil: EntityType = {
  kind: "vigil",
  initialState: () => ({ count: 0, done: false }),
  onTurnEnd(ctx, e) {
    if (e.state.done) return;
    const holding = ctx.heroAt(e.x, e.y) && ctx.action.kind === "wait";
    const count = holding ? (e.state.count as number) + 1 : 0;
    if (count === e.state.count) return;
    e.state.count = count;
    ctx.markChanged(e);
    if (count >= numberProp(e.props, "turns", 5)) {
      e.state.done = true;
      ctx.signal(stringListProp(e.props, "targets"), true, { sourceId: e.id, latch: true });
    }
  },
  onFloorReset: (current, initial) => (current.state.done ? current : initial),
  view: (e) => ({
    kind: "vigil",
    state: { count: e.state.count, done: e.state.done, turns: numberProp(e.props, "turns", 5) },
  }),
  validate(e, floor, all) {
    const t = numberProp(e.props, "turns", 5);
    const problems = validateTargets("vigil", e, floor, all, true);
    if (!Number.isInteger(t) || t < 1) problems.push(`vigil "${e.id}" turns must be ≥ 1`);
    return problems;
  },
};
