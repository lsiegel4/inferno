import {
  applyTurn,
  createGame,
  restoreGame,
  type ChatMessage,
  type FloorDef,
  type GameState,
  type TurnRecord,
} from "@inferno/shared";
import { RULES } from "./config.js";
import type { GameLog } from "./persistence/types.js";

export interface Recovered {
  state: GameState;
  recentTurns: TurnRecord[];
  recentChat: ChatMessage[];
}

export class RecoveryError extends Error {}

/**
 * Startup (ADR-0009): latest snapshot (or a new game) plus replaying every later turn through
 * the deterministic engine. Replay must reproduce each recorded outcome; if it does not (e.g.
 * floor files changed under a running game) startup fails loudly rather than diverging.
 */
export async function recoverGame(floors: readonly FloorDef[], log: GameLog): Promise<Recovered> {
  const snapshot = await log.latestSnapshot();
  let state = snapshot ? restoreGame(floors, snapshot) : createGame(floors);
  for (const t of await log.turnsAfter(state.turn)) {
    if (t.turn !== state.turn + 1) {
      throw new RecoveryError(`turn log has a gap: expected ${state.turn + 1}, found ${t.turn}`);
    }
    const r = applyTurn(state, t.action, t.crowd);
    if ((r.outcome ?? null) !== (t.outcome ?? null)) {
      throw new RecoveryError(`replay diverged at turn ${t.turn}: ${r.outcome} vs ${t.outcome}`);
    }
    state = r.state;
  }
  const recentTurns = await log.turnsAfter(Math.max(0, state.turn - RULES.recentTurns));
  return { state, recentTurns, recentChat: await log.recentChat(RULES.recentChat) };
}
