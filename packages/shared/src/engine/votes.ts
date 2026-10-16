import type { Action } from "../protocol.js";
import type { Crowd } from "./types.js";

/** Stable key identifying a vote option: each direction, jump, interact, wait, and use(itemId). */
export function actionKey(a: Action): string {
  switch (a.kind) {
    case "move":
      return `move:${a.dir}`;
    case "use":
      return `use:${a.itemId}`;
    default:
      return a.kind;
  }
}

export interface VoteCount {
  action: Action;
  votes: number;
}

/** Tally votes per option, most votes first (ties keep first-cast order). */
export function tallyVotes(votes: readonly Action[]): VoteCount[] {
  const counts = new Map<string, VoteCount>();
  for (const a of votes) {
    const key = actionKey(a);
    const c = counts.get(key);
    if (c) c.votes += 1;
    else counts.set(key, { action: a, votes: 1 });
  }
  return [...counts.values()].sort((a, b) => b.votes - a.votes);
}

/**
 * Pick the winning action for a tick (ADR-0017): plurality, ties broken by random selection.
 * Invalid actions are counted like any other. Returns null when nobody voted (no turn).
 * `rng` returns a float in [0, 1), so tests can inject a seeded generator.
 */
export function resolveVotes(votes: readonly Action[], rng: () => number): Action | null {
  const tally = tallyVotes(votes);
  const top = tally[0];
  if (!top) return null;
  const leaders = tally.filter((c) => c.votes === top.votes);
  return leaders[Math.floor(rng() * leaders.length)]!.action;
}

/**
 * The crowd behind a winning action: its share of the votes and the runner-up (the most-voted
 * other action, first cast on a tie; null if every vote was for the winner).
 */
export function crowdOf(votes: readonly Action[], winner: Action): Crowd {
  if (votes.length === 0) return { support: 1, dissent: null };
  const key = actionKey(winner);
  const tally = tallyVotes(votes);
  const won = tally.find((c) => actionKey(c.action) === key)?.votes ?? 0;
  const runnerUp = tally.find((c) => actionKey(c.action) !== key);
  return { support: won / votes.length, dissent: runnerUp?.action ?? null };
}
