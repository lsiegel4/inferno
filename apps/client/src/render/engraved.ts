/**
 * Engraved art, after Gustave Doré's plates for the Inferno: ink linework, cross-hatched shadow,
 * sepia stone and bone highlights, with fire the only strong colour. Drawn in code like the rest
 * of the renderer, so it scales to any tile size.
 *
 * This is the first sample of the art pass: walls, floor, lava, the hero, Cerberus, signs, doors
 * and levers. Everything else still uses the classic drawing (each function returns false for
 * what it does not draw). Static tiles are drawn once per variant and size, then reused.
 */
import type { Entity, Hero } from "@inferno/shared";

export type ArtStyle = "classic" | "engraved";

let current: ArtStyle = "classic";

export function setArtStyle(style: ArtStyle): void {
  current = style;
}

export function artStyle(): ArtStyle {
  return current;
}

const INK = "#0b0705";
const BONE = "rgb(230 217 192";
const VARIANTS = 8;

function noise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Parallel burin lines across the current clip, `gap` apart at `angle`, each a little thicker or
 * thinner than the last, as an engraver's lines are.
 */
function hatch(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
  angle: number,
  color: string,
  width: number,
  seed: number,
): void {
  const cx = x + w / 2,
    cy = y + h / 2;
  const r = Math.hypot(w, h) / 2 + gap;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  g.strokeStyle = color;
  g.lineCap = "round";
  let i = 0;
  for (let o = -r; o <= r; o += gap, i++) {
    g.lineWidth = width * (0.55 + 0.9 * noise(seed, i));
    const ox = -dy * o,
      oy = dx * o;
    g.beginPath();
    g.moveTo(cx + ox - dx * r, cy + oy - dy * r);
    g.lineTo(cx + ox + dx * r, cy + oy + dy * r);
    g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Cached static tiles

const tiles = new Map<string, HTMLCanvasElement>();

function cached(key: string, ts: number, draw: (g: CanvasRenderingContext2D) => void) {
  const k = `${key}:${Math.round(ts)}`;
  let c = tiles.get(k);
  if (!c) {
    if (tiles.size > 400) tiles.clear(); // sizes change on resize; keep the cache small
    c = document.createElement("canvas");
    c.width = c.height = Math.max(1, Math.ceil(ts));
    const g = c.getContext("2d");
    if (g) draw(g);
    tiles.set(k, c);
  }
  return c;
}

/** Ashlar: dressed stone blocks in courses, hatched in shadow, with a dark face below. */
function wallTile(g: CanvasRenderingContext2D, ts: number, v: number, open: boolean): void {
  g.fillStyle = "#120d0a";
  g.fillRect(0, 0, ts, ts);
  const top = open ? ts * 0.64 : ts;
  const courses = open ? 2 : 3;
  const ch = top / courses;
  for (let row = 0; row < courses; row++) {
    const y = row * ch;
    const offset = (row + v) % 2 === 0 ? 0 : -ts * (0.3 + 0.2 * noise(v, row));
    for (let bx = offset; bx < ts;) {
      const bw = ts * (0.42 + 0.3 * noise(v, row, bx | 0));
      const x0 = Math.max(0, bx + 1),
        x1 = Math.min(ts, bx + bw - 1);
      if (x1 - x0 > 2) {
        const tone = 52 + Math.round(14 * noise(v + 3, row, bx | 0));
        g.fillStyle = `rgb(${tone + 4} ${tone - 6} ${tone - 18})`;
        g.fillRect(x0, y + 1, x1 - x0, ch - 2);
        g.save();
        g.beginPath();
        g.rect(x0, y + 1, x1 - x0, ch - 2);
        g.clip();
        // Light hatch over the whole block, cross-hatch in its lower shadow.
        hatch(
          g,
          x0,
          y,
          x1 - x0,
          ch,
          ts / 11,
          Math.PI / 4,
          "rgb(12 8 6 / 0.45)",
          ts / 70,
          v * 7 + row,
        );
        g.beginPath();
        g.rect(x0, y + ch * 0.62, x1 - x0, ch * 0.38);
        g.clip();
        hatch(
          g,
          x0,
          y,
          x1 - x0,
          ch,
          ts / 14,
          -Math.PI / 4,
          "rgb(12 8 6 / 0.5)",
          ts / 80,
          v * 5 + row,
        );
        g.restore();
        // A lit upper edge and a chisel mark.
        g.strokeStyle = `${BONE} / 0.2)`;
        g.lineWidth = Math.max(1, ts / 60);
        g.beginPath();
        g.moveTo(x0 + 1, y + 2);
        g.lineTo(x1 - 1, y + 2);
        g.stroke();
      }
      bx += bw;
    }
  }
  if (open) {
    // The wall's face, falling into shadow.
    const grad = g.createLinearGradient(0, top, 0, ts);
    grad.addColorStop(0, "#21180f");
    grad.addColorStop(1, "#0d0907");
    g.fillStyle = grad;
    g.fillRect(0, top, ts, ts - top);
    g.save();
    g.beginPath();
    g.rect(0, top, ts, ts - top);
    g.clip();
    hatch(g, 0, top, ts, ts - top, ts / 13, Math.PI / 2, "rgb(5 3 2 / 0.6)", ts / 70, v);
    g.restore();
    g.strokeStyle = `${BONE} / 0.16)`;
    g.lineWidth = Math.max(1, ts / 50);
    g.beginPath();
    g.moveTo(0, top + 0.5);
    g.lineTo(ts, top + 0.5);
    g.stroke();
  }
}

/** A worn flagstone: a slab with soft corners, lit from the upper left, hatched lower right. */
function floorTile(g: CanvasRenderingContext2D, ts: number, v: number, alt: boolean): void {
  g.fillStyle = "#0c0907";
  g.fillRect(0, 0, ts, ts);
  const j = (i: number) => ts * (0.03 + 0.05 * noise(v, i));
  const pts: [number, number][] = [
    [j(0), j(1)],
    [ts - j(2), j(3)],
    [ts - j(4), ts - j(5)],
    [j(6), ts - j(7)],
  ];
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
  };
  const tone = alt ? 38 : 34;
  g.fillStyle = `rgb(${tone + 7} ${tone - 1} ${tone - 10})`;
  path();
  g.fill();
  g.save();
  path();
  g.clip();
  // Shadow on the lower right: a triangle of hatching.
  g.beginPath();
  g.moveTo(ts, 0);
  g.lineTo(ts, ts);
  g.lineTo(0, ts);
  g.closePath();
  g.clip();
  hatch(g, 0, 0, ts, ts, ts / 10, Math.PI / 4, "rgb(8 5 4 / 0.42)", ts / 75, v + 11);
  g.restore();
  // Worn rim: lit top and left, dark bottom and right.
  g.lineWidth = Math.max(1, ts / 55);
  g.strokeStyle = `${BONE} / 0.13)`;
  g.beginPath();
  g.moveTo(pts[3]![0], pts[3]![1]);
  g.lineTo(pts[0]![0], pts[0]![1]);
  g.lineTo(pts[1]![0], pts[1]![1]);
  g.stroke();
  g.strokeStyle = "rgb(0 0 0 / 0.55)";
  g.beginPath();
  g.moveTo(pts[1]![0], pts[1]![1]);
  g.lineTo(pts[2]![0], pts[2]![1]);
  g.lineTo(pts[3]![0], pts[3]![1]);
  g.stroke();
  // Chisel marks, and now and then a crack.
  g.strokeStyle = "rgb(8 5 4 / 0.35)";
  g.lineWidth = Math.max(1, ts / 80);
  for (let i = 0; i < 2; i++) {
    const x = ts * (0.2 + 0.6 * noise(v, i, 3)),
      y = ts * (0.2 + 0.6 * noise(v, i, 4));
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + ts * 0.05, y - ts * 0.03, x + ts * 0.1, y + ts * 0.01);
    g.stroke();
  }
  if (noise(v, 9) < 0.15) {
    g.lineWidth = Math.max(1, ts / 45);
    g.beginPath();
    g.moveTo(ts * 0.15, ts * 0.7);
    g.lineTo(ts * 0.35, ts * 0.55);
    g.lineTo(ts * 0.42, ts * 0.62);
    g.lineTo(ts * 0.6, ts * 0.45);
    g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Terrain

/** Draws the terrain tile engraved; false when the classic drawing should handle it. */
export function engravedTerrain(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  at: (x: number, y: number) => string | undefined,
): boolean {
  const v = Math.floor(noise(x, y, 5) * VARIANTS);
  switch (ch) {
    case "#": {
      const below = at(x, y + 1);
      const open = below !== undefined && below !== "#";
      ctx.drawImage(
        cached(`wall:${v}:${open}`, ts, (g) => wallTile(g, ts, v, open)),
        sx,
        sy,
        ts + 0.5,
        ts + 0.5,
      );
      return true;
    }
    case ".":
    case "S": {
      const alt = (x + y) % 2 === 0;
      ctx.drawImage(
        cached(`floor:${v}:${alt}`, ts, (g) => floorTile(g, ts, v, alt)),
        sx,
        sy,
        ts + 0.5,
        ts + 0.5,
      );
      if (ch === "S") {
        // The pilgrim's starting stone: a carved ring.
        ctx.strokeStyle = `${BONE} / 0.22)`;
        ctx.lineWidth = Math.max(1, ts / 30);
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.28, 0, Math.PI * 2);
        ctx.stroke();
      }
      return true;
    }
    case "L":
      drawLava(ctx, x, y, sx, sy, ts, t);
      return true;
    default:
      return false;
  }
}

/** Molten rock: a glowing field with bright veins, under drifting plates of cooling crust. */
function drawLava(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
  ts: number,
  t: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, ts + 0.5, ts + 0.5);
  ctx.clip();
  const pulse = 0.5 + 0.5 * Math.sin(t / 900 + x * 1.3 + y * 0.7);
  const g = ctx.createLinearGradient(sx, sy, sx + ts, sy + ts);
  g.addColorStop(0, "#6e1606");
  g.addColorStop(0.5, `rgb(${190 + 30 * pulse} ${60 + 20 * pulse} 18)`);
  g.addColorStop(1, "#7a1a06");
  ctx.fillStyle = g;
  ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
  // Bright veins, flowing slowly (world coordinates, so they run on across tiles).
  ctx.strokeStyle = "rgb(255 196 110 / 0.85)";
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const phase = t / 2600 + i * 2.1;
    const yy = sy + ts * ((0.2 + i * 0.3 + 0.05 * Math.sin(phase + x)) % 1);
    ctx.lineWidth = ts * (0.025 + 0.02 * noise(x, y, i));
    ctx.beginPath();
    ctx.moveTo(sx - 2, yy);
    ctx.bezierCurveTo(
      sx + ts * 0.3,
      yy - ts * 0.12 * Math.sin(phase),
      sx + ts * 0.6,
      yy + ts * 0.12 * Math.cos(phase),
      sx + ts + 2,
      yy + ts * 0.04,
    );
    ctx.stroke();
  }
  // Plates of crust, each rimmed with light and hatched dark.
  for (let i = 0; i < 2; i++) {
    const drift = ((t / 14000 + noise(x, y, i + 7)) % 1) * ts;
    const px = sx + ((ts * noise(x, y, i) + drift) % ts) - ts * 0.15;
    const py = sy + ts * (0.15 + 0.55 * noise(y, x, i));
    const w = ts * (0.32 + 0.18 * noise(x, i, 2)),
      h = ts * (0.18 + 0.1 * noise(i, y, 3));
    ctx.beginPath();
    ctx.moveTo(px, py + h * 0.4);
    ctx.lineTo(px + w * 0.3, py);
    ctx.lineTo(px + w, py + h * 0.2);
    ctx.lineTo(px + w * 0.85, py + h);
    ctx.lineTo(px + w * 0.15, py + h * 0.9);
    ctx.closePath();
    ctx.fillStyle = "#2a0f08";
    ctx.fill();
    ctx.strokeStyle = "rgb(255 150 70 / 0.65)";
    ctx.lineWidth = Math.max(1, ts / 50);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, px, py, w, h, ts / 16, Math.PI / 4, "rgb(0 0 0 / 0.5)", ts / 90, i + x);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Figures and things

