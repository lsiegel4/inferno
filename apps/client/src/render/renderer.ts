/**
 * Canvas renderer for floors as clients see them (protocol FloorState: unrevealed tiles are " ",
 * hidden entities absent, disguised ones under their disguise). It lays out the scene (terrain,
 * flames, entities, the hero, then torchlight and fog); the engraved art in ./art draws each
 * thing, in vector shapes so it scales to any tile size.
 */
import type { Entity, FloorState, Hero } from "@inferno/shared";
import { arrow, DX, DY } from "./art/engrave.js";
import { drawFigureArt, drawHeroArt } from "./art/figures.js";
import { drawTerrainArt } from "./art/terrain.js";
import { drawThingArt } from "./art/things.js";
import { drawAtmosphere } from "./atmosphere.js";

/**
 * The Manuscript palette, shared with the interface: the colours marked "token" are the same as
 * the custom properties of the same role in styles.css (a test keeps them in step).
 */
export const PALETTE = {
  void: "#0b0907", // token --ink
  wallTop: "#3b322b", // token --stone-light
  wallFace: "#18130f",
  wallEdge: "#4f433a",
  floorA: "#211b17", // token --floor
  floorB: "#1d1814",
  grout: "#100c0a",
  lavaDeep: "#6e1a08",
  lava: "#c4462b", // token --lava
  lavaHot: "#f0a04a",
  ice: "#a9c4cc",
  iceDeep: "#6a8f9a",
  ember: "#d98a36", // token --ember
  bone: "#e6d9c0", // token --bone
  blood: "#9a2a1e",
  wood: "#5a4030",
  woodDark: "#3a2a1c",
  iron: "#6b6560",
  stone: "#8a8074",
  stoneDark: "#4d453e",
  violet: "#9b85d6",
  teal: "#6e9784", // token --verdigris
  gold: "#d4a94e",
};

export interface SceneView {
  floor: FloorState;
  hero: Hero;
  /** Tiles seen before (explored map): terrain characters, drawn dimmed when not lit. */
  remembered: Map<string, string>;
  /** Extra entities to outline (designer x-ray: hidden traps etc.). */
  xray: Entity[];
  /** Camera top-left in tiles (may be fractional). */
  camX: number;
  camY: number;
  tile: number;
  time: number;
  /** 0..1: a red flash after a death. */
  hurt: number;
  /** False with prefers-reduced-motion: the torch does not flicker and the fog holds still. */
  motion?: boolean;
  /** The hero's height above the floor in tiles, mid-jump. */
  heroLift?: number;
}

const key = (x: number, y: number) => `${x},${y}`;

