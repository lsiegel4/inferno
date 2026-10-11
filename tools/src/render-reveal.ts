/**
 * Renders a sample dark floor in each reveal mode to SVG (tools/previews/) and prints an ASCII
 * version. Run with `pnpm --filter @inferno/tools previews`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createGame,
  parseFloor,
  revealFor,
  TERRAIN,
  type GameState,
  type Reveal,
} from "@inferno/shared";

const GRID = [
  "###############",
  "#.....#.......#",
  "#.LL..#..k....#",
  "#.LL..A.......#",
  "#.....#####.###",
  "#..S..#.......#",
  "#.....#..*....#",
  "#..t..#.......#",
  "###############",
];

const LEGEND = {
  A: { id: "door", kind: "door" },
  k: { id: "key", kind: "item", item: "key", opens: "red" },
  t: { id: "torch", kind: "item", item: "torch" },
  "*": { id: "lamp", kind: "light", radius: 2 },
};

const MODES: { name: string; reveal: Reveal }[] = [
  { name: "viewport", reveal: { mode: "viewport" } },
  { name: "torchlight", reveal: { mode: "torchlight", radius: 3 } },
  { name: "line_of_sight", reveal: { mode: "line_of_sight", radius: 5 } },
];

const PALETTE = {
  dark: "#070505",
  basalt: "#14100e",
  stone: "#2b231f",
  floor: "#221b18",
  lava: "#e4572e",
  ember: "#f0a23b",
  bone: "#eadcc6",
  door: "#5a3f2a",
};

function gameFor(reveal: Reveal): GameState {
  const meta = { id: "preview", index: 1, minimumPlayers: 1, reveal, legend: LEGEND };
  return createGame([parseFloor(GRID.join("\n"), meta)]);
}

function svg(state: GameState, title: string): string {
  const ts = 24;
  const floor = state.floors[state.currentFloor]!;
  const { width, height, terrain } = floor.def;
  const visible = revealFor(state);
  const parts: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = terrain[y]![x]!;
      const fill = !visible(x, y)
        ? PALETTE.dark
        : ch === TERRAIN.wall
          ? PALETTE.stone
          : ch === TERRAIN.lava
            ? PALETTE.lava
            : PALETTE.floor;
      parts.push(`<rect x="${x * ts}" y="${y * ts}" width="${ts}" height="${ts}" fill="${fill}"/>`);
    }
  }
  for (const e of floor.entities) {
    if (!visible(e.x, e.y)) continue;
    const cx = e.x * ts + ts / 2;
    const cy = e.y * ts + ts / 2;
    if (e.kind === "door") {
      parts.push(
        `<rect x="${e.x * ts + 2}" y="${e.y * ts + 2}" width="${ts - 4}" height="${ts - 4}" fill="${PALETTE.door}"/>`,
      );
    } else if (e.kind === "light") {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${ts * 0.3}" fill="${PALETTE.ember}"/>`);
    } else if (e.kind === "item") {
      parts.push(
        `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="${PALETTE.ember}" transform="rotate(45 ${cx} ${cy})"/>`,
      );
    }
  }
  const hx = state.hero.x * ts + ts / 2;
  const hy = state.hero.y * ts + ts / 2;
  parts.push(`<circle cx="${hx}" cy="${hy}" r="${ts * 0.32}" fill="${PALETTE.bone}"/>`);
  const w = width * ts;
  const h = height * ts + 28;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${PALETTE.basalt}"/>`,
    `<text x="8" y="${height * ts + 19}" fill="${PALETTE.bone}" font-family="monospace" font-size="14">${title}</text>`,
    `<g>${parts.join("")}</g>`,
    `</svg>`,
    "",
  ].join("\n");
}

function ascii(state: GameState): string {
  const floor = state.floors[state.currentFloor]!;
  const visible = revealFor(state);
  const marks = new Map(
    floor.entities.map((e) => [
      `${e.x},${e.y}`,
      e.kind === "light" ? "*" : e.kind === "door" ? "A" : "i",
    ]),
  );
  return floor.def.terrain
    .map((row, y) =>
      [...row]
        .map((ch, x) => {
          if (!visible(x, y)) return "░";
          if (x === state.hero.x && y === state.hero.y) return "@";
          return marks.get(`${x},${y}`) ?? (ch === TERRAIN.start ? "." : ch);
        })
        .join(""),
    )
    .join("\n");
}

const outDir = fileURLToPath(new URL("../previews", import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const { name, reveal } of MODES) {
  const state = gameFor(reveal);
  const label = reveal.mode === "viewport" ? name : `${name} (radius ${reveal.radius})`;
  writeFileSync(`${outDir}/${name}.svg`, svg(state, label));
  console.log(`${label}\n${ascii(state)}\n`);
}
