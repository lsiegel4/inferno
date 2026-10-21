/**
 * The one global game (ADR-0001). A single writer: every message and timer runs on Node's event
 * loop, so votes, ticks and turns are applied one at a time.
 */
import {
  applyTurn,
  canJump,
  CHAT_MAX_LENGTH,
  crowdOf,
  ClientMessageSchema,
  PROTOCOL_VERSION,
  resolveVotes,
  serializeGame,
  tallyVotes,
  toFloorState,
  toProtocolHero,
  toProtocolInventory,
  turnDelta,
  type Action,
  type ChatMessage,
  type ErrorCode,
  type GameState,
  type Presence,
  type ServerMessage,
  type Tally,
  type TurnRecord,
} from "@inferno/shared";
import type { Clock } from "./clock.js";
import { RULES } from "./config.js";
import { MemoryGameLog } from "./persistence/memory.js";
import { StaleLeaderError, type GameLog, type TurnWrite } from "./persistence/types.js";

/** One WebSocket connection, as the room sees it. */
export interface Conn {
  send(msg: ServerMessage): void;
}

export interface Identity {
  userId: string;
  handle: string;
}

interface ConnState {
  identity: Identity | null;
  /** Bound player, or null for spectators (including a demoted older session). */
  userId: string | null;
  greeted: boolean;
}

interface Player {
  userId: string;
  handle: string;
  conn: Conn | null;
  lastActiveAt: number;
  lastChatAt: number;
}

interface OpenTick {
  openedAt: number;
  votes: Map<string, Action>;
  maxTimer: unknown;
  minTimer: unknown;
}

type Data<T extends ServerMessage["type"]> = Extract<ServerMessage, { type: T }>["data"];

export interface RoomOptions {
  /** Durable log; defaults to in memory. */
  log?: GameLog;
  /** Save a snapshot every N turns (ADR-0009: 100). */
  snapshotEvery?: number;
  /** Called once if another server took over; the process should exit. */
  onStale?: (error: StaleLeaderError) => void;
  /** Recent turns and chat to show in `welcome` after a restart. */
  recentTurns?: TurnRecord[];
  recentChat?: ChatMessage[];
}

export class GameRoom {
  private state: GameState;
  private readonly conns = new Map<Conn, ConnState>();
  private readonly players = new Map<string, Player>();
  private tick: OpenTick | null = null;
  private tallyDirty = false;
  private paused = true;
  private belowSince: number | null = null;
  /** Most recent turns, for `welcome`. The full history lives in the game log. */
  private readonly recentTurns: TurnRecord[];
  private readonly chat: ChatMessage[];
  private lastPresence = "";
  private readonly housekeeping: unknown;
  private readonly log: GameLog;
  private readonly snapshotEvery: number;
  /** A turn is being written to the log; nothing else may change the game until it lands. */
  private committing = false;
  private stopped = false;

  constructor(
    initial: GameState,
    private readonly clock: Clock,
    private readonly rng: () => number = Math.random,
    private readonly options: RoomOptions = {},
  ) {
    this.state = initial;
    this.log = options.log ?? new MemoryGameLog();
    this.snapshotEvery = options.snapshotEvery ?? 100;
    this.recentTurns = [...(options.recentTurns ?? [])].slice(-RULES.recentTurns);
    this.chat = [...(options.recentChat ?? [])].slice(-RULES.recentChat);
    this.housekeeping = clock.setInterval(() => this.onHousekeeping(), RULES.broadcastIntervalMs);
  }

  stop(): void {
    this.stopped = true;
    this.clock.clearInterval(this.housekeeping);
    this.discardTick();
  }

  /** The current game state (read-only use: tests and graceful shutdown snapshots). */
  get gameState(): GameState {
    return this.state;
  }

  // ---------------------------------------------------------------------------
  // Connections

  connect(conn: Conn, identity: Identity | null): void {
    this.conns.set(conn, { identity, userId: null, greeted: false });
  }

  disconnect(conn: Conn): void {
    const cs = this.conns.get(conn);
    this.conns.delete(conn);
    const player = cs?.userId ? this.players.get(cs.userId) : undefined;
    if (player?.conn === conn) player.conn = null;
    this.onActivityChanged();
  }

