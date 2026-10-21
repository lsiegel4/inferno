/**
 * The floor lab's game room: the server's own GameRoom running in the browser, with you as one
 * player and a simulated crowd as the others. The client talks to it through the same Transport
 * as the real WebSocket, so the lab always shows the real client.
 */
import {
  createGame,
  type Action,
  type ClientMessage,
  type Entity,
  type FloorDef,
  type GameState,
  type ServerMessage,
} from "@inferno/shared";
import { systemClock } from "../../../server/src/clock.js";
import { GameRoom, type Conn } from "../../../server/src/room.js";
import type { SocketStatus, Transport, TransportFactory } from "../net/socket.js";
import type { FloorSolution } from "./floors.js";

export const LAB_USER = { userId: "lab-you", handle: "You" };

const BASE_ACTIONS: Action[] = [
  { kind: "move", dir: "up" },
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "jump" },
  { kind: "interact" },
  { kind: "wait" },
];

export interface LabSettings {
  /** Voters including you. Never fewer than the floor's minimum. */
  crowd: number;
  /** Share of the simulated voters who vote what you voted (the rest vote at random). */
  agreement: number;
  /** A runner-up vote the crowd splits to on purpose (for the echo), or null. */
  dissent: Action | null;
  /** Show hidden traps on the map. */
  xray: boolean;
}

export interface LabStatus {
  settings: LabSettings;
  floorId: string;
  /** Solution playback: the next move index, or null when not playing. */
  autoplay: number | null;
  turnsHere: number;
}

interface Bot {
  conn: Conn;
  userId: string;
  votedTick: number;
}

export class LabServer {
  private room!: GameRoom;
  private state: GameState;
  private bots: Bot[] = [];
  private human: { conn: Conn; onStatus: (s: SocketStatus) => void } | null = null;
  private humanVote: { tick: number; action: Action } | null = null;
  private turn = 0;
  private autoplay: number | null = null;
  private turnsHere = 0;
  private readonly listeners = new Set<() => void>();
  private snapshot: LabStatus | null = null;
  settings: LabSettings = { crowd: 12, agreement: 0.85, dissent: null, xray: false };

  constructor(
    readonly floors: FloorDef[],
    readonly solutions: Map<string, FloorSolution>,
  ) {
    this.state = createGame(floors);
    this.start(this.state);
  }

  // ---------------------------------------------------------------------------
  // The client's side

  readonly transport: TransportFactory = (onMessage, onStatus): Transport => {
    const conn: Conn = { send: (msg) => queueMicrotask(() => onMessage(msg)) };
    const connect = () => {
      onStatus("connecting");
      this.room.connect(conn, LAB_USER);
      this.human = { conn, onStatus };
      onStatus("open");
      this.room.receive(conn, { v: 1, type: "hello", data: {} });
    };
    return {
      connect,
      send: (msg: ClientMessage) => {
        if (msg.type === "vote") {
          this.humanVote = { tick: msg.data.tick, action: msg.data.action };
          this.room.receive(conn, msg);
          this.crowdVotes(msg.data.tick);
        } else this.room.receive(conn, msg);
      },
      reconnect: () => {
        this.room.disconnect(conn);
        connect();
      },
      close: () => {
        this.room.disconnect(conn);
        if (this.human?.conn === conn) this.human = null;
      },
    };
  };

  /** The full game state (for the dev drawer and x-ray). */
  get game(): GameState {
    return this.room.gameState;
  }

