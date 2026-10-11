/** CLI: validate every floor in a directory and print each floor's shortest route. */
import { createGame, FloorSetError } from "@inferno/shared";
import { loadFloorsFromDir } from "./load-floors.js";
import { atFloorStart, formatAction, solveFloor } from "./solver.js";

const dir = process.argv[2] ?? "floors";
try {
  const game = createGame(loadFloorsFromDir(dir));
  let failed = false;
  for (const id of game.floorOrder) {
    const solution = solveFloor(atFloorStart(game, id));
    if (!solution) {
      failed = true;
      console.log(`✗ ${id}: cannot be finished`);
      continue;
    }
    const { actions, dangerSteps } = solution;
    console.log(`✓ ${id}: ${actions.length} turns, ${dangerSteps} with a deadly option`);
    console.log(`  ${actions.map(formatAction).join(" ")}`);
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
