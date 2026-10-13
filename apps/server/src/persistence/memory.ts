import type { ChatMessage, GameSnapshot, TurnRecord } from "@inferno/shared";
import { StaleLeaderError, type GameLog, type TurnWrite } from "./types.js";

/** In-memory game log for development and tests. appendTurn completes synchronously. */
export class MemoryGameLog implements GameLog {
  readonly turns: TurnWrite[] = [];
  readonly snapshots: GameSnapshot[] = [];
  readonly chat: ChatMessage[] = [];

  appendTurn(write: TurnWrite): void {
    const last = this.turns.at(-1)?.record.turn ?? 0;
    if (write.record.turn !== last + 1)
      throw new StaleLeaderError(`turn ${write.record.turn} out of order`);
    this.turns.push(structuredClone(write));
  }

  async saveSnapshot(snapshot: GameSnapshot): Promise<void> {
    this.snapshots.push(structuredClone(snapshot));
    this.snapshots.splice(0, Math.max(0, this.snapshots.length - 3));
  }

  async latestSnapshot(): Promise<GameSnapshot | undefined> {
    return structuredClone(this.snapshots.at(-1));
  }

  async turnsAfter(after: number, limit = Infinity): Promise<TurnRecord[]> {
    return this.turns
      .map((t) => t.record)
      .filter((r) => r.turn > after)
      .slice(0, limit);
  }

  async appendChat(msg: ChatMessage): Promise<void> {
    this.chat.push(msg);
  }

  async recentChat(limit: number): Promise<ChatMessage[]> {
    return this.chat.slice(-limit);
  }
}
