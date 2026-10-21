/**
 * Engraved figures: Dante (the hero), his shade (the echo), the weeping watchers, and the
 * creatures of each circle. Figures face right and are mirrored when they face left.
 */
import type { Entity, Hero } from "@inferno/shared";
import { facing, glow, hatch, hatchIn, ink, shadow } from "./engrave.js";

const BONE = "rgb(230 217 192";

export function drawHeroArt(
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

// ---------------------------------------------------------------------------------------------
// Dante's shade (the echo)

/** The echo: Dante's shade, a pale violet ghost of his outline that wavers as it breathes. */
function drawShade(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number, t: number) {
  const cx = sx + ts / 2;
  const ground = sy + ts * 0.88;
  const waver = Math.sin(t / 300) * ts * 0.015;
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.15 * Math.sin(t / 300);
  glow(ctx, cx, sy + ts * 0.55, ts * 0.45, "rgba(155,133,214,0.35)");
  const robe = () => {
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.12, sy + ts * 0.4);
    ctx.quadraticCurveTo(cx - ts * 0.2 - waver, sy + ts * 0.62, cx - ts * 0.22, ground);
    // A ragged hem, fading into the floor.
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(cx - ts * 0.22 + (i * ts * 0.44) / 6, ground - (i % 2) * ts * 0.05);
    }
    ctx.quadraticCurveTo(cx + ts * 0.2 + waver, sy + ts * 0.62, cx + ts * 0.12, sy + ts * 0.4);
    ctx.closePath();
  };
  robe();
  ctx.fillStyle = "rgb(120 100 180 / 0.55)";
  ctx.fill();
  hatchIn(
    ctx,
    robe,
    cx - ts * 0.25,
    sy + ts * 0.4,
    ts * 0.5,
    ts * 0.5,
    ts / 14,
    Math.PI / 3,
    "rgb(40 25 80 / 0.4)",
    ts / 90,
    5,
  );
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.3, ts * 0.12, ts * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(150 130 210 / 0.65)";
  ctx.fill();
  ctx.setLineDash([ts / 18, ts / 24]);
  ctx.strokeStyle = `${BONE} / 0.55)`;
  ctx.lineWidth = Math.max(1, ts / 50);
  robe();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.3, ts * 0.12, ts * 0.13, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Hollow eyes
  ctx.fillStyle = "rgb(20 10 40 / 0.8)";
  ctx.fillRect(cx - ts * 0.05, sy + ts * 0.29, ts * 0.03, ts * 0.025);
  ctx.fillRect(cx + ts * 0.02, sy + ts * 0.29, ts * 0.03, ts * 0.025);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Watchers

/**
 * A watcher: a hooded mourner carved in grey stone, face buried in its hands. Its eyes show
 * between the fingers; they follow the hero, and smoulder while it is free to move.
 */