function ink(ctx: CanvasRenderingContext2D, ts: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, ts / 34);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

/** Dante: a pilgrim in a long red robe and his hooded cap, the liripipe trailing behind. */
export function engravedHero(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  sx: number,
  sy: number,
  ts: number,
  t: number,
): void {
  const ground = sy + ts * 0.9;
  ctx.save();
  ctx.translate(sx + ts / 2, ground);
  ctx.scale(1.15, 1.15);
  ctx.translate(-(sx + ts / 2), -ground);
  drawDante(ctx, hero, sx, sy, ts, t);
  ctx.restore();
}

function drawDante(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  sx: number,
  sy: number,
  ts: number,
  t: number,
): void {
  const cx = sx + ts / 2;
  const ground = sy + ts * 0.88;
  const sway = Math.sin(t / 650) * ts * 0.012;
  const side = hero.facing === "left" ? -1 : hero.facing === "right" ? 1 : 0;
  // Shadow
  ctx.fillStyle = "rgb(0 0 0 / 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, ground, ts * 0.22, ts * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Robe
  const robe = () => {
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.12, sy + ts * 0.4);
    ctx.quadraticCurveTo(cx - ts * 0.2, sy + ts * 0.62, cx - ts * 0.24 + sway, ground);
    ctx.lineTo(cx + ts * 0.24 + sway, ground);
    ctx.quadraticCurveTo(cx + ts * 0.2, sy + ts * 0.62, cx + ts * 0.12, sy + ts * 0.4);
    ctx.closePath();
  };
  robe();
  ctx.fillStyle = "#8c2216";
  ctx.fill();
  ctx.save();
  robe();
  ctx.clip();
  // Folds: long curved shadows, densest away from the light.
  ctx.strokeStyle = "rgb(30 4 2 / 0.6)";
  for (let i = 0; i < 5; i++) {
    const fx = cx - ts * 0.12 + i * ts * 0.07;
    ctx.lineWidth = Math.max(1, ts / (60 - i * 6));
    ctx.beginPath();
    ctx.moveTo(fx, sy + ts * 0.44);
    ctx.quadraticCurveTo(fx + ts * 0.04, sy + ts * 0.66, fx + ts * 0.02 * i + sway, ground);
    ctx.stroke();
  }
  hatch(
    ctx,
    cx,
    sy + ts * 0.4,
    ts * 0.3,
    ts * 0.5,
    ts / 16,
    Math.PI / 3,
    "rgb(20 3 2 / 0.45)",
    ts / 90,
    3,
  );
  ctx.restore();
  ink(ctx, ts);
  robe();
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 170 140 / 0.35)";
  ctx.lineWidth = Math.max(1, ts / 60);
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.11, sy + ts * 0.44);
  ctx.quadraticCurveTo(cx - ts * 0.18, sy + ts * 0.64, cx - ts * 0.21 + sway, ground - 2);
  ctx.stroke();
  // Liripipe: the hood's tail, down the back.
  ctx.strokeStyle = "#6e1a10";
  ctx.lineWidth = ts * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx - side * ts * 0.08, sy + ts * 0.3);
  ctx.quadraticCurveTo(
    cx - side * ts * 0.2,
    sy + ts * 0.42,
    cx - side * ts * 0.14 + sway,
    sy + ts * 0.62,
  );
  ctx.stroke();
  // Hood
  const hood = () => {
    ctx.beginPath();
    ctx.ellipse(cx, sy + ts * 0.3, ts * 0.13, ts * 0.14, 0, 0, Math.PI * 2);
  };
  hood();
  ctx.fillStyle = "#a12c1c";
  ctx.fill();
  ink(ctx, ts);
  hood();
  ctx.stroke();
  // The face, turned the way he faces (away from us when he faces up).
  if (hero.facing !== "up") {
    ctx.fillStyle = "#e3cdab";
    ctx.beginPath();
    ctx.ellipse(cx + side * ts * 0.05, sy + ts * 0.32, ts * 0.065, ts * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(60 30 20 / 0.7)";
    ctx.lineWidth = Math.max(1, ts / 70);
    ctx.stroke();
  }
  // Laurel
  ctx.strokeStyle = "#8f9450";
  ctx.lineWidth = Math.max(1, ts / 45);
  ctx.beginPath();
  ctx.arc(cx, sy + ts * 0.31, ts * 0.12, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

/** Draws the entity engraved; false when the classic drawing should handle it. */
export function engravedEntity(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  circle: number,
): boolean {
  const s = e.state ?? {};
  const cx = sx + ts / 2;
  switch (e.kind) {
    case "sign":
      drawTablet(ctx, sx, sy, ts, e.x * 31 + e.y);
      return true;
    case "door":
      if (s.open) drawDoorway(ctx, sx, sy, ts);
      else drawDoor(ctx, sx, sy, ts, s.inverted === true);
      return true;
    case "lever":
      drawLever(ctx, sx, sy, ts, s.pulled === true);
      return true;
    case "patrol":
      if (circle !== 6) return false;
      drawCerberus(ctx, cx, sy, ts, t, e.x + e.y);
      return true;
    default:
      return false;
  }
}

/** A carved stone tablet: rounded top, lines of incised text, shadowed on one side. */
function drawTablet(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  seed: number,
) {
  const x0 = sx + ts * 0.22,
    x1 = sx + ts * 0.78,
    y0 = sy + ts * 0.14,
    y1 = sy + ts * 0.8;
  const r = (x1 - x0) / 2;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + r);
    ctx.arc(x0 + r, y0 + r, r, Math.PI, 0);
    ctx.lineTo(x1, y1);
    ctx.closePath();
  };
  // Plinth
  ctx.fillStyle = "#2a231d";
  ctx.fillRect(sx + ts * 0.16, y1, ts * 0.68, ts * 0.08);
  shape();
  ctx.fillStyle = "#6a5e52";
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x0 + (x1 - x0) * 0.62, y0, x1 - x0, y1 - y0);
  ctx.clip();
  hatch(ctx, x0, y0, x1 - x0, y1 - y0, ts / 18, Math.PI / 4, "rgb(10 7 5 / 0.55)", ts / 90, seed);
  ctx.restore();
  ink(ctx, ts);
  shape();
  ctx.stroke();
  // Incised lines: a dark groove with a lit lower lip.
  for (let i = 0; i < 4; i++) {
    const ly = y0 + r * 0.9 + i * ts * 0.1;
    const lw = (x1 - x0) * (0.7 - 0.12 * noise(seed, i));
    ctx.strokeStyle = "rgb(20 14 10 / 0.9)";
    ctx.lineWidth = Math.max(1, ts / 40);
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.15, ly);
    ctx.lineTo(x0 + (x1 - x0) * 0.15 + lw, ly);
    ctx.stroke();
    ctx.strokeStyle = `${BONE} / 0.3)`;
    ctx.lineWidth = Math.max(1, ts / 90);
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.15, ly + ts * 0.018);
    ctx.lineTo(x0 + (x1 - x0) * 0.15 + lw, ly + ts * 0.018);
    ctx.stroke();
  }
}

