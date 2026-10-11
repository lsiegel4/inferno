/** Tunable values from game design §15. */
export const RULES = {
  activityWindowMs: 60_000,
  pauseGraceMs: 10_000,
  tickMinMs: 1_000,
  tickMaxMs: 3_000,
  chatIntervalMs: 2_000,
  /** Presence and tally updates are batched to at most one per this interval. */
  broadcastIntervalMs: 1_000,
  recentTurns: 50,
  recentChat: 50,
} as const;
