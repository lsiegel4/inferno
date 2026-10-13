/**
 * Canvas drawing in an engraving style: hatched stone, stippled floors, inked outlines.
 * Pure functions of (context, view, camera); no React.
 */
import { VIEW_HEIGHT, VIEW_WIDTH, type Entity } from "@inferno/shared";
import type { FloorView } from "../game/store.js";
import { INK } from "./palette.js";

/** Deterministic per-tile noise so stipple and hatching don't flicker. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hatch(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number, gap: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, ts, ts);
  ctx.clip();
  ctx.strokeStyle = INK.ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, ts / 28);
  ctx.beginPath();
  for (let d = -ts; d < ts * 2; d += gap) {
    ctx.moveTo(px + d, py);
    ctx.lineTo(px + d - ts, py + ts);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  px: number,
  py: number,
  ts: number,
  t: number,
): void {
  if (ch === " ") {
    ctx.fillStyle = INK.ink;
    ctx.fillRect(px, py, ts, ts);
    return;
  }
  if (ch === "#") {
    ctx.fillStyle = INK.stone;
    ctx.fillRect(px, py, ts, ts);
    hatch(ctx, px, py, ts, ts / (4 + Math.floor(hash(x, y) * 3)));
    ctx.fillStyle = INK.stoneLight;
    ctx.fillRect(px, py, ts, Math.max(1, ts / 14));
    return;
  }
  ctx.fillStyle = INK.floor;
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = INK.ash;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 5; i++) {
    const r = hash(x * 7 + i, y * 13 - i);
    const s = hash(y * 5 - i, x * 11 + i);
    ctx.fillRect(px + r * ts, py + s * ts, Math.max(1, ts / 40), Math.max(1, ts / 40));
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

  if (ch === "L") {
    ctx.fillStyle = INK.lava;
    ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
    ctx.strokeStyle = INK.ember;
    ctx.lineWidth = Math.max(1, ts / 18);
    for (let row = 0; row < 3; row++) {
      const yy = py + ts * (0.25 + row * 0.25);
      ctx.beginPath();
      for (let xx = 0; xx <= ts; xx += 2) {
        const wave = Math.sin((xx / ts) * Math.PI * 2 + t / 700 + row + x) * ts * 0.04;
        if (xx === 0) ctx.moveTo(px + xx, yy + wave);
        else ctx.lineTo(px + xx, yy + wave);
      }
      ctx.stroke();
    }
  } else if (ch === "U" || ch === "D") {
    ctx.strokeStyle = INK.bone;
    ctx.lineWidth = Math.max(1, ts / 20);
    for (let i = 0; i < 4; i++) {
      const w = ch === "U" ? 0.75 - i * 0.12 : 0.39 + i * 0.12;
      const yy = py + ts * (0.25 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(px + ts * (0.5 - w / 2), yy);
      ctx.lineTo(px + ts * (0.5 + w / 2), yy);
      ctx.stroke();
    }
  } else if (ch === "S") {
    ctx.strokeStyle = INK.ash;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(px + ts / 2, py + ts / 2, ts * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawEntity(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  px: number,
  py: number,
  ts: number,
) {
  const s = e.state ?? {};
  const c = (fx: number, fy: number) => [px + ts * fx, py + ts * fy] as const;
  ctx.lineWidth = Math.max(1.5, ts / 18);
  ctx.strokeStyle = INK.ink;
  switch (e.kind) {
    case "door":
    case "locked_door": {
      if (s.open) {
        ctx.fillStyle = INK.stoneLight;
        ctx.fillRect(px, py, ts * 0.12, ts);
        ctx.fillRect(px + ts * 0.88, py, ts * 0.12, ts);
        break;
      }
      ctx.fillStyle = INK.wood;
      ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px + (i * ts) / 4, py + 2);
        ctx.lineTo(px + (i * ts) / 4, py + ts - 2);
        ctx.stroke();
      }
      ctx.fillStyle = e.kind === "locked_door" ? INK.ember : INK.bone;
      ctx.fillRect(...c(0.44, 0.46), ts * 0.12, ts * 0.12);
      break;
    }
    case "lever": {
      const ang = s.pulled ? Math.PI * 0.25 : -Math.PI * 0.25;
      const [bx, by] = c(0.5, 0.7);
      ctx.fillStyle = INK.stoneLight;
      ctx.fillRect(px + ts * 0.3, by - ts * 0.04, ts * 0.4, ts * 0.16);
      ctx.strokeStyle = INK.bone;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(ang) * ts * 0.36, by - Math.cos(ang) * ts * 0.36);
      ctx.stroke();
      ctx.fillStyle = s.pulled ? INK.verdigris : INK.lava;
      ctx.beginPath();
      ctx.arc(
        bx + Math.sin(ang) * ts * 0.36,
        by - Math.cos(ang) * ts * 0.36,
        ts * 0.08,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case "item": {
      ctx.fillStyle = INK.ember;
      ctx.strokeStyle = INK.ink;
      if (s.item === "key") {
        ctx.beginPath();
        ctx.arc(...c(0.38, 0.5), ts * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(...c(0.46, 0.46), ts * 0.32, ts * 0.08);
        ctx.fillRect(...c(0.68, 0.5), ts * 0.06, ts * 0.12);
      } else if (s.item === "torch") {
        ctx.fillStyle = INK.wood;
        ctx.fillRect(...c(0.46, 0.4), ts * 0.08, ts * 0.42);
        ctx.fillStyle = INK.ember;
        ctx.beginPath();
        ctx.ellipse(...c(0.5, 0.34), ts * 0.1, ts * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = INK.ash;
        ctx.beginPath();
        ctx.ellipse(...c(0.5, 0.58), ts * 0.22, ts * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "sign": {
      ctx.fillStyle = INK.wood;
      ctx.fillRect(...c(0.47, 0.5), ts * 0.06, ts * 0.38);
      ctx.fillStyle = INK.bone;
      ctx.fillRect(...c(0.22, 0.22), ts * 0.56, ts * 0.3);
      ctx.strokeRect(...c(0.22, 0.22), ts * 0.56, ts * 0.3);
      break;
    }
    case "pit": {
      ctx.fillStyle = INK.ink;
      ctx.beginPath();
      ctx.ellipse(...c(0.5, 0.52), ts * 0.38, ts * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "light": {
      const g = ctx.createRadialGradient(...c(0.5, 0.5), 1, ...c(0.5, 0.5), ts * 0.5);
      g.addColorStop(0, INK.ember);
      g.addColorStop(1, "rgba(217,138,54,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, ts, ts);
      break;
    }
    case "block": {
      if (s.filled) break; // a filled block is just floor
      ctx.fillStyle = INK.stoneLight;
      ctx.fillRect(px + ts * 0.12, py + ts * 0.12, ts * 0.76, ts * 0.76);
      ctx.strokeRect(px + ts * 0.12, py + ts * 0.12, ts * 0.76, ts * 0.76);
      hatch(ctx, px + ts * 0.12, py + ts * 0.12, ts * 0.76, ts / 6);
      break;
    }
    case "plate": {
      ctx.strokeStyle = s.pressed ? INK.verdigris : INK.ash;
      ctx.strokeRect(px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.6);
      break;
    }
    default: {
      ctx.strokeStyle = INK.ash;
      ctx.strokeRect(px + ts * 0.3, py + ts * 0.3, ts * 0.4, ts * 0.4);
    }
  }
}

export function drawHero(
  ctx: CanvasRenderingContext2D,
  hero: { facing: "up" | "down" | "left" | "right" },
  cx: number,
  cy: number,
  ts: number,
) {
  ctx.fillStyle = INK.bone;
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = Math.max(1.5, ts / 16);
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A notch pointing the way the hero faces.
  const a = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[hero.facing];
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * ts * 0.28, cy + Math.sin(a) * ts * 0.28);
  ctx.lineTo(cx + Math.cos(a + 2.5) * ts * 0.12, cy + Math.sin(a + 2.5) * ts * 0.12);
  ctx.lineTo(cx + Math.cos(a - 2.5) * ts * 0.12, cy + Math.sin(a - 2.5) * ts * 0.12);
  ctx.closePath();
  ctx.fill();
}

/** Draw the camera window. `cam` is the (possibly fractional) top-left tile. */
export function drawView(
  ctx: CanvasRenderingContext2D,
  floor: FloorView,
  hero: { x: number; y: number; facing: "up" | "down" | "left" | "right" },
  cam: { x: number; y: number },
  ts: number,
  t: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.translate(-Math.round(cam.x * ts), -Math.round(cam.y * ts));
  const x0 = Math.floor(cam.x);
  const y0 = Math.floor(cam.y);
  for (let y = y0; y <= Math.min(floor.height - 1, y0 + VIEW_HEIGHT); y++) {
    for (let x = x0; x <= Math.min(floor.width - 1, x0 + VIEW_WIDTH); x++) {
      drawTerrain(ctx, floor.tiles[y]?.[x] ?? " ", x, y, x * ts, y * ts, ts, t);
    }
  }
  for (const e of Object.values(floor.entities)) {
    if ((floor.tiles[e.y]?.[e.x] ?? " ") !== " ") drawEntity(ctx, e, e.x * ts, e.y * ts, ts);
  }
  // The tile the hero faces, so voters can see what Interact and Jump will act on.
  const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[hero.facing];
  ctx.setLineDash([ts / 8, ts / 8]);
  ctx.strokeStyle = INK.ember;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.5;
  ctx.strokeRect((hero.x + f[0]!) * ts + 3, (hero.y + f[1]!) * ts + 3, ts - 6, ts - 6);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  drawHero(ctx, hero, hero.x * ts + ts / 2, hero.y * ts + ts / 2, ts);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** The explored floor map: unexplored tiles are ink-dark. */
export function drawMap(
  ctx: CanvasRenderingContext2D,
  floor: FloorView,
  hero: { x: number; y: number; facing: "up" | "down" | "left" | "right" },
) {
  const { width: cw, height: ch } = ctx.canvas;
  const ts = Math.max(2, Math.floor(Math.min(cw / floor.width, ch / floor.height)));
  const ox = Math.floor((cw - ts * floor.width) / 2);
  const oy = Math.floor((ch - ts * floor.height) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const c = floor.explored[y]?.[x] ?? " ";
      ctx.fillStyle =
        c === " " ? INK.ink : c === "#" ? INK.stone : c === "L" ? INK.lava : INK.floor;
      ctx.fillRect(ox + x * ts, oy + y * ts, ts, ts);
      if (c === "U" || c === "D") {
        ctx.fillStyle = INK.bone;
        ctx.fillRect(ox + x * ts + ts * 0.25, oy + y * ts + ts * 0.25, ts * 0.5, ts * 0.5);
      }
    }
  }
  for (const e of Object.values(floor.entities)) {
    if ((floor.explored[e.y]?.[e.x] ?? " ") === " ") continue;
    drawEntity(ctx, e, ox + e.x * ts, oy + e.y * ts, ts);
  }
  drawHero(ctx, hero, ox + hero.x * ts + ts / 2, oy + hero.y * ts + ts / 2, Math.max(ts, 8));
}
