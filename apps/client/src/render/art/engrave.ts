/**
 * The engraver's tools, shared by all the art: burin hatching, ink outlines, cast shadows, fire
 * and glow, and a cache for tiles that never change. The art follows Gustave Doré's plates for
 * the Inferno: ink linework, cross-hatched shadow, sepia stone and bone highlights, with fire and
 * ember the only strong colours.
 */

export const INK = "#0b0705";
/** Bone highlight at an alpha: `bone(0.2)`. */
export const bone = (a: number) => `rgb(230 217 192 / ${a})`;

/** Deterministic noise in [0, 1). */
export function noise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Parallel burin lines across the current clip, `gap` apart at `angle`, each a little thicker or
 * thinner than the last, as an engraver's lines are.
 */
export function hatch(
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

/** Hatch inside a path (drawn by `shape`), in the region `x, y, w, h`. */
export function hatchIn(
  g: CanvasRenderingContext2D,
  shape: () => void,
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
  g.save();
  shape();
  g.clip();
  hatch(g, x, y, w, h, gap, angle, color, width, seed);
  g.restore();
}

/** Set up an ink outline stroke. */
export function ink(ctx: CanvasRenderingContext2D, ts: number, scale = 1): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, (ts / 34) * scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

/** A soft shadow on the ground under a figure. */
export function shadow(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, a = 0.35) {
  ctx.fillStyle = `rgb(0 0 0 / ${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, y, w, w * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function glow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** A licking flame standing on (cx, cy), `s` tall-ish. */
export function flame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  t: number,
  seed = 0,
) {
  const wob = Math.sin(t / 90 + seed) * 0.12;
  const lick = 1 + 0.08 * Math.sin(t / 130 + seed * 2);
  ctx.fillStyle = "#c4462b";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy);
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.9 * lick, cx + s * wob, cy - s * 1.5 * lick);
  ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.9 * lick, cx + s * 0.5, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f0a04a";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy);
  ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.6, cx + s * wob * 0.6, cy - s * 0.95 * lick);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.6, cx + s * 0.25, cy);
  ctx.closePath();
  ctx.fill();
}

const DIR_ANGLE: Record<string, number> = {
  up: -Math.PI / 2,
  down: Math.PI / 2,
  left: Math.PI,
  right: 0,
};

/** A small solid arrowhead pointing `dir`. */
export function arrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: string,
  size: number,
  color: string,
) {
  const a = DIR_ANGLE[dir];
  if (a === undefined) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.5, -size * 0.6);
  ctx.lineTo(-size * 0.5, size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const DX = (d: string) => ({ left: -1, right: 1 })[d as "left"] ?? 0;
export const DY = (d: string) => ({ up: -1, down: 1 })[d as "up"] ?? 0;

/** A colour per lock name, so a key and its door always match. */
export function lockColor(name: string): string {
  const colors = ["#d4a94e", "#c0c6cf", "#d0582c", "#6e9784", "#9b85d6", "#7fc95b"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return colors[Math.abs(h) % colors.length]!;
}

const tiles = new Map<string, HTMLCanvasElement>();

/** A tile that never changes, drawn once per key and size and reused. */
export function cached(key: string, ts: number, draw: (g: CanvasRenderingContext2D) => void) {
  const k = `${key}:${Math.round(ts)}`;
  let c = tiles.get(k);
  if (!c) {
    if (tiles.size > 600) tiles.clear(); // sizes change on resize; keep the cache small
    c = document.createElement("canvas");
    c.width = c.height = Math.max(1, Math.ceil(ts));
    const g = c.getContext("2d");
    if (g) draw(g);
    tiles.set(k, c);
  }
  return c;
}

/** Draw around a figure flipped to face left (figures are drawn facing right). */
export function facing(ctx: CanvasRenderingContext2D, cx: number, left: boolean, draw: () => void) {
  ctx.save();
  if (left) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }
  draw();
  ctx.restore();
}