function drawWatcher(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  hero?: { x: number; y: number },
) {
  const s = e.state ?? {};
  const cx = sx + ts / 2;
  const ground = sy + ts * 0.9;
  shadow(ctx, cx, ground, ts * 0.26, 0.45);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.28, ground);
    ctx.quadraticCurveTo(cx - ts * 0.26, sy + ts * 0.5, cx - ts * 0.16, sy + ts * 0.3);
    ctx.quadraticCurveTo(cx, sy + ts * 0.02, cx + ts * 0.16, sy + ts * 0.3);
    ctx.quadraticCurveTo(cx + ts * 0.26, sy + ts * 0.5, cx + ts * 0.28, ground);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = "#8a8074";
  ctx.fill();
  hatchIn(
    ctx,
    body,
    cx,
    sy,
    ts * 0.3,
    ts,
    ts / 16,
    Math.PI / 4,
    "rgb(20 15 10 / 0.5)",
    ts / 85,
    e.x + e.y,
  );
  // Drapery folds
  ctx.strokeStyle = "rgb(30 24 18 / 0.55)";
  ctx.lineWidth = Math.max(1, ts / 60);
  for (const fx of [-0.14, -0.04, 0.07, 0.17]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * fx * 0.6, sy + ts * 0.5);
    ctx.quadraticCurveTo(cx + ts * fx, sy + ts * 0.7, cx + ts * fx * 1.2, ground);
    ctx.stroke();
  }
  ink(ctx, ts);
  body();
  ctx.stroke();
  // The shadowed hollow of the hood.
  ctx.fillStyle = "#2a2420";
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.34, ts * 0.11, ts * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes between the fingers, turned toward the hero.
  const free = s.watched === false;
  let lx = 0,
    ly = 0;
  if (hero) {
    const dx = hero.x - e.x,
      dy = hero.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    lx = (dx / d) * ts * 0.02;
    ly = (dy / d) * ts * 0.012;
  }
  const ember = free ? 0.65 + 0.35 * Math.sin(t / 260 + e.x * 3) : 0;
  if (free) glow(ctx, cx + lx, sy + ts * 0.33, ts * 0.28, `rgba(255,50,30,${0.2 + 0.12 * ember})`);
  ctx.fillStyle = free ? `rgb(255 ${80 + 40 * ember} 40)` : "#141110";
  ctx.fillRect(cx - ts * 0.065 + lx, sy + ts * 0.315 + ly, ts * 0.04, ts * 0.025);
  ctx.fillRect(cx + ts * 0.025 + lx, sy + ts * 0.315 + ly, ts * 0.04, ts * 0.025);
  // Hands raised to the face, covering the mouth and cheeks; fingers spread up to the eyes.
  ctx.fillStyle = "#a49a8c";
  for (const hx of [-1, 1]) {
    const hand = () => {
      ctx.beginPath();
      ctx.moveTo(cx + hx * ts * 0.01, sy + ts * 0.47);
      ctx.quadraticCurveTo(cx + hx * ts * 0.1, sy + ts * 0.46, cx + hx * ts * 0.09, sy + ts * 0.36);
      ctx.lineTo(cx + hx * ts * 0.03, sy + ts * 0.35);
      ctx.closePath();
    };
    hand();
    ctx.fill();
    ink(ctx, ts, 0.6);
    hand();
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(40 32 26 / 0.7)";
  ctx.lineWidth = Math.max(1, ts / 90);
  for (const fx of [-0.075, -0.05, 0.05, 0.075]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * fx, sy + ts * 0.36);
    ctx.lineTo(cx + ts * fx * 0.95, sy + ts * 0.42);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// The creatures of each circle (patrols)

/** The patrol creature for a circle (the floor's index). */
type Creature = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) => void;

const CREATURES: Record<number, Creature> = {
  6: drawCerberus, // Gluttony
  11: drawCentaur, // Phlegethon: Nessus and Pholus
  12: drawHarpy, // the Wood of the Suicides
  15: drawWhipDemon, // the Panderers, lashed on
  18: drawMalebranche, // the Boiling Pitch
  20: drawSerpent, // the Thieves
};

