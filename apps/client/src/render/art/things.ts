/**
 * Engraved things: doors and locks, levers and switches, plates and blocks, vents and traps,
 * mirrors and the flames they turn, altars and vigils, ferries, and the items the crowd carries.
 * Each keeps the state signal the game depends on (open, pressed, lit, about to fire).
 */
import type { Entity } from "@inferno/shared";
import {
  arrow,
  bone,
  DX,
  DY,
  flame,
  glow,
  hatch,
  hatchIn,
  INK,
  ink,
  lockColor,
  noise,
  shadow,
} from "./engrave.js";

const BONE = "rgb(230 217 192";

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

/** An iron door bound for a key: plate and rivets, the lock's colour on its escutcheon. */
function drawLockedDoor(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  lock: string,
  open: boolean,
) {
  const c = lockColor(lock);
  if (open) {
    drawDoorway(ctx, sx, sy, ts);
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, ts / 30);
    ctx.strokeRect(sx + ts * 0.12, sy + ts * 0.5, ts * 0.06, ts * 0.06);
    ctx.globalAlpha = 1;
    return;
  }
  const x0 = sx + ts * 0.08,
    y0 = sy + ts * 0.06,
    w = ts * 0.84,
    h = ts * 0.9;
  const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
  g.addColorStop(0, "#5a5650");
  g.addColorStop(1, "#33302c");
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  hatch(ctx, x0, y0, w, h, ts / 16, Math.PI / 4, "rgb(0 0 0 / 0.35)", ts / 100, 31);
  ctx.restore();
  // Riveted frame
  ctx.fillStyle = "#1a1816";
  for (let i = 0; i < 4; i++)
    for (const yy of [y0 + ts * 0.06, y0 + h - ts * 0.06]) {
      ctx.beginPath();
      ctx.arc(x0 + ts * 0.1 + (i * (w - ts * 0.2)) / 3, yy, ts * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  // Escutcheon in the lock's colour, and the keyhole.
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ts * 0.13, ts * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
  ctx.fillStyle = "#0c0a08";
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.03, ts * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.025, cy - ts * 0.02);
  ctx.lineTo(cx + ts * 0.025, cy - ts * 0.02);
  ctx.lineTo(cx + ts * 0.04, cy + ts * 0.09);
  ctx.lineTo(cx - ts * 0.04, cy + ts * 0.09);
  ctx.fill();
  ink(ctx, ts);
  ctx.strokeRect(x0, y0, w, h);
}

/** A switch: a stone post with a bolt thrown left or right, its gem teal when on, blood when off. */
function drawSwitch(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  on: boolean,
  t: number,
) {
  const cx = sx + ts / 2;
  shadow(ctx, cx, sy + ts * 0.88, ts * 0.2);
  const post = () => {
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.14, sy + ts * 0.88);
    ctx.lineTo(cx - ts * 0.12, sy + ts * 0.26);
    ctx.lineTo(cx + ts * 0.12, sy + ts * 0.26);
    ctx.lineTo(cx + ts * 0.14, sy + ts * 0.88);
    ctx.closePath();
  };
  post();
  ctx.fillStyle = "#5a5046";
  ctx.fill();
  hatchIn(
    ctx,
    post,
    cx,
    sy + ts * 0.26,
    ts * 0.15,
    ts * 0.62,
    ts / 18,
    Math.PI / 4,
    "rgb(10 7 5 / 0.5)",
    ts / 90,
    41,
  );
  ink(ctx, ts);
  post();
  ctx.stroke();
  // The bolt's slot and the bolt.
  ctx.fillStyle = "#14100d";
  ctx.fillRect(cx - ts * 0.1, sy + ts * 0.58, ts * 0.2, ts * 0.05);
  ctx.fillStyle = "#8a847c";
  ctx.fillRect(cx + (on ? 0 : -ts * 0.1), sy + ts * 0.57, ts * 0.1, ts * 0.07);
  ink(ctx, ts, 0.6);
  ctx.strokeRect(cx + (on ? 0 : -ts * 0.1), sy + ts * 0.57, ts * 0.1, ts * 0.07);
  // Gem
  const gem = on ? "#6ec9b4" : "#b0301f";
  glow(ctx, cx, sy + ts * 0.38, ts * 0.22, on ? "rgba(110,201,180,0.45)" : "rgba(176,48,31,0.35)");
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.moveTo(cx, sy + ts * 0.3);
  ctx.lineTo(cx + ts * 0.06, sy + ts * 0.38);
  ctx.lineTo(cx, sy + ts * 0.46);
  ctx.lineTo(cx - ts * 0.06, sy + ts * 0.38);
  ctx.closePath();
  ctx.fill();
  ink(ctx, ts, 0.7);
  ctx.stroke();
  void t;
}

