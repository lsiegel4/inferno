/**
 * Write every floor's solver route and difficulty figures as JSON, for the floor lab's atlas and
 * "Solution" button: node dist/export-solutions.js [floors dir] [out file]
 *
 * Each floor is solved from a fresh start. Results are cached in the output file by a hash of the
 * floor's files, so only changed floors are solved again. A floor too large to solve within the
 * state limit is written without a route.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { readdirSync, statSync } from "node:fs";
import { atFloorStart, solveFloorWithStats, type Move } from "./solver.js";

interface Exported {
  floorId: string;
  hash: string;
  moves: Move[];
  dangerSteps: number;
  splitSteps: number;
  states: number;
  softlocks: number | null;
  error?: string;
}

const [dir = "floors", out = "solutions.json", limit = "1500000"] = process.argv.slice(2);
const floors = loadFloorsFromDir(dir);
const game = createGame(floors);

// Hash each floor folder's files, keyed by floor id.
const hashes = new Map<string, string>();
for (const name of readdirSync(dir)) {
  const folder = join(dir, name);
  if (!statSync(folder).isDirectory()) continue;
  const meta = readFileSync(join(folder, "floor.json"), "utf8");
  const grid = readFileSync(join(folder, "grid.txt"), "utf8");
  const id = (JSON.parse(meta) as { id: string }).id;
  hashes.set(id, createHash("sha1").update(meta).update(grid).digest("hex"));
}

const cached = new Map<string, Exported>();
if (existsSync(out)) {
  for (const e of JSON.parse(readFileSync(out, "utf8")) as Exported[]) cached.set(e.floorId, e);
}

const data: Exported[] = [];
for (const id of game.floorOrder) {
  const hash = hashes.get(id) ?? "";
  const hit = cached.get(id);
  if (hit && hit.hash === hash) {
    data.push(hit);
    console.log(`= ${id} (cached)`);
    continue;
  }
  try {
    const r = solveFloorWithStats(atFloorStart(game, id), Number(limit));
    data.push({
      floorId: id,
      hash,
      moves: r.solution?.moves ?? [],
      dangerSteps: r.solution?.dangerSteps ?? 0,
      splitSteps: r.solution?.splitSteps ?? 0,
      states: r.states,
      softlocks: r.softlocks,
    });
    console.log(`${r.solution ? "✓" : "✗"} ${id}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    data.push({
      floorId: id,
      hash,
      moves: [],
      dangerSteps: 0,
      splitSteps: 0,
      states: 0,
      softlocks: null,
      error,
    });
    console.log(`? ${id}: ${error}`);
  }
  writeFileSync(out, JSON.stringify(data));
}
writeFileSync(out, JSON.stringify(data));
console.log(`wrote ${out}`);