/** A centaur of Phlegethon: a horse's body, a man's torso, a bow drawn. */
function drawCentaur(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const ground = sy + ts * 0.9;
  const trot = Math.sin(t / 220 + seed) * ts * 0.02;
  shadow(ctx, cx, ground, ts * 0.34);
  // Legs
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = ts * 0.045;
  ctx.lineCap = "round";
  for (const [lx, ph] of [
    [-0.24, 0],
    [-0.14, 1],
    [0.1, 1],
    [0.2, 0],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * lx, sy + ts * 0.62);
    ctx.lineTo(cx + ts * lx + (ph ? trot : -trot), ground);
    ctx.stroke();
  }
  // Horse body
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(cx - ts * 0.04, sy + ts * 0.58, ts * 0.27, ts * 0.12, 0, 0, Math.PI * 2);
  };
  body();
  ctx.fillStyle = "#5a3c28";
  ctx.fill();
  hatchIn(
    ctx,
    body,
    cx - ts * 0.3,
    sy + ts * 0.46,
    ts * 0.55,
    ts * 0.24,
    ts / 18,
    Math.PI / 4,
    "rgb(10 5 2 / 0.5)",
    ts / 85,
    seed,
  );
  ink(ctx, ts);
  body();
  ctx.stroke();
  // Tail
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = ts * 0.035;
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.3, sy + ts * 0.54);
  ctx.quadraticCurveTo(cx - ts * 0.44, sy + ts * 0.6, cx - ts * 0.4, sy + ts * 0.76);
  ctx.stroke();
  // Torso rising from the withers
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(cx + ts * 0.08, sy + ts * 0.52);
    ctx.lineTo(cx + ts * 0.1, sy + ts * 0.3);
    ctx.quadraticCurveTo(cx + ts * 0.17, sy + ts * 0.24, cx + ts * 0.24, sy + ts * 0.3);
    ctx.lineTo(cx + ts * 0.24, sy + ts * 0.52);
    ctx.closePath();
  };
  torso();
  ctx.fillStyle = "#c9a882";
  ctx.fill();
  hatchIn(
    ctx,
    torso,
    cx + ts * 0.17,
    sy + ts * 0.24,
    ts * 0.1,
    ts * 0.3,
    ts / 22,
    Math.PI / 3,
    "rgb(60 30 10 / 0.5)",
    ts / 100,
    seed + 1,
  );
  ink(ctx, ts);
  torso();
  ctx.stroke();
  // Head and beard
  ctx.fillStyle = "#c9a882";
  ctx.beginPath();
  ctx.arc(cx + ts * 0.17, sy + ts * 0.19, ts * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
  ctx.fillStyle = "#3a2a1c";
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.13, sy + ts * 0.21);
  ctx.quadraticCurveTo(cx + ts * 0.17, sy + ts * 0.3, cx + ts * 0.22, sy + ts * 0.21);
  ctx.fill();
  // Bow and arrow, drawn forward
  ctx.strokeStyle = "#4a3020";
  ctx.lineWidth = Math.max(1, ts / 35);
  ctx.beginPath();
  ctx.arc(cx + ts * 0.3, sy + ts * 0.35, ts * 0.14, -Math.PI * 0.45, Math.PI * 0.45);
  ctx.stroke();
  ctx.strokeStyle = `${BONE} / 0.7)`;
  ctx.lineWidth = Math.max(1, ts / 90);
  ctx.beginPath();
  ctx.moveTo(
    cx + ts * 0.3 + Math.cos(-Math.PI * 0.45) * ts * 0.14,
    sy + ts * 0.35 + Math.sin(-Math.PI * 0.45) * ts * 0.14,
  );
  ctx.lineTo(cx + ts * 0.2, sy + ts * 0.35);
  ctx.lineTo(
    cx + ts * 0.3 + Math.cos(Math.PI * 0.45) * ts * 0.14,
    sy + ts * 0.35 + Math.sin(Math.PI * 0.45) * ts * 0.14,
  );
  ctx.stroke();
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = Math.max(1, ts / 60);
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.2, sy + ts * 0.35);
  ctx.lineTo(cx + ts * 0.48, sy + ts * 0.35);
  ctx.stroke();
}

