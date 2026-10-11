/**
 * A simulated voter that speaks the WebSocket protocol. It keeps a shadow copy of the game by
 * replaying every turn through the same deterministic engine, and votes along the shortest
 * route most of the time (like the prototype's simulated players).
 */
import {
  applyTurn,
  createGame,
  PROTOCOL_VERSION,
  type Action,
  type ClientMessage,
  type FloorDef,
  type GameState,
  type ServerMessage,
} from "@inferno/shared";
import { solveFloor, stateKey } from "./solver.js";

/** Routes shared by every bot in the process: many bots see the same states. */
const routeCache = new Map<string, Action[] | null>();

const RANDOM_ACTIONS: Action[] = [
  { kind: "move", dir: "up" },
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "jump" },
  { kind: "interact" },
  { kind: "wait" },
];

export interface BotOptions {
  /** Probability of voting the planned move instead of a random one. */
  focus: number;
  rng: () => number;
}

export class Bot {
  private shadow: GameState | null = null;
  private paused = true;
  private votedTick = -1;
  private plan: { actions: Action[] } | null = null;

  constructor(
    private readonly floors: readonly FloorDef[],
    private readonly opts: BotOptions,
  ) {}

  get gameOver(): boolean {
    return this.shadow?.gameOver ?? false;
  }

  /** React to a server message; returns messages to send back. */
  onMessage(msg: ServerMessage): ClientMessage[] {
    switch (msg.type) {
      case "welcome":
        if (msg.data.turn !== 0) throw new Error("Bot must join a game from its first turn");
        this.shadow = createGame(this.floors);
        this.paused = msg.data.presence.paused;
        return this.paused ? [this.msg("ready", {})] : this.maybeVote();
      case "paused":
        this.paused = true;
        return [this.msg("ready", {})];
      case "resumed":
        this.paused = false;
        return this.maybeVote();
      case "turn": {
        this.followPlan(msg.data.action);
        const r = applyTurn(this.shadow!, msg.data.action);
        this.shadow = r.state;
        const { x, y, facing } = r.state.hero;
        const h = msg.data.hero;
        if (h.x !== x || h.y !== y || h.facing !== facing) throw new Error("Bot out of sync");
        return this.maybeVote();
      }
      case "tally":
        return this.maybeVote();
      default:
        return [];
    }
  }

  private maybeVote(): ClientMessage[] {
    const s = this.shadow;
    if (!s || this.paused || s.gameOver || this.votedTick === s.turn) return [];
    this.votedTick = s.turn;
    return [this.msg("vote", { tick: s.turn, action: this.choose(s) })];
  }

  private choose(s: GameState): Action {
    const { rng, focus } = this.opts;
    if (rng() < focus) {
      const planned = this.nextPlanned(s);
      if (planned) return planned;
    }
    return RANDOM_ACTIONS[Math.floor(rng() * RANDOM_ACTIONS.length)]!;
  }

  /** Next move on the shortest route from the current state, re-planning when needed. */
  private nextPlanned(s: GameState): Action | null {
    if (!this.plan || this.plan.actions.length === 0) {
      const key = stateKey(s);
      if (!routeCache.has(key)) routeCache.set(key, solveFloor(s)?.actions ?? null);
      const route = routeCache.get(key);
      this.plan = route ? { actions: [...route] } : null;
    }
    return this.plan?.actions[0] ?? null;
  }

  /** Keep the plan if the crowd took its next step; otherwise drop it. */
  private followPlan(action: Action): void {
    const next = this.plan?.actions[0];
    if (next && JSON.stringify(next) === JSON.stringify(action)) this.plan!.actions.shift();
    else this.plan = null;
  }

  private msg<T extends ClientMessage["type"]>(
    type: T,
    data: Extract<ClientMessage, { type: T }>["data"],
  ): ClientMessage {
    return { v: PROTOCOL_VERSION, type, data } as ClientMessage;
  }
}
