/**
 * Write every floor's solver route and difficulty figures as JSON, for the floor lab's atlas and
 * "Solution" button: node dist/export-solutions.js [floors dir] [out file]
 */
import { writeFileSync } from "node:fs";
import { createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { solveCampaign } from "./solver.js";

const [dir = "floors", out = "solutions.json"] = process.argv.slice(2);
const reports = solveCampaign(createGame(loadFloorsFromDir(dir)), {
  softlocks: false,
  onFloor: (r) => console.log(`${r.solution ? "✓" : "✗"} ${r.floorId}`),
});
const data = reports.map((r) => ({
  floorId: r.floorId,
  moves: r.solution?.moves ?? [],
  dangerSteps: r.solution?.dangerSteps ?? 0,
  splitSteps: r.solution?.splitSteps ?? 0,
  states: r.states,
  softlocks: r.softlocks,
}));
writeFileSync(out, JSON.stringify(data));
console.log(`wrote ${out}`);
