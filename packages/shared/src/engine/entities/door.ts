import type { EntityType } from "../registry.js";

/** Door: blocks movement while closed. Opened by a signal; opened doors stay open on reset. */
export const door: EntityType = {
  kind: "door",
  initialState: () => ({ open: false }),
  blocksMove: (e) => !e.state.open,
  onSignal(ctx, e, on) {
    if (!on || e.state.open) return;
    e.state.open = true;
    ctx.markChanged(e);
  },
  onFloorReset: (current) => current,
};