/** A pressure plate: a carved slab with a sigil; pressed, it sinks and the sigil glows. */
function drawPlate(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  pressed: boolean,
  stone: boolean,
) {
  const inset = pressed ? ts * 0.16 : ts * 0.13;
  const x0 = sx + inset,
    y0 = sy + inset,
    w = ts - inset * 2;
  ctx.fillStyle = "#0d0a08";
  ctx.fillRect(sx + ts * 0.11, sy + ts * 0.11, ts * 0.78, ts * 0.78);
  ctx.fillStyle = pressed ? "#4a3e30" : "#5c5044";
  ctx.fillRect(x0, y0, w, w);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, w);
  ctx.clip();
  hatch(ctx, x0, y0, w, w, ts / 15, Math.PI / 4, "rgb(10 7 5 / 0.35)", ts / 100, 51);
  ctx.restore();
  // Lit upper edge unless sunk
  if (!pressed) {
    ctx.fillStyle = bone(0.18);
    ctx.fillRect(x0, y0, w, Math.max(1, ts / 50));
  }
  ink(ctx, ts);
  ctx.strokeRect(x0, y0, w, w);
  // Sigil: a ring and a cross, cut into the stone
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  if (pressed) glow(ctx, cx, cy, ts * 0.4, "rgba(217,138,54,0.45)");
  ctx.strokeStyle = pressed ? "#f0b060" : "rgb(20 14 10 / 0.8)";
  ctx.lineWidth = Math.max(1, ts / 40);
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.26, 0, Math.PI * 2);
  ctx.moveTo(cx - w * 0.36, cy);
  ctx.lineTo(cx + w * 0.36, cy);
  ctx.moveTo(cx, cy - w * 0.36);
  ctx.lineTo(cx, cy + w * 0.36);
  ctx.stroke();
  if (stone) drawWeight(ctx, cx, cy, ts * 0.9);
}

/** A hewn block of stone: lit top, hatched sides. Pushed into a hole, it lies flush. */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  filled: boolean,
) {
  if (filled) {
    // Flush with the floor: a square stone set into the hole, its seams showing.
    ctx.fillStyle = "#4d453e";
    ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx + 1, sy + 1, ts - 2, ts - 2);
    ctx.clip();
    hatch(ctx, sx, sy, ts, ts, ts / 12, Math.PI / 4, "rgb(10 7 5 / 0.35)", ts / 90, 61);
    ctx.restore();
    ctx.strokeStyle = "rgb(0 0 0 / 0.55)";
    ctx.lineWidth = Math.max(1, ts / 40);
    ctx.strokeRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
    return;
  }
  const x0 = sx + ts * 0.08,
    y0 = sy + ts * 0.1,
    w = ts * 0.84,
    top = ts * 0.6,
    face = ts * 0.22;
  shadow(ctx, sx + ts / 2, y0 + top + face, ts * 0.42, 0.4);
  // Face (front, in shadow)
  ctx.fillStyle = "#3a332d";
  ctx.fillRect(x0, y0 + top, w, face);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0 + top, w, face);
  ctx.clip();
  hatch(ctx, x0, y0 + top, w, face, ts / 16, Math.PI / 2, "rgb(5 3 2 / 0.55)", ts / 90, 62);
  hatch(ctx, x0, y0 + top, w, face, ts / 16, 0, "rgb(5 3 2 / 0.35)", ts / 110, 63);
  ctx.restore();
  // Top (lit)
  ctx.fillStyle = "#8a8074";
  ctx.fillRect(x0, y0, w, top);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, top);
  ctx.clip();
  hatch(ctx, x0, y0, w, top, ts / 12, Math.PI / 4, "rgb(10 7 5 / 0.3)", ts / 100, 64);
  ctx.restore();
  ctx.fillStyle = bone(0.25);
  ctx.fillRect(x0, y0, w, Math.max(1, ts / 45));
  ink(ctx, ts);
  ctx.strokeRect(x0, y0, w, top + face);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + top);
  ctx.lineTo(x0 + w, y0 + top);
  ctx.stroke();
}

