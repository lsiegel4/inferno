/**
 * Floor file format: an ASCII grid plus a JSON metadata file (implementation plan, Phase 1).
 *
 * Grid terrain characters are fixed:
 *   #  wall        .  floor       L  lava
 *   S  start       U  stairs up   D  stairs down
 *   I  ice (the hero, blocks and statues slide across it)
 * Every other character must be defined in the JSON `legend`, which places an entity of the
 * given kind on that tile. The tile underneath is floor, or the terrain named by the entry's
 * optional `on` (e.g. "L" for a ferry floating on lava, "I" for a plate on ice). Each legend
 * character may appear at most once in the grid, so every entity has a stable id.
 */
import { z } from "zod";

export const TERRAIN = {
  wall: "#",
  floor: ".",
  lava: "L",
  start: "S",
  stairsUp: "U",
  stairsDown: "D",
  ice: "I",
} as const;
export type TerrainChar = (typeof TERRAIN)[keyof typeof TERRAIN];
const TERRAIN_CHARS = new Set<string>(Object.values(TERRAIN));

export const LegendEntrySchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
  })
  .catchall(z.unknown());
export type LegendEntry = z.infer<typeof LegendEntrySchema>;

/**
 * How much of the floor players can see (game design §7a, darkness).
 * - viewport: the whole floor is revealed.
 * - torchlight: tiles within `radius` of the hero or a light source are revealed.
 * - line_of_sight: like torchlight, but walls and move-blocking entities block sight.
 * Distances are Euclidean: a tile is within radius r when dx² + dy² ≤ r².
 */
export const RevealSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("viewport") }),
  z.object({ mode: z.literal("torchlight"), radius: z.number().int().min(0) }),
  z.object({ mode: z.literal("line_of_sight"), radius: z.number().int().min(0) }),
]);
export type Reveal = z.infer<typeof RevealSchema>;

export const FloorMetaSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1),
  minimumPlayers: z.number().int().min(1),
  legend: z.record(z.string().length(1), LegendEntrySchema).default({}),
  reveal: RevealSchema.default({ mode: "viewport" }),
  /** Display name, e.g. "The Gate". */
  name: z.string().min(1).optional(),
  /**
   * Item ids the crowd must still hold when leaving this floor, because a later floor needs them.
   * Not enforced in play; the solver treats leaving without them as failing the floor.
   */
  carry: z.array(z.string().min(1)).default([]),
});
export type FloorMeta = z.infer<typeof FloorMetaSchema>;

export interface PlacedEntity {
  id: string;
  kind: string;
  x: number;
  y: number;
  /** Legend fields other than id/kind (e.g. targets, text, landing). */
  props: Record<string, unknown>;
}

export interface FloorDef {
  id: string;
  index: number;
  minimumPlayers: number;
  reveal: Reveal;
  name?: string;
  carry: string[];
  width: number;
  height: number;
  /** Terrain rows; legend characters are replaced with ".". */
  terrain: string[];
  start: { x: number; y: number };
  stairsUp: { x: number; y: number } | null;
  entities: PlacedEntity[];
}

export class FloorFormatError extends Error {
  constructor(
    readonly floor: string,
    readonly problems: string[],
  ) {
    super(`Invalid floor "${floor}":\n- ${problems.join("\n- ")}`);
  }
}

/** Parse and validate one floor. Throws FloorFormatError listing every problem found. */
export function parseFloor(gridText: string, metaJson: unknown): FloorDef {
  const metaResult = FloorMetaSchema.safeParse(metaJson);
  if (!metaResult.success) {
    throw new FloorFormatError(
      "(unknown)",
      metaResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const meta = metaResult.data;
  const problems: string[] = [];

  const rows = gridText.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const width = rows[0]?.length ?? 0;
  if (width === 0) problems.push("grid is empty");
  rows.forEach((r, y) => {
    if (r.length !== width) problems.push(`row ${y} has length ${r.length}, expected ${width}`);
  });

  for (const ch of Object.keys(meta.legend)) {
    if (TERRAIN_CHARS.has(ch)) problems.push(`legend character "${ch}" is a terrain character`);
  }

  let start: { x: number; y: number } | null = null;
  let stairsUp: { x: number; y: number } | null = null;
  const entities: PlacedEntity[] = [];
  const seenLegend = new Set<string>();
  const terrain = rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === TERRAIN.start) {
          if (start) problems.push(`more than one start (S) at ${x},${y}`);
          start = { x, y };
          return ch;
        }
        if (ch === TERRAIN.stairsUp) {
          if (stairsUp) problems.push(`more than one stairs up (U) at ${x},${y}`);
          stairsUp = { x, y };
          return ch;
        }
        if (TERRAIN_CHARS.has(ch)) return ch;
        const entry = meta.legend[ch];
        if (!entry) {
          problems.push(`unknown character "${ch}" at ${x},${y}`);
          return TERRAIN.floor;
        }
        if (seenLegend.has(ch)) problems.push(`legend character "${ch}" appears more than once`);
        seenLegend.add(ch);
        const { id, kind, on, ...props } = entry;
        entities.push({ id, kind, x, y, props });
        if (on === undefined) return TERRAIN.floor;
        if (on !== TERRAIN.floor && on !== TERRAIN.lava && on !== TERRAIN.ice) {
          problems.push(
            `legend "${ch}": on must be "${TERRAIN.floor}", "${TERRAIN.lava}" or "${TERRAIN.ice}"`,
          );
          return TERRAIN.floor;
        }
        return on;
      })
      .join(""),
  );

  if (!start) problems.push("no start (S)");
  const ids = new Set<string>();
  for (const e of entities) {
    if (ids.has(e.id)) problems.push(`duplicate entity id "${e.id}"`);
    ids.add(e.id);
  }
  for (const ch of Object.keys(meta.legend)) {
    if (!seenLegend.has(ch) && !TERRAIN_CHARS.has(ch)) {
      problems.push(`legend character "${ch}" is not used in the grid`);
    }
  }

  if (problems.length) throw new FloorFormatError(meta.id, problems);
  return {
    id: meta.id,
    index: meta.index,
    minimumPlayers: meta.minimumPlayers,
    reveal: meta.reveal,
    ...(meta.name ? { name: meta.name } : {}),
    carry: meta.carry,
    width,
    height: rows.length,
    terrain,
    start: start!,
    stairsUp,
    entities,
  };
}

/** Terrain character at a position; out-of-bounds counts as wall. */
export function terrainAt(floor: FloorDef, x: number, y: number): string {
  if (y < 0 || y >= floor.height || x < 0 || x >= floor.width) return TERRAIN.wall;
  return floor.terrain[y]![x]!;
}
