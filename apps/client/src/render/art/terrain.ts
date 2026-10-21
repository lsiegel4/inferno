/**
 * Engraved terrain: dressed-stone walls, worn flagstones, molten lava, the ice of Cocytus, and
 * the stairs. Static tiles are drawn once per variant and size (see `cached`).
 */
import { bone, cached, glow, hatch, ink, noise } from "./engrave.js";

const BONE = "rgb(230 217 192";
const VARIANTS = 8;

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

/** The ice of Cocytus: pale, glassy, crazed with cracks, a cold sheen across it. */
function iceTile(g: CanvasRenderingContext2D, ts: number, v: number): void {
  const grad = g.createLinearGradient(0, 0, ts, ts);
  grad.addColorStop(0, "#b8ccd2");
  grad.addColorStop(1, "#7f9aa3");
  g.fillStyle = grad;
  g.fillRect(0, 0, ts, ts);
  // Depth: fine hatching in the lower half, like the shade under clear ice.
  g.save();
  g.beginPath();
  g.rect(0, ts * 0.45, ts, ts * 0.55);
  g.clip();
  hatch(g, 0, 0, ts, ts, ts / 12, Math.PI / 5, "rgb(30 50 60 / 0.25)", ts / 90, v + 21);
  g.restore();
  // Cracks
  g.strokeStyle = "rgb(20 35 42 / 0.55)";
  g.lineWidth = Math.max(1, ts / 60);
  g.beginPath();
  const x0 = ts * (0.1 + 0.3 * noise(v, 1)),
    y0 = ts * (0.2 + 0.4 * noise(v, 2));
  g.moveTo(x0, y0);
  g.lineTo(ts * 0.5, ts * (0.4 + 0.2 * noise(v, 3)));
  g.lineTo(ts * 0.9, ts * (0.3 + 0.5 * noise(v, 4)));
  g.moveTo(ts * 0.5, ts * (0.4 + 0.2 * noise(v, 3)));
  g.lineTo(ts * (0.4 + 0.2 * noise(v, 5)), ts * 0.92);
  g.stroke();
  // Sheen
  g.strokeStyle = "rgb(255 255 255 / 0.55)";
  g.lineWidth = Math.max(1, ts / 40);
  g.beginPath();
  g.moveTo(ts * 0.14, ts * 0.3);
  g.lineTo(ts * 0.36, ts * 0.12);
  g.moveTo(ts * 0.2, ts * 0.42);
  g.lineTo(ts * 0.3, ts * 0.33);
  g.stroke();
  g.strokeStyle = "rgb(20 35 42 / 0.35)";
  g.strokeRect(0.5, 0.5, ts - 1, ts - 1);
}

/**
 * Stairs. "U" is the way on, deeper into Hell: steps spiralling down into a fiery well. "D"
 * climbs back toward the circle above: steps rising into cold, pale light.
 */
function drawStairs(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  deeper: boolean,
  t: number,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t / 420);
  ctx.fillStyle = "#0a0605";
  ctx.fillRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
  // Steps: wedges around the well, each lower one darker (or lighter, going up).
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const a0 = -Math.PI / 2 + (i / steps) * Math.PI * 1.7;
    const a1 = a0 + (Math.PI * 1.7) / steps;
    const r0 = ts * (0.4 - i * 0.03),
      r1 = ts * 0.14;
    const tone = deeper ? 120 - i * 13 : 50 + i * 12;
    ctx.fillStyle = `rgb(${tone + 6} ${tone - 4} ${tone - 16})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, a0, a1);
    ctx.arc(cx, cy, r1, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ink(ctx, ts, 0.6);
    ctx.stroke();
  }
  if (deeper) {
    glow(ctx, cx, cy, ts * 0.45, `rgba(255,150,50,${0.6 + 0.3 * pulse})`);
    ctx.fillStyle = `rgb(255 ${150 + 40 * pulse} 70)`;
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else {
    glow(ctx, cx, cy, ts * 0.4, "rgba(200,215,230,0.35)");
  }
  ctx.strokeStyle = deeper ? `rgb(212 169 78 / ${0.55 + 0.3 * pulse})` : bone(0.4);
  ctx.lineWidth = Math.max(1, ts / 26);
  ctx.strokeRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
}

/** Draw one terrain tile. `at` reads the terrain around it (" " or undefined when unseen). */
export function drawTerrainArt(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  at: (x: number, y: number) => string | undefined,
): void {
  const v = Math.floor(noise(x, y, 5) * VARIANTS);
  const size = ts + 0.5;
  switch (ch) {
    case "#": {
      const below = at(x, y + 1);
      const open = below !== undefined && below !== "#";
      ctx.drawImage(
        cached(`wall:${v}:${open}`, ts, (g) => wallTile(g, ts, v, open)),
        sx,
        sy,
        size,
        size,
      );
      return;
    }
    case "L":
      drawLava(ctx, x, y, sx, sy, ts, t);
      return;
    case "I":
      ctx.drawImage(
        cached(`ice:${v}`, ts, (g) => iceTile(g, ts, v)),
        sx,
        sy,
        size,
        size,
      );
      return;
    default: {
      // Floor-like tiles: . S U D
      const alt = (x + y) % 2 === 0;
      ctx.drawImage(
        cached(`floor:${v}:${alt}`, ts, (g) => floorTile(g, ts, v, alt)),
        sx,
        sy,
        size,
        size,
      );
      if (ch === "S") {
        // The pilgrim's starting stone: a carved ring.
        ctx.strokeStyle = bone(0.22);
        ctx.lineWidth = Math.max(1, ts / 30);
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.28, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (ch === "U" || ch === "D") drawStairs(ctx, sx, sy, ts, ch === "U", t);
    }
  }
}