/** A studded oak door under a pointed arch, banded in iron, with a ring for a handle. */
function drawDoor(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  inverted: boolean,
) {
  const x0 = sx + ts * 0.08,
    x1 = sx + ts * 0.92,
    y0 = sy + ts * 0.06,
    y1 = sy + ts * 0.96;
  const arch = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + ts * 0.3);
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, y0);
    ctx.quadraticCurveTo(x1, y0, x1, y0 + ts * 0.3);
    ctx.lineTo(x1, y1);
    ctx.closePath();
  };
  arch();
  ctx.fillStyle = "#5a3d26";
  ctx.fill();
  ctx.save();
  arch();
  ctx.clip();
  // Planks and their grain.
  for (let i = 0; i < 4; i++) {
    const px = x0 + ((x1 - x0) / 4) * i;
    ctx.strokeStyle = "rgb(20 10 4 / 0.75)";
    ctx.lineWidth = Math.max(1, ts / 50);
    ctx.beginPath();
    ctx.moveTo(px, y0);
    ctx.lineTo(px, y1);
    ctx.stroke();
    ctx.strokeStyle = "rgb(20 10 4 / 0.35)";
    ctx.lineWidth = Math.max(1, ts / 110);
    for (let g = 1; g < 4; g++) {
      const gx = px + ((x1 - x0) / 16) * g;
      ctx.beginPath();
      ctx.moveTo(gx, y0);
      ctx.bezierCurveTo(gx + ts * 0.015, y0 + ts * 0.3, gx - ts * 0.015, y0 + ts * 0.6, gx, y1);
      ctx.stroke();
    }
  }
  hatch(
    ctx,
    x0 + (x1 - x0) * 0.6,
    y0,
    (x1 - x0) * 0.4,
    y1 - y0,
    ts / 16,
    Math.PI / 4,
    "rgb(10 5 2 / 0.4)",
    ts / 90,
    4,
  );
  ctx.restore();
  // Iron bands with rivets.
  for (const by of [y0 + ts * 0.32, y0 + ts * 0.68]) {
    ctx.fillStyle = "#3a3632";
    ctx.fillRect(x0, by, x1 - x0, ts * 0.07);
    ctx.fillStyle = `${BONE} / 0.25)`;
    ctx.fillRect(x0, by, x1 - x0, Math.max(1, ts / 70));
    ctx.fillStyle = "#1a1816";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x0 + ((x1 - x0) / 4) * (i + 0.5), by + ts * 0.035, ts * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Ring handle, or a blood rune on a door that opens when its source goes dark.
  ctx.strokeStyle = inverted ? "#b0301f" : "#2a2622";
  ctx.lineWidth = Math.max(1.5, ts / 30);
  ctx.beginPath();
  ctx.arc(x1 - ts * 0.18, sy + ts * 0.55, ts * 0.05, 0, Math.PI * 2);
  ctx.stroke();
  ink(ctx, ts);
  arch();
  ctx.stroke();
}

