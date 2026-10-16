/**
 * CLI: show which tiles of a floor the hero can reach from its start (deaths are dead ends).
 * A design aid for floors the solver reports as unfinishable:
 *   node dist/reach.js <floors dir> <floor id or index> [max states]
 * Prints the grid with reached tiles as "*".
 */
import { applyTurn, createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { atFloorStart, movesFor, stateKey, trimState } from "./solver.js";

const [dir = "floors", which, max = "300000"] = process.argv.slice(2);
const floors = loadFloorsFromDir(dir);
const def = floors.find((f) => f.id === which || String(f.index) === which);
if (!def) throw new Error(`no floor "${which}"`);
const start = trimState(atFloorStart(createGame(floors), def.id));
const seen = new Set([stateKey(start)]);
const queue = [start];
const reached = new Set<string>();
for (let head = 0; head < queue.length && seen.size < Number(max); head++) {
  const s = queue[head]!;
  reached.add(`${s.hero.x},${s.hero.y}`);
  for (const m of movesFor(s)) {
    const r = applyTurn(s, m.action, m.crowd);
    if (r.outcome && r.outcome !== "no_effect") continue;
    const k = stateKey(r.state);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push(r.state);
  }
}
console.log(`${seen.size} states`);
for (let y = 0; y < def.height; y++) {
  console.log(
    [...def.terrain[y]!]
      .map((ch, x) => {
        if (reached.has(`${x},${y}`)) return "*";
        const e = def.entities.find((e) => e.x === x && e.y === y);
        return e ? e.kind[0]! : ch;
      })
      .join(""),
  );
}