  /** Handle one parsed-JSON message from a connection. */
  receive(conn: Conn, raw: unknown): void {
    const cs = this.conns.get(conn);
    if (!cs) return;
    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) return this.error(conn, "BAD_MESSAGE");
    const msg = parsed.data;
    if (!cs.greeted && msg.type !== "hello") return this.error(conn, "BAD_MESSAGE", msg.type);

    switch (msg.type) {
      case "hello":
        return this.onHello(conn, cs);
      case "vote":
        return this.onVote(conn, cs, msg.data.tick, msg.data.action);
      case "ready":
        return this.onReady(conn, cs);
      case "chat_send":
        return this.onChat(conn, cs, msg.data.text);
      case "ping":
        return;
    }
  }

  /** A frame that was not valid JSON. */
  receiveMalformed(conn: Conn): void {
    this.error(conn, "BAD_MESSAGE");
  }

  private onHello(conn: Conn, cs: ConnState): void {
    if (cs.greeted) return this.error(conn, "BAD_MESSAGE", "hello");
    cs.greeted = true;
    const id = cs.identity;
    if (id) {
      let player = this.players.get(id.userId);
      if (!player) {
        player = { ...id, conn: null, lastActiveAt: -Infinity, lastChatAt: -Infinity };
        this.players.set(id.userId, player);
      }
      // One live connection per account (ADR-0011): the older one becomes a spectator.
      if (player.conn && player.conn !== conn) {
        const old = this.conns.get(player.conn);
        if (old) old.userId = null;
        this.send(player.conn, "session_replaced", {});
      }
      player.conn = conn;
      player.handle = id.handle;
      cs.userId = id.userId;
    }
    this.send(conn, "welcome", {
      you: id ? { role: "player", userId: id.userId, handle: id.handle } : { role: "spectator" },
      turn: this.state.turn,
      floor: toFloorState(this.state),
      hero: toProtocolHero(this.state),
      inventory: toProtocolInventory(this.state),
      presence: this.presence(),
      tally: this.tally(),
      recentTurns: this.recentTurns,
      recentChat: this.chat.slice(-RULES.recentChat),
      gameOver: this.state.gameOver,
      canJump: canJump(this.state),
    });
  }

  // ---------------------------------------------------------------------------
  // Votes and ticks (ADR-0017)

  private onVote(conn: Conn, cs: ConnState, tick: number, action: Action): void {
    const player = this.player(cs);
    if (!player) return this.error(conn, "NOT_AUTHENTICATED", "vote");
    if (this.state.gameOver) return this.error(conn, "GAME_OVER", "vote");
    if (this.paused) return this.error(conn, "PAUSED", "vote");
    if (tick !== this.state.turn || this.committing) return this.error(conn, "STALE_TICK", "vote");
    if (this.tick?.votes.has(player.userId)) return this.error(conn, "ALREADY_VOTED", "vote");

    this.markActive(player);

    const opening = !this.tick;
    if (!this.tick) {
      const openedAt = this.clock.now();
      this.tick = {
        openedAt,
        votes: new Map(),
        maxTimer: this.clock.setTimeout(() => this.closeTick(), RULES.tickMaxMs),
        minTimer: null,
      };
    }
    this.tick.votes.set(player.userId, action);
    if (opening) this.broadcastTally();
    else this.tallyDirty = true;
    this.checkEarlyEnd();
  }

  /** End the tick early once every active player has voted, but never before the minimum. */
  private checkEarlyEnd(): void {
    const t = this.tick;
    if (!t || t.votes.size < this.activeCount()) return;
    const elapsed = this.clock.now() - t.openedAt;
    if (elapsed >= RULES.tickMinMs) return this.closeTick();
    t.minTimer ??= this.clock.setTimeout(() => {
      if (this.tick === t) {
        t.minTimer = null;
        this.checkEarlyEnd();
      }
    }, RULES.tickMinMs - elapsed);
  }

  private discardTick(): void {
    if (!this.tick) return;
    this.clock.clearTimeout(this.tick.maxTimer);
    if (this.tick.minTimer) this.clock.clearTimeout(this.tick.minTimer);
    this.tick = null;
    this.tallyDirty = false;
  }

  private closeTick(): void {
    const t = this.tick;
    if (!t || this.stopped) return;
    this.discardTick();
    const cast = [...t.votes.values()];
    const action = resolveVotes(cast, this.rng);
    if (!action) return;
    const crowd = crowdOf(cast, action);

    // Compute the turn, write it durably, and only then apply it (ADR-0001).
    const before = this.state;
    const r = applyTurn(before, action, crowd);
    const record: TurnRecord = {
      turn: r.state.turn,
      floorId: before.currentFloor,
      action,
      at: new Date(this.clock.now()).toISOString(),
      ...(r.outcome ? { outcome: r.outcome } : {}),
      crowd,
    };
    const write: TurnWrite = {
      record,
      votes: [...t.votes].map(([userId, a]) => ({ userId, action: a })),
    };
    const commit = () => this.applyCommitted(before, r, record);
    try {
      const pending = this.log.appendTurn(write);
      if (!pending) return commit(); // in-memory log: synchronous
      this.committing = true;
      pending.then(
        () => {
          this.committing = false;
          if (!this.stopped) commit();
        },
        (e: unknown) => this.onWriteFailed(e),
      );
    } catch (e) {
      this.onWriteFailed(e);
    }
  }

  private onWriteFailed(e: unknown): void {
    this.committing = false;
    if (e instanceof StaleLeaderError) {
      this.stop();
      this.options.onStale?.(e);
      return;
    }
    // Any other failure (e.g. a network error): the turn was not recorded, so it is not applied.
    console.error("turn write failed; turn dropped", e);
  }

  private applyCommitted(
    before: GameState,
    r: ReturnType<typeof applyTurn>,
    record: TurnRecord,
  ): void {
    this.state = r.state;
    const action = record.action;
    this.recentTurns.push(record);
    if (this.recentTurns.length > RULES.recentTurns) this.recentTurns.shift();
    if (r.state.turn % this.snapshotEvery === 0) {
      this.log.saveSnapshot(serializeGame(r.state)).catch((e: unknown) => {
        console.error("snapshot failed", e);
      });
    }

    const floorChanged = r.state.currentFloor !== before.currentFloor;
    const inventoryChanged = JSON.stringify(r.state.inventory) !== JSON.stringify(before.inventory);
    const sign = r.events.find((e) => e.type === "sign_read");

    const delta = floorChanged
      ? { changes: [], revealed: [], hidden: [], explored: [] }
      : turnDelta(before, r.state, r.changed);

    this.broadcast("turn", {
      turn: r.state.turn,
      action,
      ...(record.crowd ? { crowd: record.crowd } : {}),
      hero: toProtocolHero(r.state),
      canJump: canJump(r.state),
      changes: delta.changes,
      ...(delta.revealed.length ? { revealed: delta.revealed } : {}),
      ...(delta.hidden.length ? { hidden: delta.hidden } : {}),
      ...(delta.explored.length ? { explored: delta.explored } : {}),
      ...(inventoryChanged ? { inventory: toProtocolInventory(r.state) } : {}),
      ...(r.outcome ? { outcome: r.outcome } : {}),
      ...(sign?.type === "sign_read" ? { sign: { text: sign.text } } : {}),
    });
    if (floorChanged) {
      this.broadcast("floor_changed", {
        floor: toFloorState(r.state),
        hero: toProtocolHero(r.state),
      });
      this.evaluatePause(); // the new floor may have a different minimum
    }
    if (r.state.gameOver) this.broadcast("game_over", { turn: r.state.turn });
  }

  private tally(): Tally | null {
    const t = this.tick;
    if (!t) return null;
    return {
      tick: this.state.turn,
      endsAt: new Date(t.openedAt + RULES.tickMaxMs).toISOString(),
      voted: t.votes.size,
      active: this.activeCount(),
      counts: tallyVotes([...t.votes.values()]),
    };
  }

  private broadcastTally(): void {
    const tally = this.tally();
    if (tally) this.broadcast("tally", tally);
    this.tallyDirty = false;
  }

  // ---------------------------------------------------------------------------
  // Activity and pausing (ADR-0005)

  private onReady(conn: Conn, cs: ConnState): void {
    const player = this.player(cs);
    if (!player) return this.error(conn, "NOT_AUTHENTICATED", "ready");
    if (this.state.gameOver) return this.error(conn, "GAME_OVER", "ready");
    if (!this.paused) return this.error(conn, "NOT_PAUSED", "ready");
    this.markActive(player);
  }

  private markActive(player: Player): void {
    player.lastActiveAt = this.clock.now();
    this.onActivityChanged();
  }

  private onActivityChanged(): void {
    this.evaluatePause();
    this.checkEarlyEnd();
  }

  private activeCount(): number {
    const cutoff = this.clock.now() - RULES.activityWindowMs;
    let n = 0;
    for (const p of this.players.values()) if (p.conn && p.lastActiveAt > cutoff) n++;
    return n;
  }

  private minimum(): number {
    return this.state.floors[this.state.currentFloor]!.def.minimumPlayers;
  }

  /** Unpause as soon as the minimum is met; pause only after G seconds below it. */
  private evaluatePause(): void {
    const now = this.clock.now();
    if (this.activeCount() >= this.minimum()) {
      this.belowSince = null;
      if (this.paused) {
        this.paused = false;
        this.broadcast("resumed", { presence: this.presence() });
      }
      return;
    }
    if (this.paused) return;
    this.belowSince ??= now;
    if (now - this.belowSince >= RULES.pauseGraceMs) {
      this.paused = true;
      this.discardTick(); // votes in an unfinished tick are dropped
      this.broadcast("paused", { presence: this.presence() });
    }
  }

  private presence(): Presence {
    const active = this.activeCount();
    return {
      active,
      minimum: this.minimum(),
      spectators: Math.max(0, this.conns.size - active),
      paused: this.paused,
    };
  }

  private onHousekeeping(): void {
    this.onActivityChanged(); // activity expires with time
    const presence = this.presence();
    const json = JSON.stringify(presence);
    if (json !== this.lastPresence) {
      this.lastPresence = json;
      this.broadcast("presence", presence);
    }
    if (this.tallyDirty) this.broadcastTally();
  }

  // ---------------------------------------------------------------------------
  // Chat

  private onChat(conn: Conn, cs: ConnState, text: string): void {
    const player = this.player(cs);
    if (!player) return this.error(conn, "NOT_AUTHENTICATED", "chat_send");
    if (text.length > CHAT_MAX_LENGTH) return this.error(conn, "CHAT_TOO_LONG", "chat_send");
    const now = this.clock.now();
    const wait = player.lastChatAt + RULES.chatIntervalMs - now;
    if (wait > 0) return this.error(conn, "RATE_LIMITED", "chat_send", wait);
    player.lastChatAt = now;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      handle: player.handle,
      text,
      at: new Date(now).toISOString(),
    };
    this.chat.push(msg);
    if (this.chat.length > RULES.recentChat) this.chat.shift();
    this.log.appendChat(msg).catch((e: unknown) => console.error("chat write failed", e));
    this.broadcast("chat_message", msg);
  }

  /** A player changed their handle (PUT /me/handle). */
  renamePlayer(userId: string, handle: string): void {
    const player = this.players.get(userId);
    if (player) player.handle = handle;
  }

  // ---------------------------------------------------------------------------
  // History (REST)

  /** Hero turns after `cursor` (a turn number), oldest first. */
  async historyPage(
    cursor: number,
    limit: number,
  ): Promise<{ turns: TurnRecord[]; nextCursor: string | null }> {
    const turns = await this.log.turnsAfter(cursor, limit);
    const last = turns.at(-1);
    const more = last !== undefined && last.turn < this.state.turn;
    return { turns, nextCursor: more ? String(last.turn) : null };
  }

  // ---------------------------------------------------------------------------
  // Helpers

  private player(cs: ConnState): Player | undefined {
    return cs.userId ? this.players.get(cs.userId) : undefined;
  }

  private send<T extends ServerMessage["type"]>(conn: Conn, type: T, data: Data<T>): void {
    conn.send({ v: PROTOCOL_VERSION, type, data } as ServerMessage);
  }

  private broadcast<T extends ServerMessage["type"]>(type: T, data: Data<T>): void {
    const msg = { v: PROTOCOL_VERSION, type, data } as ServerMessage;
    for (const [conn, cs] of this.conns) if (cs.greeted) conn.send(msg);
  }

  private error(conn: Conn, code: ErrorCode, ref?: string, retryAfterMs?: number): void {
    this.send(conn, "error", {
      code,
      ...(ref ? { ref } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    });
  }
}