/** A fire vent: an iron grate over a pit of coals. About to fire, heat breathes up and embers rise. */
function drawVent(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
) {
  const s = e.state ?? {};
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  ctx.fillStyle = "#120a07";
  ctx.fillRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
  if (s.next && !s.up) {
    const heat = 0.5 + 0.5 * Math.sin(t / 240 + e.x * 1.7);
    const g = ctx.createRadialGradient(cx, cy + ts * 0.1, 0, cx, cy, ts * 0.42);
    g.addColorStop(0, `rgba(255,110,30,${0.3 + 0.15 * heat})`);
    g.addColorStop(1, "rgba(255,110,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
    ctx.fillStyle = "rgba(255,190,110,0.85)";
    for (let i = 0; i < 3; i++) {
      const phase = (t / 1400 + noise(e.x, e.y, i)) % 1;
      ctx.globalAlpha = 1 - phase;
      ctx.fillRect(
        sx + ts * (0.25 + 0.5 * noise(e.y, e.x, i)),
        sy + ts * (0.8 - 0.6 * phase),
        Math.max(1, ts * 0.035),
        Math.max(1, ts * 0.035),
      );
    }
    ctx.globalAlpha = 1;
  } else if (!s.up) {
    // Dull coals far below.
    ctx.fillStyle = "rgb(120 30 10 / 0.35)";
    for (let i = 0; i < 4; i++)
      ctx.fillRect(
        sx + ts * (0.2 + 0.15 * i),
        sy + ts * (0.6 + 0.1 * noise(e.x, i)),
        ts * 0.06,
        ts * 0.04,
      );
  }
  // The grate: iron bars, riveted to a frame.
  ctx.strokeStyle = s.up ? "#5a3020" : "#4a443e";
  ctx.lineWidth = ts * 0.05;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + ts * (0.21 + i * 0.193), sy + ts * 0.12);
    ctx.lineTo(sx + ts * (0.21 + i * 0.193), sy + ts * 0.88);
    ctx.stroke();
  }
  ink(ctx, ts);
  ctx.strokeRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
  ctx.fillStyle = "#1a1714";
  for (const [rx, ry] of [
    [0.14, 0.14],
    [0.86, 0.14],
    [0.14, 0.86],
    [0.86, 0.86],
  ] as const) {
    ctx.beginPath();
    ctx.arc(sx + ts * rx, sy + ts * ry, ts * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.up) {
    glow(ctx, cx, cy, ts * 0.8, "rgba(255,90,20,0.5)");
    flame(ctx, cx - ts * 0.18, sy + ts * 0.86, ts * 0.3, t, e.x);
    flame(ctx, cx + ts * 0.16, sy + ts * 0.86, ts * 0.34, t, e.y + 2);
    flame(ctx, cx, sy + ts * 0.9, ts * 0.22, t, e.x + e.y + 5);
  }
}

/** A crack in the floor: a dark fissure with broken lips, hatched into its depth. */
function drawCrack(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number) {
  const path = [
    [0.16, 0.3],
    [0.32, 0.4],
    [0.44, 0.5],
    [0.38, 0.72],
    [0.44, 0.5],
    [0.62, 0.44],
    [0.76, 0.42],
    [0.84, 0.62],
  ];
  ctx.strokeStyle = "rgb(5 3 2 / 0.9)";
  ctx.lineWidth = Math.max(1.2, ts / 22);
  ctx.lineJoin = "round";
  ctx.beginPath();
  path.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(sx + ts * x!, sy + ts * y!) : ctx.lineTo(sx + ts * x!, sy + ts * y!),
  );
  ctx.stroke();
  ctx.strokeStyle = bone(0.18);
  ctx.lineWidth = Math.max(1, ts / 70);
  ctx.beginPath();
  path.forEach(([x, y], i) =>
    i === 0
      ? ctx.moveTo(sx + ts * x!, sy + ts * y! + ts * 0.025)
      : ctx.lineTo(sx + ts * x!, sy + ts * y! + ts * 0.025),
  );
  ctx.stroke();
}

