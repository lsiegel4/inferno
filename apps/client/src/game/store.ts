/**
 * Client-side game view: the server's messages folded into what the screen shows.
 * Pure (no I/O), so it is easy to test.
 */
import type {
  Action,
  ChatMessage,
  Entity,
  FloorState,
  Hero,
  InventoryItemView,
  Presence,
  ServerMessage,
  Tally,
  TurnOutcome,
} from "@inferno/shared";

export type You = { role: "player"; userId: string; handle: string } | { role: "spectator" };

export interface FloorView {
  floorId: string;
  index: number;
  name?: string;
  width: number;
  height: number;
  minimumPlayers: number;
  /** Terrain rows; " " = not visible now. */
  tiles: string[];
  /** Explored-map terrain rows; " " = unexplored. */
  explored: string[];
  entities: Record<string, Entity>;
}

export interface LogEntry {
  turn: number;
  action: Action;
  outcome?: TurnOutcome;
  sign?: string;
}

export interface GameView {
  you: You | null;
  turn: number;
  floor: FloorView | null;
  hero: Hero | null;
  inventory: InventoryItemView[];
  presence: Presence | null;
  tally: Tally | null;
  log: LogEntry[];
  chat: ChatMessage[];
  gameOver: boolean;
  /** The action this client voted for in the current tick, if any. */
  myVote: Action | null;
  /** Sign text to show as an overlay, and until when (ms since epoch). */
  sign: { text: string; until: number } | null;
  /** The latest error code from the server, for a brief notice. */
  notice: string | null;
}

export const LOG_LIMIT = 200;
export const CHAT_LIMIT = 100;
export const SIGN_OVERLAY_MS = 2_000;

export const initialView: GameView = {
  you: null,
  turn: 0,
  floor: null,
  hero: null,
  inventory: [],
  presence: null,
  tally: null,
  log: [],
  chat: [],
  gameOver: false,
  myVote: null,
  sign: null,
  notice: null,
};

function toFloorView(f: FloorState): FloorView {
  return {
    floorId: f.floorId,
    index: f.index,
    ...(f.name ? { name: f.name } : {}),
    width: f.width,
    height: f.height,
    minimumPlayers: f.minimumPlayers,
    tiles: f.tiles.split("\n"),
    explored: f.explored.split("\n"),
    entities: Object.fromEntries(f.entities.map((e) => [e.id, e])),
  };
}

function setChars(rows: string[], tiles: { x: number; y: number; ch: string }[]): string[] {
  if (tiles.length === 0) return rows;
  const grid = rows.map((r) => [...r]);
  for (const t of tiles) {
    const row = grid[t.y];
    if (row && t.x < row.length) row[t.x] = t.ch;
  }
  return grid.map((r) => r.join(""));
}

function applyChanges(entities: Record<string, Entity>, changes: Entity[]): Record<string, Entity> {
  if (changes.length === 0) return entities;
  const next = { ...entities };
  for (const e of changes) {
    if (e.state?.hidden === true) delete next[e.id];
    else next[e.id] = e;
  }
  return next;
}

const keep = <T>(list: T[], limit: number) => (list.length > limit ? list.slice(-limit) : list);

/** Fold one server message into the view. `now` is used for the sign overlay timer. */
export function reduce(view: GameView, msg: ServerMessage, now: number): GameView {
  switch (msg.type) {
    case "welcome": {
      const d = msg.data;
      return {
        ...initialView,
        you: d.you,
        turn: d.turn,
        floor: toFloorView(d.floor),
        hero: d.hero,
        inventory: d.inventory,
        presence: d.presence,
        tally: d.tally,
        log: d.recentTurns.map((t) => ({
          turn: t.turn,
          action: t.action,
          ...(t.outcome ? { outcome: t.outcome } : {}),
        })),
        chat: d.recentChat,
        gameOver: d.gameOver,
      };
    }
    case "turn": {
      const d = msg.data;
      const floor = view.floor && {
        ...view.floor,
        tiles: setChars(
          setChars(view.floor.tiles, d.revealed ?? []),
          (d.hidden ?? []).map((t) => ({ ...t, ch: " " })),
        ),
        explored: setChars(view.floor.explored, d.explored ?? []),
        entities: applyChanges(view.floor.entities, d.changes),
      };
      const entry: LogEntry = {
        turn: d.turn,
        action: d.action,
        ...(d.outcome ? { outcome: d.outcome } : {}),
        ...(d.sign ? { sign: d.sign.text } : {}),
      };
      return {
        ...view,
        turn: d.turn,
        floor,
        hero: d.hero,
        inventory: d.inventory ?? view.inventory,
        tally: null,
        myVote: null,
        log: keep([...view.log, entry], LOG_LIMIT),
        sign: d.sign ? { text: d.sign.text, until: now + SIGN_OVERLAY_MS } : view.sign,
      };
    }
    case "floor_changed":
      return { ...view, floor: toFloorView(msg.data.floor), hero: msg.data.hero };
    case "presence":
      return { ...view, presence: msg.data };
    case "paused":
    case "resumed":
      return { ...view, presence: msg.data.presence, tally: null, myVote: null };
    case "tally":
      return { ...view, tally: msg.data };
    case "chat_message":
      return { ...view, chat: keep([...view.chat, msg.data], CHAT_LIMIT) };
    case "session_replaced":
      return { ...view, you: { role: "spectator" }, notice: "SESSION_REPLACED" };
    case "game_over":
      return { ...view, gameOver: true };
    case "error":
      return { ...view, notice: msg.data.code };
  }
}

/** Record this client's own vote (sent optimistically; the server may still reject it). */
export function withMyVote(view: GameView, action: Action): GameView {
  return { ...view, myVote: action };
}
