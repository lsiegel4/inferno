import type { Action, ChatMessage, GameSnapshot, TurnRecord } from "@inferno/shared";

export interface TurnWrite {
  record: TurnRecord;
  /** Every vote cast in the tick that decided this turn (vote audit log). */
  votes: { userId: string; action: Action }[];
}

/** Thrown when another server has taken over: this one must stop writing and exit. */
export class StaleLeaderError extends Error {}

/** Durable game history (ADR-0009). */
export interface GameLog {
  /**
   * Durably record a turn before it is applied. Rejects with StaleLeaderError if this server is
   * no longer the leader or the turn already exists. May complete synchronously (in memory).
   */
  appendTurn(write: TurnWrite): Promise<void> | void;
  saveSnapshot(snapshot: GameSnapshot): Promise<void>;
  latestSnapshot(): Promise<GameSnapshot | undefined>;
  /** Turns with a turn number greater than `after`, oldest first. */
  turnsAfter(after: number, limit?: number): Promise<TurnRecord[]>;
  appendChat(msg: ChatMessage): Promise<void>;
  recentChat(limit: number): Promise<ChatMessage[]>;
}