/** A harpy of the wood: a bird's body and great wings, a woman's face, cruel talons. */
function drawHarpy(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const hover = Math.sin(t / 260 + seed) * ts * 0.03;
  const flap = Math.sin(t / 160 + seed) * 0.25;
  shadow(ctx, cx, sy + ts * 0.9, ts * 0.22, 0.3);
  const y = sy + ts * 0.5 + hover;
  // Wings, feathered with long hatched strokes
  for (const side of [-1, 1]) {
    const wing = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * ts * 0.05, y - ts * 0.05);
      ctx.quadraticCurveTo(
        cx + side * ts * 0.3,
        y - ts * (0.35 + flap * 0.3),
        cx + side * ts * 0.46,
        y - ts * (0.15 + flap * 0.2),
      );
      ctx.lineTo(cx + side * ts * 0.36, y + ts * 0.04);
      ctx.lineTo(cx + side * ts * 0.28, y - ts * 0.02);
      ctx.lineTo(cx + side * ts * 0.2, y + ts * 0.08);
      ctx.closePath();
    };
    wing();
    ctx.fillStyle = "#3d3a30";
    ctx.fill();
    hatchIn(
      ctx,
      wing,
      cx - ts * 0.5,
      y - ts * 0.45,
      ts,
      ts * 0.6,
      ts / 22,
      side * Math.PI * 0.3,
      "rgb(0 0 0 / 0.55)",
      ts / 100,
      seed + side,
    );
    ink(ctx, ts);
    wing();
    ctx.stroke();
  }
  // Body
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(cx, y + ts * 0.06, ts * 0.11, ts * 0.17, 0, 0, Math.PI * 2);
  };
  body();
  ctx.fillStyle = "#4a4436";
  ctx.fill();
  hatchIn(
    ctx,
    body,
    cx - ts * 0.12,
    y - ts * 0.12,
    ts * 0.24,
    ts * 0.36,
    ts / 20,
    Math.PI / 4,
    "rgb(0 0 0 / 0.5)",
    ts / 90,
    seed,
  );
  ink(ctx, ts);
  body();
  ctx.stroke();
  // Talons
  ctx.strokeStyle = "#1a1410";
  ctx.lineWidth = Math.max(1, ts / 50);
  for (const tx of [-0.05, 0.05]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * tx, y + ts * 0.22);
    ctx.lineTo(cx + ts * tx, y + ts * 0.3);
    ctx.lineTo(cx + ts * (tx - 0.03), y + ts * 0.34);
    ctx.moveTo(cx + ts * tx, y + ts * 0.3);
    ctx.lineTo(cx + ts * (tx + 0.03), y + ts * 0.34);
    ctx.stroke();
  }
  // A woman's pale face with dark hair
  ctx.fillStyle = "#1c1612";
  ctx.beginPath();
  ctx.ellipse(cx, y - ts * 0.16, ts * 0.085, ts * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8c4a4";
  ctx.beginPath();
  ctx.ellipse(cx + ts * 0.01, y - ts * 0.14, ts * 0.055, ts * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts, 0.7);
  ctx.stroke();
  ctx.fillStyle = "#b0301f";
  ctx.fillRect(cx - ts * 0.025, y - ts * 0.155, ts * 0.018, ts * 0.014);
  ctx.fillRect(cx + ts * 0.02, y - ts * 0.155, ts * 0.018, ts * 0.014);
}

/** A horned demon of the first ditch, whip raised to drive the sinners on. */
function drawWhipDemon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  drawDemon(ctx, cx, sy, ts, t, seed, "#7a2418");
  // The whip: a handle, and a lash that curls and cracks.
  const crack = Math.sin(t / 200 + seed);
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = Math.max(1, ts / 30);
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.16, sy + ts * 0.5);
  ctx.lineTo(cx + ts * 0.26, sy + ts * 0.32);
  ctx.stroke();
  ctx.strokeStyle = "#3a2a1c";
  ctx.lineWidth = Math.max(1, ts / 60);
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.26, sy + ts * 0.32);
  ctx.bezierCurveTo(
    cx + ts * 0.42,
    sy + ts * (0.12 + 0.08 * crack),
    cx + ts * 0.5,
    sy + ts * (0.4 - 0.1 * crack),
    cx + ts * 0.38,
    sy + ts * (0.55 + 0.05 * crack),
  );
  ctx.stroke();
}

/** One of the Malebranche, the Evil Claws: winged, crouched, a long grappling hook in hand. */
function drawMalebranche(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const flap = Math.sin(t / 180 + seed) * 0.2;
  // Bat wings behind
  for (const side of [-1, 1]) {
    const wing = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * ts * 0.06, sy + ts * 0.44);
      ctx.lineTo(cx + side * ts * 0.42, sy + ts * (0.2 - flap * 0.15));
      ctx.lineTo(cx + side * ts * 0.36, sy + ts * 0.42);
      ctx.lineTo(cx + side * ts * 0.28, sy + ts * 0.36);
      ctx.lineTo(cx + side * ts * 0.22, sy + ts * 0.5);
      ctx.closePath();
    };
    wing();
    ctx.fillStyle = "#1e1210";
    ctx.fill();
    hatchIn(
      ctx,
      wing,
      cx - ts * 0.45,
      sy + ts * 0.15,
      ts * 0.9,
      ts * 0.4,
      ts / 22,
      side * 0.9,
      "rgb(80 40 30 / 0.45)",
      ts / 100,
      seed,
    );
    ink(ctx, ts);
    wing();
    ctx.stroke();
  }
  drawDemon(ctx, cx, sy, ts, t, seed, "#3a1f18");
  // The hook: a long pole with a barbed iron head.
  ctx.strokeStyle = "#4a3020";
  ctx.lineWidth = Math.max(1, ts / 32);
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.1, sy + ts * 0.86);
  ctx.lineTo(cx + ts * 0.34, sy + ts * 0.14);
  ctx.stroke();
  ctx.strokeStyle = "#8a8074";
  ctx.lineWidth = Math.max(1, ts / 36);
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.34, sy + ts * 0.14);
  ctx.quadraticCurveTo(cx + ts * 0.46, sy + ts * 0.12, cx + ts * 0.44, sy + ts * 0.24);
  ctx.moveTo(cx + ts * 0.34, sy + ts * 0.14);
  ctx.lineTo(cx + ts * 0.31, sy + ts * 0.06);
  ctx.stroke();
}