  /** Hidden traps on the current floor, for the x-ray overlay. */
  xray(): Entity[] {
    if (!this.settings.xray) return [];
    const s = this.room.gameState;
    return s.floors[s.currentFloor]!.entities.filter(
      (e) => e.kind === "trap" && !e.state.discovered,
    ).map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y }));
  }

  /** A snapshot for the dev drawer; a new object only when something changed. */
  status(): LabStatus {
    this.snapshot ??= {
      settings: this.settings,
      floorId: this.room.gameState.currentFloor,
      autoplay: this.autoplay,
      turnsHere: this.turnsHere,
    };
    return this.snapshot;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------------------------------------------------------------------------
  // Dev drawer commands

  update(patch: Partial<LabSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.fitCrowd();
    this.changed();
  }

  /** Start a floor afresh (items from earlier floors are not carried). */
  playFloor(floorId: string): void {
    const s = structuredClone(createGame(this.floors));
    const { start } = s.floors[floorId]!.def;
    s.currentFloor = floorId;
    s.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
    this.autoplay = null;
    this.restartRoom(s);
  }

  restartFloor(): void {
    this.playFloor(this.room.gameState.currentFloor);
  }

  /** Play the solver's route for this floor from its start, one turn at a time. */
  playSolution(): void {
    const floorId = this.room.gameState.currentFloor;
    if (!this.solutions.has(floorId)) return;
    this.playFloor(floorId);
    this.autoplay = 0;
    this.changed();
    setTimeout(() => this.nextSolutionMove(), 600);
  }

  stopSolution(): void {
    this.autoplay = null;
    this.changed();
  }

  // ---------------------------------------------------------------------------
  // Room and crowd

  private start(state: GameState): void {
    // A room counts a player as active once they vote or say they are ready, and "ready" only
    // counts while paused. So the room starts out of reach of its minimum while the whole crowd
    // says it is ready, then gets its real minimum back (it resumes within a second).
    const id = state.currentFloor;
    const floor = state.floors[id]!;
    state.floors[id] = { ...floor, def: { ...floor.def, minimumPlayers: Number.MAX_SAFE_INTEGER } };
    this.room = new GameRoom(state, systemClock);
    this.turn = state.turn;
    this.turnsHere = 0;
    this.bots = [];
    this.fitCrowd(Math.max(this.settings.crowd, floor.def.minimumPlayers));
    state.floors[id] = floor;
  }

  private restartRoom(state: GameState): void {
    const human = this.human;
    for (const b of this.bots) this.room.disconnect(b.conn);
    if (human) this.room.disconnect(human.conn);
    this.room.stop();
    this.start(state);
    if (human) {
      // Same transport, new room: greet again so the client gets a fresh `welcome`.
      human.onStatus("connecting");
      this.room.connect(human.conn, LAB_USER);
      human.onStatus("open");
      this.room.receive(human.conn, { v: 1, type: "hello", data: {} });
    }
    this.changed();
  }

  private minimum(): number {
    const s = this.room.gameState;
    return s.floors[s.currentFloor]!.def.minimumPlayers;
  }

  /** Keep (crowd - 1) simulated voters connected, and at least the floor's minimum. */
  private fitCrowd(crowd = Math.max(this.settings.crowd, this.minimum())): void {
    const want = crowd - 1;
    while (this.bots.length > want) this.room.disconnect(this.bots.pop()!.conn);
    while (this.bots.length < want) {
      const userId = `lab-bot-${this.bots.length + 1}`;
      const bot: Bot = { userId, votedTick: -1, conn: { send: (m) => this.onBotMessage(bot, m) } };
      this.bots.push(bot);
      this.room.connect(bot.conn, { userId, handle: `Shade ${this.bots.length}` });
      this.room.receive(bot.conn, { v: 1, type: "hello", data: {} });
      this.room.receive(bot.conn, { v: 1, type: "ready", data: {} });
    }
  }

  private onBotMessage(bot: Bot, msg: ServerMessage): void {
    if (bot !== this.bots[0]) {
      if (msg.type === "paused") this.room.receive(bot.conn, { v: 1, type: "ready", data: {} });
      return;
    }
    // One bot listens for the room's progress on behalf of the lab.
    switch (msg.type) {
      case "paused":
        this.room.receive(bot.conn, { v: 1, type: "ready", data: {} });
        break;
      case "turn":
        this.turn = msg.data.turn;
        this.turnsHere++;
        if (this.autoplay !== null) {
          if (msg.data.outcome === "died") this.autoplay = null;
          else setTimeout(() => this.nextSolutionMove(), 120);
        }
        this.changed();
        break;
      case "floor_changed":
        this.turnsHere = 0;
        this.autoplay = null;
        this.fitCrowd(); // the new floor may need more voters
        this.changed();
        break;
    }
  }

  /** The simulated crowd votes on the open tick, a few at a time, like real people. */
  private crowdVotes(tick: number, planned?: { action: Action; dissent: Action | null }): void {
    const mine = planned?.action ?? this.humanVote?.action;
    if (!mine) return;
    const dissent = planned ? planned.dissent : this.settings.dissent;
    const inventory = this.room.gameState.inventory.map((i): Action => ({
      kind: "use",
      itemId: i.id,
    }));
    const options = [...BASE_ACTIONS, ...inventory];
    // With a planned (solver) move, everyone follows it, split for the echo when it asks.
    const agreement = planned ? 1 : this.settings.agreement;
    this.bots.forEach((bot, i) => {
      if (bot.votedTick === tick) return;
      bot.votedTick = tick;
      const share = i / Math.max(1, this.bots.length);
      let action: Action;
      if (dissent && share < (planned ? 0.4 : 0.35)) action = dissent;
      else if (Math.random() < agreement) action = mine;
      else action = options[Math.floor(Math.random() * options.length)]!;
      const delay = 150 + Math.random() * 1200;
      setTimeout(
        () => this.room.receive(bot.conn, { v: 1, type: "vote", data: { tick, action } }),
        delay,
      );
    });
  }

  private nextSolutionMove(): void {
    if (this.autoplay === null) return;
    const moves = this.solutions.get(this.room.gameState.currentFloor)?.moves;
    const m = moves?.[this.autoplay];
    if (!m) {
      this.autoplay = null;
      this.changed();
      return;
    }
    this.autoplay++;
    const tick = this.turn;
    // The human's seat follows the plan too, so the tick has everyone's vote.
    this.humanVote = { tick, action: m.action };
    if (this.human) {
      this.room.receive(this.human.conn, { v: 1, type: "vote", data: { tick, action: m.action } });
    }
    this.crowdVotes(tick, { action: m.action, dissent: m.crowd.dissent });
    this.changed();
  }

  private changed(): void {
    this.snapshot = null;
    for (const fn of this.listeners) fn();
  }
}