/** A hole: a black pit with a ragged, hatched rim. Falls glow violet below; burns, ember red. */
function drawHole(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  depth: "fall" | "burn",
  t: number,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  const rim = () => {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = ts * (0.38 + 0.05 * noise(Math.round(sx), i));
      const x = cx + Math.cos(a) * r,
        y = cy + Math.sin(a) * r * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  rim();
  ctx.fillStyle = "#050202";
  ctx.fill();
  const pulse = 0.5 + 0.5 * Math.sin(t / 600);
  ctx.save();
  rim();
  ctx.clip();
  glow(
    ctx,
    cx,
    cy + ts * 0.1,
    ts * 0.34,
    depth === "fall"
      ? `rgba(120,90,200,${0.35 + 0.15 * pulse})`
      : `rgba(180,40,20,${0.4 + 0.15 * pulse})`,
  );
  // The inner wall, hatched into the dark.
  hatch(
    ctx,
    cx - ts * 0.4,
    cy - ts * 0.4,
    ts * 0.8,
    ts * 0.35,
    ts / 18,
    Math.PI / 2,
    "rgb(60 50 40 / 0.5)",
    ts / 90,
    71,
  );
  ctx.restore();
  ctx.strokeStyle = bone(0.3);
  ctx.lineWidth = Math.max(1, ts / 45);
  rim();
  ctx.stroke();
}

/** A crumbling ledge: a slab split by cracks; stood on, the cracks glow; collapsed, a hole. */
function drawCrumble(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  stood: boolean,
  collapsed: boolean,
  t: number,
) {
  if (collapsed) {
    drawHole(ctx, sx, sy, ts, "burn", t);
    // Broken edges of the slab around the hole
    ctx.fillStyle = "#3a322b";
    for (const [x, y, w, h] of [
      [0.06, 0.06, 0.2, 0.1],
      [0.72, 0.8, 0.22, 0.12],
      [0.8, 0.1, 0.12, 0.18],
    ] as const) {
      ctx.fillRect(sx + ts * x, sy + ts * y, ts * w, ts * h);
      ink(ctx, ts, 0.6);
      ctx.strokeRect(sx + ts * x, sy + ts * y, ts * w, ts * h);
    }
    return;
  }
  ctx.strokeStyle = stood ? "#f0a04a" : "rgb(5 3 2 / 0.85)";
  ctx.lineWidth = Math.max(1.2, ts / 22);
  if (stood) glow(ctx, sx + ts / 2, sy + ts / 2, ts * 0.5, "rgba(217,138,54,0.3)");
  ctx.beginPath();
  ctx.moveTo(sx + ts * 0.08, sy + ts * 0.5);
  ctx.lineTo(sx + ts * 0.5, sy + ts * 0.44);
  ctx.lineTo(sx + ts * 0.92, sy + ts * 0.56);
  ctx.moveTo(sx + ts * 0.5, sy + ts * 0.08);
  ctx.lineTo(sx + ts * 0.46, sy + ts * 0.44);
  ctx.lineTo(sx + ts * 0.52, sy + ts * 0.92);
  ctx.moveTo(sx + ts * 0.18, sy + ts * 0.14);
  ctx.lineTo(sx + ts * 0.34, sy + ts * 0.34);
  ctx.moveTo(sx + ts * 0.66, sy + ts * 0.74);
  ctx.lineTo(sx + ts * 0.86, sy + ts * 0.88);
  ctx.stroke();
}

/** A portal: a ring of carved stone, a slow spiral turning inside it. */
function drawPortal(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number, t: number) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  glow(ctx, cx, cy, ts * 0.5, "rgba(120,90,255,0.3)");
  ctx.fillStyle = "#0a0712";
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // The spiral
  const a0 = t / 700;
  ctx.lineCap = "round";
  for (let arm = 0; arm < 2; arm++) {
    ctx.strokeStyle = arm ? "#6e9784" : "#9b85d6";
    ctx.lineWidth = Math.max(1, ts / 40);
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      const a = a0 + arm * Math.PI + f * Math.PI * 3;
      const r = ts * 0.3 * (1 - f);
      const x = cx + Math.cos(a) * r,
        y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Ring stones
  ctx.strokeStyle = "#5a5046";
  ctx.lineWidth = ts * 0.07;
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.37, 0, Math.PI * 2);
  ctx.stroke();
  ink(ctx, ts, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * ts * 0.335, cy + Math.sin(a) * ts * 0.335);
    ctx.lineTo(cx + Math.cos(a) * ts * 0.405, cy + Math.sin(a) * ts * 0.405);
    ctx.stroke();
  }
}

/** A one-way tile: chevrons cut and gilded into the floor, pointing the only way through. */
function drawOneway(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  dir: string,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  for (const off of [-0.18, 0.12]) {
    arrow(
      ctx,
      cx + DX(dir) * ts * off + 1,
      cy + DY(dir) * ts * off + 1,
      dir,
      ts * 0.17,
      "rgb(0 0 0 / 0.6)",
    );
    arrow(
      ctx,
      cx + DX(dir) * ts * off,
      cy + DY(dir) * ts * off,
      dir,
      ts * 0.17,
      "rgb(212 169 78 / 0.85)",
    );
  }
}

