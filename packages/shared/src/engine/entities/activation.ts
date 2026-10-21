/**
 * Signal bookkeeping shared by everything a lever, switch or plate can drive (doors, beams).
 *
 * state.latched: a latching signal (lever) arrived; it holds for good.
 * state.holders: ids of non-latching sources (plates, switches, receivers) currently holding it.
 *
 * Props: `need` (default 1) holders at once activate it; with `parity: true` it is active while
 * an odd number of holders hold it (lights-out puzzles); `inverted: true` swaps the meaning, so an
 * inverted door starts open and its sources close it.
 */
import type { SignalSource } from "../registry.js";
import type { RuntimeEntity } from "../types.js";

export function receiveSignal(
  e: RuntimeEntity,
  on: boolean,
  { sourceId, latch }: SignalSource,
): void {
  const holders = new Set(e.state.holders as string[]);
  if (on) {
    if (latch) e.state.latched = true;
    else holders.add(sourceId);
  } else {
    holders.delete(sourceId);
  }
  e.state.holders = [...holders];
}

/** Are this entity's sources currently switching it on (before `inverted`)? */
export function isActive(e: RuntimeEntity): boolean {
  if (e.state.latched) return true;
  const n = (e.state.holders as string[]).length;
  if (e.props.parity === true) return n % 2 === 1;
  const need = typeof e.props.need === "number" ? e.props.need : 1;
  return n >= need;
}

/** Should it be "on" (a door open, a beam firing), taking `inverted` into account? */
export function wantsOn(e: RuntimeEntity): boolean {
  return e.props.inverted === true ? !isActive(e) : isActive(e);
}

export function validateActivation(e: { id: string; props: Record<string, unknown> }): string[] {
  const { need, parity, inverted } = e.props;
  const problems: string[] = [];
  if (need !== undefined && !(typeof need === "number" && Number.isInteger(need) && need >= 1)) {
    problems.push(`"${e.id}" need must be a positive integer`);
  }
  if (parity !== undefined && typeof parity !== "boolean")
    problems.push(`"${e.id}" parity must be true or false`);
  if (inverted !== undefined && typeof inverted !== "boolean") {
    problems.push(`"${e.id}" inverted must be true or false`);
  }
  return problems;
}