/** An open doorway: the arch, deep in shadow, the door swung back against the jamb. */
function drawDoorway(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number) {
  const x0 = sx + ts * 0.08,
    x1 = sx + ts * 0.92,
    y0 = sy + ts * 0.06,
    y1 = sy + ts * 0.96;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0 + ts * 0.3);
  ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + ts * 0.3);
  ctx.lineTo(x1, y1);
  ink(ctx, ts);
  ctx.stroke();
  ctx.fillStyle = "rgb(0 0 0 / 0.25)";
  ctx.fill();
  // The leaf, seen edge-on.
  ctx.fillStyle = "#4a3220";
  ctx.fillRect(x0, y0 + ts * 0.2, ts * 0.09, y1 - y0 - ts * 0.2);
  ctx.strokeStyle = INK;
  ctx.strokeRect(x0, y0 + ts * 0.2, ts * 0.09, y1 - y0 - ts * 0.2);
}

/** An iron lever in a stone socket; its ember-tipped handle leans the way it was pulled. */
function drawLever(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  pulled: boolean,
) {
  const cx = sx + ts / 2;
  const by = sy + ts * 0.66;
  // Socket block
  ctx.fillStyle = "#4d443c";
  ctx.fillRect(sx + ts * 0.24, by, ts * 0.52, ts * 0.22);
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx + ts * 0.24, by, ts * 0.52, ts * 0.22);
  ctx.clip();
  hatch(
    ctx,
    sx + ts * 0.24,
    by,
    ts * 0.52,
    ts * 0.22,
    ts / 18,
    Math.PI / 4,
    "rgb(10 7 5 / 0.5)",
    ts / 90,
    9,
  );
  ctx.restore();
  ink(ctx, ts);
  ctx.strokeRect(sx + ts * 0.24, by, ts * 0.52, ts * 0.22);
  ctx.fillStyle = "#0d0a08";
  ctx.fillRect(cx - ts * 0.12, by + ts * 0.02, ts * 0.24, ts * 0.04);
  // Arm
  const ang = pulled ? 0.65 : -0.65;
  const tx = cx + Math.sin(ang) * ts * 0.36,
    ty = by + ts * 0.03 - Math.cos(ang) * ts * 0.36;
  ctx.strokeStyle = INK;
  ctx.lineWidth = ts * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, by + ts * 0.03);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.strokeStyle = "#7a746c";
  ctx.lineWidth = ts * 0.035;
  ctx.stroke();
  // Handle
  ctx.fillStyle = "#d98a36";
  ctx.beginPath();
  ctx.arc(tx, ty, ts * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
}