/** A flame's source: a carved demon's mouth in a stone boss, breathing fire the way it faces. */
function drawEmitter(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  dir: string,
  firing: boolean,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  if (firing) glow(ctx, cx, cy, ts * 0.6, "rgba(255,80,20,0.4)");
  const boss = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2);
  };
  boss();
  ctx.fillStyle = "#4d443c";
  ctx.fill();
  hatchIn(
    ctx,
    boss,
    cx,
    cy - ts * 0.36,
    ts * 0.36,
    ts * 0.72,
    ts / 16,
    Math.PI / 4,
    "rgb(10 7 5 / 0.5)",
    ts / 90,
    81,
  );
  ink(ctx, ts);
  boss();
  ctx.stroke();
  // Brow and eyes, turned the way it breathes
  const mx = cx + DX(dir) * ts * 0.14,
    my = cy + DY(dir) * ts * 0.14;
  ctx.fillStyle = firing ? "#ffb060" : "#20160f";
  ctx.beginPath();
  ctx.arc(mx, my, ts * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts, 0.8);
  ctx.stroke();
  ctx.fillStyle = firing ? "#ffe0a0" : "#0c0806";
  const px = -DY(dir),
    py = DX(dir);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      cx - DX(dir) * ts * 0.12 + px * side * ts * 0.12,
      cy - DY(dir) * ts * 0.12 + py * side * ts * 0.12,
      ts * 0.035,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/** A mirror: a bronze plate on a pivot, set at a slant to turn the flames. */
function drawMirror(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  slant: string,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  // Pivot stand
  ctx.fillStyle = "#3a332d";
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts, 0.8);
  ctx.stroke();
  // The plate, edge-on along its slant
  const [ax, ay, bx, by] = slant === "/" ? [0.14, 0.86, 0.86, 0.14] : [0.14, 0.14, 0.86, 0.86];
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = ts * 0.13;
  ctx.beginPath();
  ctx.moveTo(sx + ts * ax, sy + ts * ay);
  ctx.lineTo(sx + ts * bx, sy + ts * by);
  ctx.stroke();
  const g = ctx.createLinearGradient(sx + ts * ax, sy + ts * ay, sx + ts * bx, sy + ts * by);
  g.addColorStop(0, "#8a5a2a");
  g.addColorStop(0.5, "#e8c488");
  g.addColorStop(1, "#8a5a2a");
  ctx.strokeStyle = g;
  ctx.lineWidth = ts * 0.08;
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 250 230 / 0.8)";
  ctx.lineWidth = Math.max(1, ts / 70);
  ctx.beginPath();
  ctx.moveTo(sx + ts * (ax + (bx - ax) * 0.3), sy + ts * (ay + (by - ay) * 0.3));
  ctx.lineTo(sx + ts * (ax + (bx - ax) * 0.55), sy + ts * (ay + (by - ay) * 0.55));
  ctx.stroke();
}

/** A receiver: an eye carved in a stone lozenge; when the flame strikes it, it opens and burns gold. */
function drawReceiver(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  lit: boolean,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  if (lit) glow(ctx, cx, cy, ts * 0.7, "rgba(255,200,80,0.5)");
  const stone = () => {
    ctx.beginPath();
    ctx.moveTo(cx, sy + ts * 0.08);
    ctx.lineTo(sx + ts * 0.82, cy);
    ctx.lineTo(cx, sy + ts * 0.92);
    ctx.lineTo(sx + ts * 0.18, cy);
    ctx.closePath();
  };
  stone();
  ctx.fillStyle = "#5a5046";
  ctx.fill();
  hatchIn(ctx, stone, cx, sy, ts * 0.4, ts, ts / 16, Math.PI / 4, "rgb(10 7 5 / 0.5)", ts / 90, 91);
  ink(ctx, ts);
  stone();
  ctx.stroke();
  // The eye
  ctx.fillStyle = lit ? "#ffd27a" : "#2a2420";
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.2, cy);
  ctx.quadraticCurveTo(cx, cy - (lit ? ts * 0.16 : ts * 0.05), cx + ts * 0.2, cy);
  ctx.quadraticCurveTo(cx, cy + (lit ? ts * 0.16 : ts * 0.05), cx - ts * 0.2, cy);
  ctx.fill();
  ink(ctx, ts, 0.8);
  ctx.stroke();
  if (lit) {
    ctx.fillStyle = "#3a1a08";
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** An altar: a stone table with its share of the crowd carved on the front; when won, it burns. */
function drawAltar(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  done: boolean,
  threshold: number,
  t: number,
) {
  const cx = sx + ts / 2;
  shadow(ctx, cx, sy + ts * 0.9, ts * 0.38);
  const body = () => {
    ctx.beginPath();
    ctx.rect(sx + ts * 0.14, sy + ts * 0.46, ts * 0.72, ts * 0.42);
  };
  body();
  ctx.fillStyle = "#4d453e";
  ctx.fill();
  hatchIn(
    ctx,
    body,
    sx + ts * 0.5,
    sy + ts * 0.46,
    ts * 0.36,
    ts * 0.42,
    ts / 16,
    Math.PI / 4,
    "rgb(10 7 5 / 0.5)",
    ts / 90,
    101,
  );
  ink(ctx, ts);
  body();
  ctx.stroke();
  // Table top
  ctx.fillStyle = "#8a8074";
  ctx.fillRect(sx + ts * 0.06, sy + ts * 0.38, ts * 0.88, ts * 0.1);
  ink(ctx, ts);
  ctx.strokeRect(sx + ts * 0.06, sy + ts * 0.38, ts * 0.88, ts * 0.1);
  if (done) {
    glow(ctx, cx, sy + ts * 0.3, ts * 0.6, "rgba(232,194,90,0.5)");
    flame(ctx, cx, sy + ts * 0.38, ts * 0.25, t);
  } else {
    // An unlit offering bowl
    ctx.fillStyle = "#2a2420";
    ctx.beginPath();
    ctx.ellipse(cx, sy + ts * 0.37, ts * 0.14, ts * 0.05, 0, 0, Math.PI);
    ctx.fill();
  }
  // The share needed, carved in the front.
  ctx.fillStyle = bone(0.85);
  ctx.font = `700 ${Math.round(ts * 0.2)}px "Alegreya Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(threshold * 100)}%`, cx, sy + ts * 0.68);
}

