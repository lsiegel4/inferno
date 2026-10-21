/**
 * Wire protocol: Zod schemas and inferred types for every message in docs/api-contracts.md.
 * The server validates every incoming client message against these schemas.
 */
import { z } from "zod";

/** Wire protocol version carried in every WebSocket envelope (api-contracts §1.1). */
export const PROTOCOL_VERSION = 1;

/** Maximum chat message length in characters (game design §11). */
export const CHAT_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// Shared types (api-contracts §4)

export const DirectionSchema = z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), dir: DirectionSchema }),
  z.object({ kind: z.literal("jump") }),
  z.object({ kind: z.literal("interact") }),
  z.object({ kind: z.literal("use"), itemId: z.string().min(1) }),
  z.object({ kind: z.literal("wait") }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const HeroSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  facing: DirectionSchema,
});
export type Hero = z.infer<typeof HeroSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  state: z.record(z.string(), z.unknown()).optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const FloorStateSchema = z.object({
  floorId: z.string(),
  index: z.number().int().min(1),
  /** Display name, e.g. "The Gate" (absent on unnamed floors). */
  name: z.string().optional(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  /** Static terrain, one row per line. Unrevealed tiles are " " (see encodeTerrain). */
  tiles: z.string(),
  entities: z.array(EntitySchema),
  minimumPlayers: z.number().int().min(1),
});
export type FloorState = z.infer<typeof FloorStateSchema>;

export const InventoryItemSchema = z.object({
  id: z.string(),
  type: z.enum(["key", "torch", "weight", "plank", "hourglass"]),
});
export type InventoryItemView = z.infer<typeof InventoryItemSchema>;

export const PresenceSchema = z.object({
  active: z.number().int().min(0),
  minimum: z.number().int().min(1),
  spectators: z.number().int().min(0),
  paused: z.boolean(),
});
export type Presence = z.infer<typeof PresenceSchema>;

export const TurnOutcomeSchema = z.enum(["died", "floor_up", "floor_down", "fell", "no_effect"]);
export type TurnOutcome = z.infer<typeof TurnOutcomeSchema>;

/**
 * How the crowd voted on a turn: the winner's share of the votes cast, and the runner-up action
 * (null when everyone agreed). Crowd mechanics (the echo, altars) depend on it, so it is part of
 * the turn log and replayed on recovery. Absent on old records: treated as unanimous.
 */
export const CrowdSchema = z.object({
  support: z.number().min(0).max(1),
  dissent: ActionSchema.nullable(),
});

export const TurnRecordSchema = z.object({
  turn: z.number().int().min(1),
  floorId: z.string(),
  action: ActionSchema,
  at: z.string(),
  outcome: TurnOutcomeSchema.optional(),
  crowd: CrowdSchema.optional(),
});
export type TurnRecord = z.infer<typeof TurnRecordSchema>;

/** `tick` equals the number of turns completed so far: a vote for tick N decides turn N + 1. */
export const TallySchema = z.object({
  tick: z.number().int().min(0),
  endsAt: z.string(),
  voted: z.number().int().min(0),
  active: z.number().int().min(0),
  counts: z.array(z.object({ action: ActionSchema, votes: z.number().int().min(1) })),
});
export type Tally = z.infer<typeof TallySchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  handle: z.string(),
  text: z.string(),
  at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ---------------------------------------------------------------------------
// WebSocket envelope (api-contracts §1.1)

function envelope<T extends string, D extends z.ZodType>(type: T, data: D) {
  return z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal(type), data });
}

// ---------------------------------------------------------------------------
// Client → server (api-contracts §5)

export const ClientMessageSchema = z.discriminatedUnion("type", [
  envelope("hello", z.object({})),
  envelope("vote", z.object({ tick: z.number().int().min(0), action: ActionSchema })),
  envelope("ready", z.object({})),
  // Length is checked by the server so it can answer CHAT_TOO_LONG instead of BAD_MESSAGE.
  envelope("chat_send", z.object({ text: z.string().min(1).max(10_000) })),
  envelope("ping", z.object({})),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Server → client (api-contracts §6)

export const ErrorCodeSchema = z.enum([
  "NOT_AUTHENTICATED",
  "INVALID_SESSION",
  "BAD_ORIGIN",
  "RATE_LIMITED",
  "PAUSED",
  "STALE_TICK",
  "ALREADY_VOTED",
  "NOT_PAUSED",
  "CHAT_TOO_LONG",
  "GAME_OVER",
  "BAD_MESSAGE",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

const YouSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("player"), userId: z.string(), handle: z.string() }),
  z.object({ role: z.literal("spectator") }),
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
  envelope(
    "welcome",
    z.object({
      you: YouSchema,
      turn: z.number().int().min(0),
      floor: FloorStateSchema,
      hero: HeroSchema,
      inventory: z.array(InventoryItemSchema),
      presence: PresenceSchema,
      tally: TallySchema.nullable(),
      recentTurns: z.array(TurnRecordSchema),
      recentChat: z.array(ChatMessageSchema),
      gameOver: z.boolean(),
    }),
  ),
  envelope(
    "turn",
    z.object({
      turn: z.number().int().min(1),
      action: ActionSchema,
      crowd: CrowdSchema.optional(),
      hero: HeroSchema,
      changes: z.array(EntitySchema),
      inventory: z.array(InventoryItemSchema).optional(),
      outcome: TurnOutcomeSchema.optional(),
      sign: z.object({ text: z.string() }).optional(),
      revealed: z
        .array(z.object({ x: z.number().int(), y: z.number().int(), ch: z.string().length(1) }))
        .optional(),
      hidden: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    }),
  ),
  envelope("floor_changed", z.object({ floor: FloorStateSchema, hero: HeroSchema })),
  envelope("presence", PresenceSchema),
  envelope("paused", z.object({ presence: PresenceSchema })),
  envelope("resumed", z.object({ presence: PresenceSchema })),
  envelope("tally", TallySchema),
  envelope("chat_message", ChatMessageSchema),
  envelope("session_replaced", z.object({})),
  envelope("game_over", z.object({ turn: z.number().int().min(1) })),
  envelope(
    "error",
    z.object({
      code: ErrorCodeSchema,
      ref: z.string().optional(),
      retryAfterMs: z.number().int().min(0).optional(),
    }),
  ),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ---------------------------------------------------------------------------
// REST bodies (api-contracts §3)

export const AuthGoogleRequestSchema = z.object({ idToken: z.string().min(1) });
export const AuthGoogleResponseSchema = z.object({
  user: z.object({ id: z.string(), handle: z.string(), isNew: z.boolean() }),
});
export const MeResponseSchema = z.object({ id: z.string(), handle: z.string() });
export const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const PutHandleRequestSchema = z.object({ handle: z.string().regex(HANDLE_PATTERN) });
export const HistoryResponseSchema = z.object({
  turns: z.array(TurnRecordSchema),
  nextCursor: z.string().nullable(),
});
export const HealthResponseSchema = z.object({ ok: z.literal(true), leader: z.boolean() });