export function drawScene(ctx: CanvasRenderingContext2D, v: SceneView, w: number, h: number) {
  const { floor, tile: ts } = v;
  const rows = floor.tiles.split("\n");
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, w, h);

  const x0 = Math.floor(v.camX) - 1;
  const y0 = Math.floor(v.camY) - 1;
  const x1 = Math.ceil(v.camX + w / ts) + 1;
  const y1 = Math.ceil(v.camY + h / ts) + 1;
  const px = (x: number) => (x - v.camX) * ts;
  const py = (y: number) => (y - v.camY) * ts;

  // Terrain
  for (let y = Math.max(0, y0); y < Math.min(floor.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(floor.width, x1); x++) {
      const ch = rows[y]?.[x] ?? " ";
      const seen = ch !== " ";
      const mem = seen ? ch : v.remembered.get(key(x, y));
      if (!mem) continue;
      const sx = px(x),
        sy = py(y);
      drawTerrain(ctx, mem, x, y, sx, sy, ts, v.time, rows, v.remembered);
    }
  }

  // Beams under entities
  for (const e of floor.entities) if (e.kind === "beam") drawBeamPath(ctx, e, px, py, ts, v.time);

  // Entities
  const order = (e: Entity) =>
    ({
      platform: 0,
      bridge: 0,
      crack: 1,
      trap: 1,
      crumble: 1,
      plate: 2,
      vent: 2,
      portal: 2,
      oneway: 2,
      vigil: 2,
    })[e.kind] ?? 5;
  for (const e of [...floor.entities].sort((a, b) => order(a) - order(b))) {
    if (e.state?.hidden === true) continue;
    drawEntity(ctx, e, px(e.x), py(e.y), ts, v.time, v.hero, floor.index);
  }
  for (const e of v.xray) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,60,60,0.9)";
    ctx.setLineDash([ts / 8, ts / 10]);
    ctx.lineWidth = Math.max(1, ts / 20);
    ctx.strokeRect(px(e.x) + ts * 0.1, py(e.y) + ts * 0.1, ts * 0.8, ts * 0.8);
    ctx.restore();
  }

  const lift = (v.heroLift ?? 0) * ts;
  if (lift > 0) {
    // The hero's shadow stays on the floor during a jump.
    ctx.fillStyle = `rgba(0,0,0,${0.35 - lift / ts / 3})`;
    ctx.beginPath();
    ctx.ellipse(
      px(v.hero.x) + ts / 2,
      py(v.hero.y) + ts * 0.8,
      ts * 0.22,
      ts * 0.07,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  drawHero(ctx, v.hero, px(v.hero.x), py(v.hero.y) - lift, ts, v.time);

  // Torchlight, fog and glow over everything: the light fades toward what cannot be seen.
  drawAtmosphere(
    ctx,
    {
      rows,
      width: floor.width,
      height: floor.height,
      remembered: (x, y) => v.remembered.has(key(x, y)),
      camX: v.camX,
      camY: v.camY,
      tile: ts,
      time: v.time,
      motion: v.motion ?? true,
      glows: [
        { x: v.hero.x, y: v.hero.y, radius: 2.6 },
        ...floor.entities
          .filter((e) => e.kind === "light")
          .map((e) => ({ x: e.x, y: e.y, radius: 2.2 })),
      ],
    },
    w,
    h,
  );

  if (v.hurt > 0) {
    ctx.fillStyle = `rgba(163,18,28,${0.45 * v.hurt})`;
    ctx.fillRect(0, 0, w, h);
  }
  // Vignette
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.35,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  rows: string[],
  remembered: Map<string, string>,
) {
  const at = (xx: number, yy: number) => {
    const c = rows[yy]?.[xx];
    return c && c !== " " ? c : remembered.get(key(xx, yy));
  };
  drawTerrainArt(ctx, ch, x, y, sx, sy, ts, t, at);
}

function drawBeamPath(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  px: (x: number) => number,
  py: (y: number) => number,
  ts: number,
  t: number,
) {
  const path = (e.state?.path as [number, number][] | undefined) ?? [];
  if (!e.state?.firing || path.length === 0) return;
  const pts = [[e.x, e.y] as [number, number], ...path];
  const flicker = 0.85 + 0.15 * Math.sin(t / 60);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [width, color] of [
    [ts * 0.42, `rgba(255,40,10,${0.22 * flicker})`],
    [ts * 0.2, `rgba(255,90,20,${0.7 * flicker})`],
    [ts * 0.07, "rgba(255,240,200,0.95)"],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const cx = px(x) + ts / 2,
        cy = py(y) + ts / 2;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw one entity at screen position (sx, sy). */
export function drawEntity(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  /** Where the hero stands (watchers' eyes follow it). */
  hero?: { x: number; y: number },
  /** The floor's circle (index): enemies are drawn as that circle's creatures. */
  circle = 0,
) {
  ctx.save();
  const drawn =
    drawFigureArt(ctx, e, sx, sy, ts, t, hero, circle) || drawThingArt(ctx, e, sx, sy, ts, t);
  ctx.restore();
  if (e.kind === "patrol") patrolFootprint(ctx, e, sx + ts / 2, sy + ts / 2, ts, t);
  if (!drawn) {
    // A kind the art does not know yet: a loud placeholder, so it is noticed.
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(sx + ts * 0.3, sy + ts * 0.3, ts * 0.4, ts * 0.4);
  }
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  sx: number,
  sy: number,
  ts: number,
  t: number,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  ctx.save();
  drawHeroArt(ctx, hero, sx, sy, ts, t);
  ctx.restore();
  arrow(
    ctx,
    cx + DX(hero.facing) * ts * 0.44,
    cy + DY(hero.facing) * ts * 0.44,
    hero.facing,
    ts * 0.1,
    PALETTE.ember,
  );
}

/** Where a patrol will tread next: a faint scorch on that tile, breathing with its stride. */
function patrolFootprint(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  cx: number,
  cy: number,
  ts: number,
  t: number,
) {
  const s = e.state ?? {};
  if (typeof s.next === "string" && s.next !== "wait") {
    // Where it will tread next: a faint scorch on that tile, breathing with its stride.
    const n = s.next;
    const fx = cx + DX(n) * ts,
      fy = cy + DY(n) * ts;
    const pulse = 0.5 + 0.5 * Math.sin(t / 220 + e.x + e.y);
    const scorch = ctx.createRadialGradient(fx, fy, 0, fx, fy, ts * 0.42);
    scorch.addColorStop(0, `rgba(170,30,20,${0.22 + 0.12 * pulse})`);
    scorch.addColorStop(1, "rgba(170,30,20,0)");
    ctx.fillStyle = scorch;
    ctx.fillRect(fx - ts / 2, fy - ts / 2, ts, ts);
    // Two claw marks, turned the way it is heading.
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.atan2(DY(n), DX(n)) + Math.PI / 2);
    ctx.strokeStyle = `rgba(40,6,4,${0.35 + 0.2 * pulse})`;
    ctx.lineWidth = Math.max(1, ts / 22);
    ctx.lineCap = "round";
    for (const ox of [-0.09, 0.09]) {
      ctx.beginPath();
      ctx.moveTo(ts * ox, ts * 0.12);
      ctx.lineTo(ts * ox * 1.2, -ts * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }
}