/** A vigil: a ring of candles; one is lit for each turn the crowd keeps watch. */
function drawVigil(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  turns: number,
  count: number,
  done: boolean,
  t: number,
) {
  const cx = sx + ts / 2,
    cy = sy + ts / 2;
  // A worn stone disc
  ctx.fillStyle = done ? "#5a4a30" : "#3a332d";
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts, 0.8);
  ctx.stroke();
  for (let i = 0; i < turns; i++) {
    const a = -Math.PI / 2 + (i / turns) * Math.PI * 2;
    const x = cx + Math.cos(a) * ts * 0.27,
      y = cy + Math.sin(a) * ts * 0.27;
    ctx.fillStyle = "#d8c8a8";
    ctx.fillRect(x - ts * 0.025, y - ts * 0.02, ts * 0.05, ts * 0.08);
    ink(ctx, ts, 0.5);
    ctx.strokeRect(x - ts * 0.025, y - ts * 0.02, ts * 0.05, ts * 0.08);
    if (done || i < count) {
      glow(ctx, x, y - ts * 0.04, ts * 0.12, "rgba(255,170,60,0.5)");
      flame(ctx, x, y - ts * 0.02, ts * 0.06, t, i);
    }
  }
}

/** A brazier: an iron bowl on three legs, a fire in it. */
function drawBrazier(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const cx = sx + ts / 2;
  glow(ctx, cx, sy + ts * 0.5, ts * 0.9, "rgba(255,140,40,0.35)");
  shadow(ctx, cx, sy + ts * 0.9, ts * 0.2);
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = Math.max(1, ts / 30);
  for (const lx of [-0.14, 0, 0.14]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * lx * 0.5, sy + ts * 0.62);
    ctx.lineTo(cx + ts * lx, sy + ts * 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = "#4a443e";
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.2, sy + ts * 0.5);
  ctx.quadraticCurveTo(cx, sy + ts * 0.72, cx + ts * 0.2, sy + ts * 0.5);
  ctx.closePath();
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
  flame(ctx, cx, sy + ts * 0.52, ts * 0.22, t, seed);
}

/** A ferry: a raft of planks lashed with rope, its heading painted in pale lime. */
function drawFerry(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  dir: string | undefined,
) {
  ctx.fillStyle = "#2a1a10";
  ctx.fillRect(sx + ts * 0.04, sy + ts * 0.14, ts * 0.92, ts * 0.76);
  for (let i = 0; i < 4; i++) {
    const y = sy + ts * (0.16 + i * 0.18);
    ctx.fillStyle = i % 2 ? "#5a4030" : "#644834";
    ctx.fillRect(sx + ts * 0.06, y, ts * 0.88, ts * 0.16);
    ctx.strokeStyle = "rgb(20 10 4 / 0.5)";
    ctx.lineWidth = Math.max(1, ts / 110);
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.06, y + ts * (0.04 + g * 0.045));
      ctx.lineTo(sx + ts * 0.94, y + ts * (0.05 + g * 0.04));
      ctx.stroke();
    }
    ink(ctx, ts, 0.6);
    ctx.strokeRect(sx + ts * 0.06, y, ts * 0.88, ts * 0.16);
  }
  // Rope lashings
  ctx.strokeStyle = "#a08a60";
  ctx.lineWidth = Math.max(1, ts / 40);
  for (const lx of [0.2, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(sx + ts * lx, sy + ts * 0.14);
    ctx.lineTo(sx + ts * lx, sy + ts * 0.9);
    ctx.stroke();
  }
  if (dir) arrow(ctx, sx + ts / 2, sy + ts / 2, dir, ts * 0.13, bone(0.75));
}