/** A serpent of the thieves' ditch: coiled on the floor, rising to strike, tongue flickering. */
function drawSerpent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
) {
  const sway = Math.sin(t / 240 + seed) * ts * 0.03;
  shadow(ctx, cx, sy + ts * 0.86, ts * 0.3);
  // Coils: two rings of scaled body.
  for (const [ry, rw] of [
    [0.78, 0.28],
    [0.66, 0.2],
  ] as const) {
    const coil = () => {
      ctx.beginPath();
      ctx.ellipse(cx - ts * 0.04, sy + ts * ry, ts * rw, ts * rw * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(
        cx - ts * 0.04,
        sy + ts * ry,
        ts * (rw - 0.07),
        ts * (rw - 0.07) * 0.32,
        0,
        0,
        Math.PI * 2,
        true,
      );
    };
    coil();
    ctx.fillStyle = "#4f5a2a";
    ctx.fill("evenodd");
    ctx.save();
    coil();
    ctx.clip("evenodd");
    hatch(
      ctx,
      cx - ts * 0.35,
      sy + ts * (ry - 0.15),
      ts * 0.7,
      ts * 0.3,
      ts / 24,
      Math.PI / 4,
      "rgb(10 15 0 / 0.55)",
      ts / 100,
      seed,
    );
    hatch(
      ctx,
      cx - ts * 0.35,
      sy + ts * (ry - 0.15),
      ts * 0.7,
      ts * 0.3,
      ts / 24,
      -Math.PI / 4,
      "rgb(10 15 0 / 0.35)",
      ts / 120,
      seed + 1,
    );
    ctx.restore();
    ink(ctx, ts, 0.8);
    coil();
    ctx.stroke();
  }
  // The neck rising in an S, and the head.
  ctx.strokeStyle = INK_BODY;
  ctx.lineWidth = ts * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.08, sy + ts * 0.64);
  ctx.bezierCurveTo(
    cx + ts * 0.3 + sway,
    sy + ts * 0.55,
    cx - ts * 0.05 + sway,
    sy + ts * 0.38,
    cx + ts * 0.14 + sway,
    sy + ts * 0.26,
  );
  ctx.stroke();
  ctx.strokeStyle = "#4f5a2a";
  ctx.lineWidth = ts * 0.065;
  ctx.stroke();
  const hx = cx + ts * 0.18 + sway,
    hy = sy + ts * 0.24;
  ctx.fillStyle = "#5e6a32";
  ctx.beginPath();
  ctx.ellipse(hx, hy, ts * 0.09, ts * 0.055, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
  ctx.fillStyle = "#e0a020";
  ctx.beginPath();
  ctx.arc(hx + ts * 0.03, hy - ts * 0.012, ts * 0.014, 0, Math.PI * 2);
  ctx.fill();
  // Forked tongue, flickering
  if (Math.sin(t / 120 + seed) > -0.2) {
    ctx.strokeStyle = "#b0301f";
    ctx.lineWidth = Math.max(1, ts / 80);
    ctx.beginPath();
    ctx.moveTo(hx + ts * 0.085, hy + ts * 0.01);
    ctx.lineTo(hx + ts * 0.15, hy + ts * 0.01);
    ctx.lineTo(hx + ts * 0.18, hy - ts * 0.015);
    ctx.moveTo(hx + ts * 0.15, hy + ts * 0.01);
    ctx.lineTo(hx + ts * 0.18, hy + ts * 0.035);
    ctx.stroke();
  }
}

const INK_BODY = "#0b0705";

/** A horned demon: the common devil of the pit, and the base of the whip-bearer and the Claws. */
function drawDemon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sy: number,
  ts: number,
  t: number,
  seed: number,
  skin = "#6a2016",
) {
  const ground = sy + ts * 0.9;
  const bob = Math.sin(t / 200 + seed) * ts * 0.015;
  shadow(ctx, cx, ground, ts * 0.22);
  // Legs, bent like a goat's
  ctx.strokeStyle = skin;
  ctx.lineWidth = ts * 0.07;
  ctx.lineCap = "round";
  for (const lx of [-0.08, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + ts * lx, sy + ts * 0.62);
    ctx.lineTo(cx + ts * lx * 1.6, sy + ts * 0.76);
    ctx.lineTo(cx + ts * lx, ground);
    ctx.stroke();
  }
  // Torso
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.15, sy + ts * 0.64 + bob);
    ctx.quadraticCurveTo(cx - ts * 0.2, sy + ts * 0.4 + bob, cx - ts * 0.08, sy + ts * 0.32 + bob);
    ctx.lineTo(cx + ts * 0.08, sy + ts * 0.32 + bob);
    ctx.quadraticCurveTo(cx + ts * 0.2, sy + ts * 0.4 + bob, cx + ts * 0.15, sy + ts * 0.64 + bob);
    ctx.closePath();
  };
  torso();
  ctx.fillStyle = skin;
  ctx.fill();
  hatchIn(
    ctx,
    torso,
    cx - ts * 0.2,
    sy + ts * 0.3,
    ts * 0.4,
    ts * 0.36,
    ts / 18,
    Math.PI / 4,
    "rgb(0 0 0 / 0.5)",
    ts / 85,
    seed,
  );
  ink(ctx, ts);
  torso();
  ctx.stroke();
  // Head, horns, eyes
  const hy = sy + ts * 0.24 + bob;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, hy, ts * 0.09, ts * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, ts);
  ctx.stroke();
  ctx.fillStyle = "#d8c8a8";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * ts * 0.05, hy - ts * 0.06);
    ctx.quadraticCurveTo(
      cx + side * ts * 0.16,
      hy - ts * 0.12,
      cx + side * ts * 0.13,
      hy - ts * 0.2,
    );
    ctx.quadraticCurveTo(
      cx + side * ts * 0.1,
      hy - ts * 0.11,
      cx + side * ts * 0.02,
      hy - ts * 0.07,
    );
    ctx.fill();
    ink(ctx, ts, 0.6);
    ctx.stroke();
  }
  const ember = 0.7 + 0.3 * Math.sin(t / 170 + seed);
  ctx.fillStyle = `rgb(255 ${120 + 60 * ember} 40)`;
  ctx.fillRect(cx - ts * 0.05, hy - ts * 0.01, ts * 0.03, ts * 0.02);
  ctx.fillRect(cx + ts * 0.02, hy - ts * 0.01, ts * 0.03, ts * 0.02);
}

// ---------------------------------------------------------------------------------------------

/** Draw a figure entity (echo, statue, patrol); false for kinds this module does not draw. */
export function drawFigureArt(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  ts: number,
  t: number,
  hero: { x: number; y: number } | undefined,
  circle: number,
): boolean {
  const s = e.state ?? {};
  const cx = sx + ts / 2;
  switch (e.kind) {
    case "echo":
      drawShade(ctx, sx, sy, ts, t);
      return true;
    case "statue":
      if (s.filled) return false; // a statue that filled a hole is just stone (see things)
      drawWatcher(ctx, e, sx, sy, ts, t, hero);
      return true;
    case "patrol": {
      const creature = CREATURES[circle] ?? drawDemon;
      const left = s.next === "left";
      facing(ctx, cx, left, () => {
        // A size up from the ground, so the creature fills its tile (Cerberus scales himself).
        const k = creature === drawCerberus ? 1 : 1.15;
        const ground = sy + ts * 0.9;
        ctx.translate(cx, ground);
        ctx.scale(k, k);
        ctx.translate(-cx, -ground);
        creature(ctx, cx, sy, ts, t, e.x * 7 + e.y);
      });
      return true;
    }
    default:
      return false;
  }
}
