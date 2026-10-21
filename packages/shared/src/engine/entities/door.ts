import { weighed } from "../bodies.js";
import type { TurnContext } from "../context.js";
import type { EntityType } from "../registry.js";
import type { RuntimeEntity } from "../types.js";
import { receiveSignal, validateActivation, wantsOn } from "./activation.js";

/**
 * Door: blocks movement while closed.
 * - A latching signal (lever) opens it for good: it stays open, even through floor resets.
 * - A non-latching signal (pressure plate, switch) holds it open only while that source is on.
 *   When the last holder lets go it closes, but never on someone: while the hero or a body is in
 *   the doorway it waits, and closes at the end of the first turn the doorway is clear.
 * - `need: n`: opens only while n sources hold it at once. `parity: true`: open while an odd
 *   number hold it. `inverted: true`: starts open, and its sources close it (a lever closes it
 *   for good). See activation.ts.
 */
export const door: EntityType = {
  kind: "door",
  initialState: (p) => ({ open: p.props.inverted === true, latched: false, holders: [] }),
  blocksMove: (e) => !e.state.open,
  onSignal(ctx, e, on, source) {
    receiveSignal(e, on, source);
    settle(ctx, e);
  },
  onTurnEnd: (ctx, e) => settle(ctx, e),
  /** Lever-latched doors stay as they are; others start as in the floor file and follow again. */
  onFloorReset: (current, initial) => (current.state.latched ? current : initial),
  validate: (e) => validateActivation(e).map((p) => `door ${p}`),
};

function settle(ctx: TurnContext, e: RuntimeEntity): void {
  const want = wantsOn(e);
  if (want && !e.state.open) {
    e.state.open = true;
    ctx.markChanged(e);
  } else if (!want && e.state.open && !weighed(ctx, e.x, e.y)) {
    e.state.open = false;
    ctx.markChanged(e);
  }
}