/** A laid plank: boards bridging lava or a hole. */
function drawBridge(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number) {
  for (let i = 0; i < 4; i++) {
    const x = sx + ts * (0.04 + i * 0.24);
    ctx.fillStyle = i % 2 ? "#5a4030" : "#6a4c36";
    ctx.fillRect(x, sy + ts * 0.02, ts * 0.2, ts * 0.96);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, sy, ts * 0.2, ts);
    ctx.clip();
    hatch(ctx, x, sy, ts * 0.2, ts, ts / 14, Math.PI / 2, "rgb(20 10 4 / 0.35)", ts / 110, i);
    ctx.restore();
    ink(ctx, ts, 0.6);
    ctx.strokeRect(x, sy + ts * 0.02, ts * 0.2, ts * 0.96);
  }
}

// ---------------------------------------------------------------------------------------------
// Items

/** The weight stone: a rounded river stone, chisel-marked. */
function drawWeight(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number) {
  const r = ts * 0.22;
  const stone = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy + ts * 0.04, r, r * 0.85, 0, 0, Math.PI * 2);
  };
  stone();
  ctx.fillStyle = "#8a8074";
  ctx.fill();
  hatchIn(
    ctx,
    stone,
    cx,
    cy - r,
    r,
    r * 2,
    ts / 18,
    Math.PI / 4,
    "rgb(10 7 5 / 0.45)",
    ts / 100,
    111,
  );
  ink(ctx, ts);
  stone();
  ctx.stroke();
  ctx.fillStyle = bone(0.3);
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.25, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw an item lying on the floor (or in the inventory). */
export function drawItemArt(
  ctx: CanvasRenderingContext2D,
  type: string,
  cx: number,
  cy: number,
  ts: number,
  t: number,
  opens = "",
) {
  glow(ctx, cx, cy, ts * 0.45, "rgba(232,194,90,0.18)");
  shadow(ctx, cx, cy + ts * 0.3, ts * 0.2, 0.3);
  switch (type) {
    case "key": {
      // An iron key, its bow wrapped in the lock's colour.
      const c = lockColor(opens);
      ctx.strokeStyle = INK;
      ctx.lineWidth = ts * 0.08;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.04, cy);
      ctx.lineTo(cx + ts * 0.3, cy);
      ctx.moveTo(cx + ts * 0.2, cy);
      ctx.lineTo(cx + ts * 0.2, cy + ts * 0.1);
      ctx.moveTo(cx + ts * 0.28, cy);
      ctx.lineTo(cx + ts * 0.28, cy + ts * 0.12);
      ctx.stroke();
      ctx.strokeStyle = "#8a847c";
      ctx.lineWidth = ts * 0.045;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ts * 0.09;
      ctx.beginPath();
      ctx.arc(cx - ts * 0.15, cy, ts * 0.11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = ts * 0.055;
      ctx.stroke();
      return;
    }
    case "torch": {
      ctx.fillStyle = "#5a4030";
      ctx.fillRect(cx - ts * 0.04, cy - ts * 0.02, ts * 0.08, ts * 0.34);
      ink(ctx, ts, 0.7);
      ctx.strokeRect(cx - ts * 0.04, cy - ts * 0.02, ts * 0.08, ts * 0.34);
      ctx.fillStyle = "#3a2a1c";
      ctx.fillRect(cx - ts * 0.07, cy - ts * 0.06, ts * 0.14, ts * 0.07);
      flame(ctx, cx, cy - ts * 0.04, ts * 0.18, t);
      return;
    }
    case "weight":
      drawWeight(ctx, cx, cy, ts);
      return;
    case "plank": {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.5);
      ctx.fillStyle = "#6a4c36";
      ctx.fillRect(-ts * 0.36, -ts * 0.09, ts * 0.72, ts * 0.18);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-ts * 0.36, -ts * 0.09, ts * 0.72, ts * 0.18);
      ctx.clip();
      hatch(
        ctx,
        -ts * 0.36,
        -ts * 0.09,
        ts * 0.72,
        ts * 0.18,
        ts / 20,
        0,
        "rgb(20 10 4 / 0.4)",
        ts / 110,
        121,
      );
      ctx.restore();
      ink(ctx, ts);
      ctx.strokeRect(-ts * 0.36, -ts * 0.09, ts * 0.72, ts * 0.18);
      ctx.restore();
      return;
    }
    case "hourglass": {
      // Brass frame, glass bulbs, the last sand falling.
      ctx.fillStyle = "rgb(200 220 230 / 0.25)";
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.15, cy - ts * 0.24);
      ctx.lineTo(cx + ts * 0.15, cy - ts * 0.24);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + ts * 0.15, cy + ts * 0.24);
      ctx.lineTo(cx - ts * 0.15, cy + ts * 0.24);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d98a36";
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.1, cy + ts * 0.22);
      ctx.lineTo(cx + ts * 0.1, cy + ts * 0.22);
      ctx.lineTo(cx, cy + ts * 0.08);
      ctx.fill();
      ctx.fillRect(cx - ts * 0.008, cy, ts * 0.016, ts * 0.12);
      ink(ctx, ts, 0.8);
      ctx.stroke();
      ctx.strokeStyle = "#b08a4a";
      ctx.lineWidth = ts * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.2, cy - ts * 0.27);
      ctx.lineTo(cx + ts * 0.2, cy - ts * 0.27);
      ctx.moveTo(cx - ts * 0.2, cy + ts * 0.27);
      ctx.lineTo(cx + ts * 0.2, cy + ts * 0.27);
      ctx.stroke();
      return;
    }
    default:
      ctx.fillStyle = bone(0.9);
      ctx.fillRect(cx - ts * 0.1, cy - ts * 0.1, ts * 0.2, ts * 0.2);
  }
}

