import { createGame } from "@inferno/shared";
import { loadFloorsFromDir } from "@inferno/shared/node";
import { atFloorStart, solveFloor, formatMove } from "./dist/solver.js";
let s = atFloorStart(createGame(loadFloorsFromDir("../floors")), "caina-antenora");
s.hero = {
  x: Number(process.argv[2]),
  y: Number(process.argv[3]),
  facing: "right",
  stairsLock: false,
};
const sol = solveFloor(s, 3000000);
console.log(sol ? sol.moves.map(formatMove).join(" ") : "none");
