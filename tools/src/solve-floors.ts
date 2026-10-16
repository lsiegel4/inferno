/**
 * CLI: validate every floor in a directory, then play the floors in order with the solver and
 * print each floor's shortest route and difficulty figures.
 *
 *   node dist/solve-floors.js [dir] [--softlocks] [--only <floor id or index>]
 *
 * --softlocks also explores every reachable state of each floor (slow on big floors) and fails if
 * any of them can no longer reach the stairs. --only starts the floor fresh (empty inventory)
 * unless --campaign is given, in which case the earlier floors are played first.
 */
import { createGame, FloorSetError } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import {
  analyseFloor,
  atFloorStart,
  formatMove,
  solveCampaign,
  solveFloorWithStats as analyseQuick,
  type FloorReport,
} from "./solver.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--only") ?? "floors";
const only = option("--only");
const softlocks = flag("--softlocks");
const campaign = flag("--campaign");

try {
  const floors = loadFloorsFromDir(dir);
  const game = createGame(floors);
  const byId = new Map(floors.map((f) => [f.id, f]));
  let failed = false;
  const print = (r: FloorReport) => {
    const def = byId.get(r.floorId)!;
    if (only && only !== r.floorId && only !== String(def.index)) return;
    const title = `${String(def.index).padStart(2)} ${r.floorId}${def.name ? ` (${def.name})` : ""}`;
    if (!r.solution) {
      failed = true;
      console.log(`✗ ${title}: cannot be finished${r.error ? ` (${r.error})` : ""}`);
      return;
    }
    const { moves, dangerSteps, splitSteps } = r.solution;
    const lock =
      r.softlocks === null
        ? ""
        : r.softlocks === 0
          ? ", no softlocks"
          : `, ${r.softlocks} SOFTLOCKED states`;
    if (r.softlocks) failed = true;
    console.log(
      `✓ ${title}: ${moves.length} turns, ${dangerSteps} with a deadly option` +
        `${splitSteps ? `, ${splitSteps} split votes` : ""}; ${r.states} states${lock}` +
        `${r.error ? ` (softlock check skipped: ${r.error})` : ""}`,
    );
    console.log(`  ${moves.map(formatMove).join(" ")}`);
    if (r.softlockRoute) console.log(`  softlock: ${r.softlockRoute.map(formatMove).join(" ")}`);
  };
  const wanted = (id: string) => !only || only === id || only === String(byId.get(id)!.index);
  if (only && !campaign) {
    for (const f of floors.filter((f) => wanted(f.id))) {
      const start = atFloorStart(game, f.id);
      print({ floorId: f.id, ...(softlocks ? analyseFloor(start) : analyseQuick(start)) });
    }
  } else {
    const last = Math.max(...floors.filter((f) => wanted(f.id)).map((f) => f.index));
    solveCampaign(game, {
      softlocks,
      analyse: wanted,
      onFloor: print,
      stopAfter: (id) => byId.get(id)!.index >= last,
    });
  }
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  if (e instanceof FloorSetError) {
    console.error(e.message);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