// ---------------------------------------------------------------------------------------------

/** Draw a thing; false for kinds this module does not draw. */
export function drawThingArt(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
): boolean {
  const s = e.state ?? {};
  switch (e.kind) {
    case "sign":
      drawTablet(ctx, sx, sy, ts, e.x * 31 + e.y);
      return true;
    case "door":
      if (s.open) drawDoorway(ctx, sx, sy, ts);
      else drawDoor(ctx, sx, sy, ts, s.inverted === true);
      return true;
    case "locked_door":
      drawLockedDoor(ctx, sx, sy, ts, String(s.lock ?? ""), s.open === true);
      return true;
    case "lever":
      drawLever(ctx, sx, sy, ts, s.pulled === true);
      return true;
    case "switch":
      drawSwitch(ctx, sx, sy, ts, s.on === true, t);
      return true;
    case "plate":
      drawPlate(ctx, sx, sy, ts, s.pressed === true, Boolean(s.stone));
      return true;
    case "block":
    case "statue": // a statue only reaches here once it has filled a hole
      drawBlock(ctx, sx, sy, ts, s.filled === true);
      return true;
    case "vent":
      drawVent(ctx, e, sx, sy, ts, t);
      return true;
    case "crack":
      drawCrack(ctx, sx, sy, ts);
      return true;
    case "trap":
      drawHole(ctx, sx, sy, ts, s.effect === "fall" ? "fall" : "burn", t);
      return true;
    case "pit":
      drawHole(ctx, sx, sy, ts, "fall", t);
      return true;
    case "crumble":
      drawCrumble(ctx, sx, sy, ts, s.stood === true, s.collapsed === true, t);
      return true;
    case "portal":
      drawPortal(ctx, sx, sy, ts, t);
      return true;
    case "oneway":
      drawOneway(ctx, sx, sy, ts, String(s.dir));
      return true;
    case "beam":
      drawEmitter(ctx, sx, sy, ts, String(s.dir), s.firing === true);
      return true;
    case "mirror":
      drawMirror(ctx, sx, sy, ts, String(s.slant));
      return true;
    case "receiver":
      drawReceiver(ctx, sx, sy, ts, s.lit === true || s.done === true);
      return true;
    case "altar":
      drawAltar(ctx, sx, sy, ts, s.done === true, Number(s.threshold ?? 0.75), t);
      return true;
    case "vigil":
      drawVigil(ctx, sx, sy, ts, Number(s.turns ?? 5), Number(s.count ?? 0), s.done === true, t);
      return true;
    case "light":
      drawBrazier(ctx, sx, sy, ts, t, e.x * 3 + e.y);
      return true;
    case "platform":
      drawFerry(ctx, sx, sy, ts, typeof s.dir === "string" ? s.dir : undefined);
      return true;
    case "bridge":
      drawBridge(ctx, sx, sy, ts);
      return true;
    case "item":
      drawItemArt(ctx, String(s.item), sx + ts / 2, sy + ts / 2, ts, t, String(s.opens ?? ""));
      return true;
    default:
      return false;
  }
}
