import type { EntityType } from "../registry.js";
import { die } from "../transitions.js";

/**
 * Crumbling floor. Holds the hero once: when the hero steps off, it collapses into a hole, and
 * walking into the hole kills. A pushed block fills the hole. Bodies do not crumble it. A puzzle
 * element: it is whole again after a death.
 */
export const crumble: EntityType = {
  kind: "crumble",
  initialState: () => ({ stood: false, collapsed: false }),
  isHazard: (e) => e.state.collapsed === true,
  onEnter(ctx, e) {
    if (e.state.collapsed) die(ctx);
  },
  onTurnEnd(ctx, e) {
    if (e.state.collapsed) return;
    if (ctx.heroAt(e.x, e.y)) {
      if (!e.state.stood) {
        e.state.stood = true;
        ctx.markChanged(e);
      }
    } else if (e.state.stood) {
      e.state.stood = false;
      e.state.collapsed = true;
      ctx.markChanged(e);
    }
  },
};