/** Cerberus, the three-headed hound of the gluttons: hatched black fur, three burning gazes. */
function drawCerberus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  // Drawn a size up, so the hound fills its tile and reads at a glance.
  const k = 1.25;
  ctx.save();
  ctx.translate(cx, sy + ts * 0.9);
  ctx.scale(k, k);
  ctx.translate(-cx, -(sy + ts * 0.9));
  drawHound(ctx, cx, sy, ts, t, seed);
  ctx.restore();
}

function drawHound(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const breathe = Math.sin(t / 300 + seed) * ts * 0.012;
  const by = sy + ts * 0.62 + breathe;
  // Shadow
  ctx.fillStyle = "rgb(0 0 0 / 0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.88, ts * 0.34, ts * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.strokeStyle = "#1a110d";
  ctx.lineWidth = ts * 0.06;
  ctx.lineCap = "round";
  for (const lx of [-0.22, -0.08, 0.08, 0.22]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * lx, by + ts * 0.06);
    ctx.lineTo(cx + ts * lx * 1.1, sy + ts * 0.86);
    ctx.stroke();
  }
  // Body, its fur in short hatched strokes.
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(cx, by, ts * 0.3, ts * 0.16, 0, 0, Math.PI * 2);
  };
  body();
  ctx.fillStyle = "#4a3326";
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  hatch(
    ctx,
    cx - ts * 0.3,
    by - ts * 0.16,
    ts * 0.6,
    ts * 0.32,
    ts / 20,
    Math.PI / 3,
    "rgb(0 0 0 / 0.6)",
    ts / 80,
    seed,
  );
  ctx.restore();
  ink(ctx, ts);
  body();
  ctx.stroke();
  // Three heads on three necks.
  const heads: [number, number, number][] = [
    [-0.22, 0.42, -0.25],
    [0, 0.33, 0],
    [0.22, 0.42, 0.25],
  ];
  for (const [hx, hy, tilt] of heads) {
    const x = cx + ts * hx,
      y = sy + ts * hy + breathe;
    ctx.strokeStyle = "#3a281e";
    ctx.lineWidth = ts * 0.09;
    ctx.beginPath();
    ctx.moveTo(cx + ts * hx * 0.5, by - ts * 0.06);
    ctx.lineTo(x, y + ts * 0.05);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // Ears
    ctx.fillStyle = "#1a110d";
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(ex * ts * 0.04, -ts * 0.06);
      ctx.lineTo(ex * ts * 0.09, -ts * 0.14);
      ctx.lineTo(ex * ts * 0.1, -ts * 0.03);
      ctx.fill();
    }
    // Skull and snout
    ctx.fillStyle = "#5a3e2e";
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 0.085, ts * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.06, ts * 0.05, ts * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx, ts);
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 0.085, ts * 0.075, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Eyes
    const glowA = 0.7 + 0.3 * Math.sin(t / 180 + hx * 9);
    ctx.fillStyle = `rgb(255 ${70 + 40 * glowA} 40 / ${glowA})`;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(ex * ts * 0.035, -ts * 0.01, ts * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    // Teeth
    ctx.fillStyle = `${BONE} / 0.85)`;
    for (const tx of [-0.025, 0, 0.025])
      ctx.fillRect(ts * tx - 1, ts * 0.085, Math.max(1, ts / 60), ts * 0.02);
    ctx.restore();
  }
}
