import { bodyAt } from "../bodies.js";
import type { EntityType } from "../registry.js";
import { isBlocked } from "../transitions.js";
import { stringProp } from "./props.js";

/**
 * Portal. Stepping (or sliding) onto it moves the hero to the portal named by its `to` prop,
 * keeping its facing; the destination does not trigger (no chains). If the destination is
 * blocked or occupied, nothing happens. Links may be one-way. Clients are not told where a
 * portal leads: the crowd has to map them.
 */
export const portal: EntityType = {
  kind: "portal",
  onEnter(ctx, e) {
    const to = ctx.entityById(stringProp(e.props, "to") ?? "");
    if (!to || isBlocked(ctx, to.x, to.y) || bodyAt(ctx, to.x, to.y)) return;
    ctx.state.hero.x = to.x;
    ctx.state.hero.y = to.y;
    ctx.emit({ type: "hero_moved" });
  },
  view: () => ({ kind: "portal", state: {} }),
  validate(e, floor) {
    const to = stringProp(e.props, "to");
    const target = floor.entities.find((x) => x.id === to);
    if (!target || target.kind !== "portal")
      return [`portal "${e.id}" must lead to a portal ("to")`];
    return [];
  },
};
