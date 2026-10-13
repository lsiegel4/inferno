import type { TurnContext } from "../context.js";
import type { EntityType } from "../registry.js";
import type { RuntimeEntity } from "../types.js";

/**
 * Door: blocks movement while closed.
 * - A latching signal (lever) opens it for good: it stays open, even through floor resets.
 * - A non-latching signal (pressure plate) holds it open only while that plate is weighed down.
 *   When the last holder lets go it closes, but never on someone: while the hero or a block is in
 *   the doorway it waits, and closes at the end of the first turn the doorway is clear.
 */
export const door: EntityType = {
  kind: "door",
  initialState: () => ({ open: false, latched: false, holders: [] }),
  blocksMove: (e) => !e.state.open,
  onSignal(ctx, e, on, { sourceId, latch }) {
    const holders = new Set(e.state.holders as string[]);
    if (on) {
      if (latch) e.state.latched = true;
      else holders.add(sourceId);
    } else {
      holders.delete(sourceId);
    }
    e.state.holders = [...holders];
    if (on && !e.state.open) {
      e.state.open = true;
      ctx.markChanged(e);
    }
    closeIfFree(ctx, e);
  },
  onTurnEnd: (ctx, e) => closeIfFree(ctx, e),
  /** Lever-opened doors stay open; plate-held doors start closed and follow their plates again. */
  onFloorReset: (current, initial) => (current.state.latched ? current : initial),
};

function closeIfFree(ctx: TurnContext, e: RuntimeEntity): void {
  if (!e.state.open || e.state.latched || (e.state.holders as string[]).length > 0) return;
  const occupied =
    (ctx.state.hero.x === e.x && ctx.state.hero.y === e.y) ||
    ctx.entitiesAt(e.x, e.y).some((o) => o.kind === "block" && !o.state.filled);
  if (occupied) return;
  e.state.open = false;
  ctx.markChanged(e);
}
