import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFloor, type FloorDef } from "@inferno/shared";

/** Read every floor folder (grid.txt + floor.json) in a directory. */
export function loadFloorsFromDir(dir: string): FloorDef[] {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => {
      const grid = readFileSync(join(dir, name, "grid.txt"), "utf8");
      const meta: unknown = JSON.parse(readFileSync(join(dir, name, "floor.json"), "utf8"));
      return parseFloor(grid, meta);
    });
}
