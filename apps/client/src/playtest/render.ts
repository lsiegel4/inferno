/**
 * Canvas renderer for floors as clients see them (protocol FloorState: unrevealed tiles are " ",
 * hidden entities absent, disguised ones under their disguise). Everything is drawn with vector
 * shapes so it scales to any tile size.
 */
import type { Entity, FloorState, Hero } from "@inferno/shared";

export const PALETTE = {
  void: "#050303",
  wallTop: "#3d2f29",
  wallFace: "#170f0c",
  wallEdge: "#54423a",
  floorA: "#221a16",
  floorB: "#1f1714",
  grout: "#110b09",
  lavaDeep: "#7a1606",
  lava: "#d9420f",
  lavaHot: "#ffb03a",
  ice: "#9cc6d9",
  iceDeep: "#5f8fa8",
  ember: "#f0a23b",
  bone: "#eadcc6",
  blood: "#a3121c",
  wood: "#5a3f2a",
  woodDark: "#3a2717",
  iron: "#6b6560",
  stone: "#8a8178",
  stoneDark: "#4d4641",
  violet: "#a77cff",
  teal: "#3fd1c2",
  gold: "#e8c25a",
};

export interface Light {
  x: number;
  y: number;
  radius: number;
}

export interface SceneView {
  floor: FloorState;
  hero: Hero;
  /** Tiles seen before (explored map): terrain characters, drawn dimmed when not lit. */
  remembered: Map<string, string>;
  /** Light sources for the falloff shading; null on fully lit (viewport) floors. */
  lights: Light[] | null;
  /** Extra entities to outline (designer x-ray: hidden traps etc.). */
  xray: Entity[];
  /** Camera top-left in tiles (may be fractional). */
  camX: number;
  camY: number;
  tile: number;
  time: number;
  /** 0..1: a red flash after a death. */
  hurt: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Deterministic per-tile noise in [0, 1). */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

  const brightness = (x: number, y: number): number => {
    if (!v.lights) return 1;
    let b = 0;
    for (const l of v.lights) {
      const d = Math.hypot(x - l.x, y - l.y);
      const r = l.radius + 0.75;
      if (d <= r) b = Math.max(b, Math.pow(1 - d / (r + 0.5), 0.6));
    }
    return Math.max(0.42, Math.min(1, b + 0.25));
  };

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
      const shade = seen ? 1 - brightness(x, y) : 0.78;
      if (shade > 0) {
        ctx.fillStyle = seen ? `rgba(5,3,3,${shade})` : `rgba(8,6,10,${shade})`;
        ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      }
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
    drawEntity(ctx, e, px(e.x), py(e.y), ts, v.time);
  }
  for (const e of v.xray) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,60,60,0.9)";
    ctx.setLineDash([ts / 8, ts / 10]);
    ctx.lineWidth = Math.max(1, ts / 20);
    ctx.strokeRect(px(e.x) + ts * 0.1, py(e.y) + ts * 0.1, ts * 0.8, ts * 0.8);
    ctx.restore();
  }

  drawHero(ctx, v.hero, px(v.hero.x), py(v.hero.y), ts, v.time);

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
  switch (ch) {
    case "#": {
      ctx.fillStyle = PALETTE.wallFace;
      ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      const below = at(x, y + 1);
      const open = below !== undefined && below !== "#";
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(sx, sy, ts + 0.5, open ? ts * 0.66 : ts + 0.5);
      ctx.fillStyle = "rgba(255,220,180,0.06)";
      ctx.fillRect(sx, sy, ts + 0.5, Math.max(1, ts * 0.06));
      // Stone courses
      ctx.fillStyle = PALETTE.wallEdge;
      const n = hash(x, y);
      ctx.fillRect(sx + ts * (0.1 + n * 0.3), sy + ts * 0.3, ts * 0.35, Math.max(1, ts * 0.05));
      ctx.fillRect(sx + ts * 0.05, sy + ts * 0.62, ts * (0.2 + n * 0.4), Math.max(1, ts * 0.04));
      if (open) {
        ctx.fillStyle = "rgba(240,162,59,0.08)";
        ctx.fillRect(sx, sy + ts * 0.66, ts + 0.5, ts * 0.34);
      }
      return;
    }
    case "L": {
      const flow = Math.sin(t / 700 + x * 0.9 + y * 0.6) * 0.5 + 0.5;
      ctx.fillStyle = PALETTE.lavaDeep;
      ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      const g = ctx.createLinearGradient(sx, sy, sx + ts, sy + ts);
      g.addColorStop(0, PALETTE.lava);
      g.addColorStop(0.5 + 0.3 * (flow - 0.5), PALETTE.lavaHot);
      g.addColorStop(1, PALETTE.lava);
      ctx.globalAlpha = 0.75 + 0.25 * flow;
      ctx.fillStyle = g;
      ctx.fillRect(sx + 1, sy + 1, ts - 1.5, ts - 1.5);
      ctx.globalAlpha = 1;
      // Crust
      ctx.fillStyle = "rgba(60,8,2,0.55)";
      for (let i = 0; i < 3; i++) {
        const cx = sx + ts * hash(x, y, i);
        const cy = sy + ts * ((hash(y, x, i) + t / 9000) % 1);
        ctx.beginPath();
        ctx.ellipse(cx, cy, ts * 0.14, ts * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "I": {
      ctx.fillStyle = PALETTE.iceDeep;
      ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      ctx.fillStyle = PALETTE.ice;
      ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(1, ts / 28);
      ctx.beginPath();
      const n = hash(x, y);
      ctx.moveTo(sx + ts * 0.15, sy + ts * (0.3 + n * 0.3));
      ctx.lineTo(sx + ts * (0.45 + n * 0.2), sy + ts * 0.15);
      ctx.moveTo(sx + ts * 0.5, sy + ts * 0.85);
      ctx.lineTo(sx + ts * 0.85, sy + ts * (0.5 + n * 0.2));
      ctx.stroke();
      return;
    }
    default: {
      // Floor-like tiles: . S U D
      ctx.fillStyle = PALETTE.grout;
      ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      const inset = Math.max(1, ts * 0.04);
      ctx.fillRect(sx + inset, sy + inset, ts - inset * 2, ts - inset * 2);
      if (hash(x, y, 7) < 0.18) {
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = Math.max(1, ts / 32);
        ctx.beginPath();
        ctx.moveTo(sx + ts * 0.2, sy + ts * 0.7);
        ctx.lineTo(sx + ts * 0.45, sy + ts * 0.55);
        ctx.stroke();
      }
      if (ch === "S") {
        ctx.strokeStyle = "rgba(234,220,198,0.25)";
        ctx.lineWidth = Math.max(1, ts / 18);
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (ch === "U" || ch === "D") drawStairs(ctx, sx, sy, ts, ch === "U", t);
    }
  }
}

function drawStairs(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ts: number,
  deeper: boolean,
  t: number,
) {
  // "U" is the way on, deeper into Hell: a stairwell sinking into fire. "D" climbs back.
  const pulse = 0.5 + 0.5 * Math.sin(t / 420);
  ctx.fillStyle = "#070302";
  ctx.fillRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.84);
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    const c = deeper ? 150 - i * 30 : 70 + i * 25;
    ctx.fillStyle = `rgb(${c},${Math.round(c * 0.78)},${Math.round(c * 0.64)})`;
    ctx.fillRect(
      sx + ts * (0.12 + f * 0.08),
      sy + ts * (0.12 + f * 0.19),
      ts * (0.76 - f * 0.16),
      ts * 0.13,
    );
  }
  if (deeper) {
    const g = ctx.createRadialGradient(
      sx + ts / 2,
      sy + ts * 0.85,
      1,
      sx + ts / 2,
      sy + ts * 0.85,
      ts * 0.75,
    );
    g.addColorStop(0, `rgba(255,170,60,${0.75 + 0.2 * pulse})`);
    g.addColorStop(0.5, `rgba(228,87,46,${0.35 + 0.15 * pulse})`);
    g.addColorStop(1, "rgba(228,87,46,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - ts * 0.25, sy - ts * 0.25, ts * 1.5, ts * 1.5);
  }
  ctx.strokeStyle = deeper ? `rgba(232,194,90,${0.6 + 0.3 * pulse})` : "rgba(160,150,140,0.6)";
  ctx.lineWidth = Math.max(1, ts / 18);
  ctx.strokeRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.84);
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

const DIR_ANGLE: Record<string, number> = {
  up: -Math.PI / 2,
  down: Math.PI / 2,
  left: Math.PI,
  right: 0,
};

function arrow(
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

function glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function flame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  t: number,
  seed = 0,
) {
  const wob = Math.sin(t / 90 + seed) * 0.12;
  ctx.fillStyle = PALETTE.lava;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy);
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.9, cx + s * wob, cy - s * 1.5);
  ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.9, cx + s * 0.5, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.lavaHot;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy);
  ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.6, cx + s * wob * 0.6, cy - s * 0.95);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.6, cx + s * 0.25, cy);
  ctx.closePath();
  ctx.fill();
}

function lockColor(name: string): string {
  const colors = [PALETTE.gold, "#c0c6cf", "#d0582c", PALETTE.teal, PALETTE.violet, "#7fc95b"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return colors[Math.abs(h) % colors.length]!;
}

function drawEntity(
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
  const lw = Math.max(1, ts / 16);
  ctx.lineWidth = lw;
  switch (e.kind) {
    case "door": {
      if (s.open) {
        ctx.strokeStyle = PALETTE.woodDark;
        ctx.lineWidth = lw * 1.5;
        ctx.strokeRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.84);
        return;
      }
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
      ctx.strokeStyle = PALETTE.woodDark;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + ts * (0.06 + i * 0.22), sy + ts * 0.08);
        ctx.lineTo(sx + ts * (0.06 + i * 0.22), sy + ts * 0.92);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.iron;
      ctx.fillRect(sx + ts * 0.06, sy + ts * 0.25, ts * 0.88, ts * 0.07);
      ctx.fillRect(sx + ts * 0.06, sy + ts * 0.68, ts * 0.88, ts * 0.07);
      const holders = (s.holders as string[] | undefined)?.length ?? 0;
      if (holders > 0 || s.inverted) {
        ctx.fillStyle = s.inverted ? PALETTE.blood : PALETTE.ember;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "locked_door": {
      const c = lockColor(String(s.lock ?? ""));
      if (s.open) {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.84);
        ctx.globalAlpha = 1;
        return;
      }
      ctx.fillStyle = PALETTE.iron;
      ctx.fillRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
      ctx.fillStyle = c;
      ctx.fillRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.08);
      ctx.fillStyle = "#1b1512";
      ctx.beginPath();
      ctx.arc(cx, cy - ts * 0.04, ts * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - ts * 0.04, cy, ts * 0.08, ts * 0.18);
      return;
    }
    case "lever":
    case "switch": {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(sx + ts * 0.25, sy + ts * 0.62, ts * 0.5, ts * 0.22);
      const on = e.kind === "lever" ? s.pulled === true : s.on === true;
      const ang = on ? 0.6 : -0.6;
      ctx.strokeStyle = PALETTE.iron;
      ctx.lineWidth = lw * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, sy + ts * 0.68);
      ctx.lineTo(cx + Math.sin(ang) * ts * 0.35, sy + ts * 0.68 - Math.cos(ang) * ts * 0.35);
      ctx.stroke();
      ctx.fillStyle = e.kind === "switch" ? (on ? PALETTE.teal : PALETTE.blood) : PALETTE.ember;
      ctx.beginPath();
      ctx.arc(
        cx + Math.sin(ang) * ts * 0.35,
        sy + ts * 0.68 - Math.cos(ang) * ts * 0.35,
        ts * 0.09,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      return;
    }
    case "plate": {
      ctx.fillStyle = s.pressed ? "#5d4a2c" : "#3b3029";
      ctx.fillRect(sx + ts * 0.14, sy + ts * 0.14, ts * 0.72, ts * 0.72);
      ctx.strokeStyle = s.pressed ? PALETTE.ember : PALETTE.stoneDark;
      ctx.strokeRect(sx + ts * 0.14, sy + ts * 0.14, ts * 0.72, ts * 0.72);
      if (s.pressed) glow(ctx, cx, cy, ts * 0.5, "rgba(240,162,59,0.35)");
      if (s.stone) {
        ctx.fillStyle = PALETTE.stone;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "block":
    case "statue": {
      if (s.filled) {
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.strokeRect(sx + ts * 0.15, sy + ts * 0.15, ts * 0.7, ts * 0.7);
        return;
      }
      if (e.kind === "block") {
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.fillRect(sx + ts * 0.08, sy + ts * 0.12, ts * 0.84, ts * 0.82);
        ctx.fillStyle = PALETTE.stone;
        ctx.fillRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.66);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(sx + ts * 0.08, sy + ts * 0.08, ts * 0.84, ts * 0.08);
        return;
      }
      // Statue: a hooded figure; its eyes burn when it is free to move.
      ctx.fillStyle = "#9b958e";
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.22, sy + ts * 0.92);
      ctx.lineTo(sx + ts * 0.3, sy + ts * 0.42);
      ctx.quadraticCurveTo(cx, sy + ts * 0.02, sx + ts * 0.7, sy + ts * 0.42);
      ctx.lineTo(sx + ts * 0.78, sy + ts * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#5f5a55";
      ctx.beginPath();
      ctx.ellipse(cx, sy + ts * 0.38, ts * 0.14, ts * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      const free = s.watched === false;
      ctx.fillStyle = free ? "#ff3b2f" : "#2a2522";
      ctx.fillRect(cx - ts * 0.09, sy + ts * 0.36, ts * 0.06, ts * 0.04);
      ctx.fillRect(cx + ts * 0.03, sy + ts * 0.36, ts * 0.06, ts * 0.04);
      if (free) glow(ctx, cx, sy + ts * 0.38, ts * 0.35, "rgba(255,40,30,0.35)");
      return;
    }
    case "patrol": {
      const bob = Math.sin(t / 180 + e.x) * ts * 0.03;
      glow(ctx, cx, cy, ts * 0.6, "rgba(200,20,20,0.3)");
      ctx.fillStyle = "#8f1219";
      ctx.beginPath();
      ctx.arc(cx, cy + bob, ts * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8d2b0";
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.22, cy - ts * 0.15 + bob);
      ctx.lineTo(cx - ts * 0.32, cy - ts * 0.42 + bob);
      ctx.lineTo(cx - ts * 0.1, cy - ts * 0.25 + bob);
      ctx.moveTo(cx + ts * 0.22, cy - ts * 0.15 + bob);
      ctx.lineTo(cx + ts * 0.32, cy - ts * 0.42 + bob);
      ctx.lineTo(cx + ts * 0.1, cy - ts * 0.25 + bob);
      ctx.fill();
      ctx.fillStyle = PALETTE.lavaHot;
      ctx.fillRect(cx - ts * 0.13, cy - ts * 0.04 + bob, ts * 0.08, ts * 0.06);
      ctx.fillRect(cx + ts * 0.05, cy - ts * 0.04 + bob, ts * 0.08, ts * 0.06);
      if (typeof s.next === "string" && s.next !== "wait") {
        const n = s.next;
        arrow(
          ctx,
          cx + DX(n) * ts * 0.42,
          cy + DY(n) * ts * 0.42,
          n,
          ts * 0.12,
          "rgba(255,200,120,0.9)",
        );
      }
      return;
    }
    case "echo": {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t / 300);
      drawFigure(ctx, cx, cy, ts, PALETTE.violet, "#3b2470");
      ctx.restore();
      if (typeof s.facing === "string")
        arrow(
          ctx,
          cx + DX(s.facing) * ts * 0.4,
          cy + DY(s.facing) * ts * 0.4,
          s.facing,
          ts * 0.1,
          PALETTE.violet,
        );
      return;
    }
    case "platform": {
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(sx + ts * 0.04, sy + ts * 0.14, ts * 0.92, ts * 0.76);
      ctx.fillStyle = PALETTE.wood;
      for (let i = 0; i < 3; i++)
        ctx.fillRect(sx + ts * 0.06, sy + ts * (0.17 + i * 0.25), ts * 0.88, ts * 0.19);
      if (typeof s.dir === "string") arrow(ctx, cx, cy, s.dir, ts * 0.13, "rgba(234,220,198,0.6)");
      return;
    }
    case "bridge": {
      ctx.fillStyle = PALETTE.wood;
      for (let i = 0; i < 4; i++)
        ctx.fillRect(sx + ts * (0.04 + i * 0.24), sy + ts * 0.02, ts * 0.2, ts * 0.96);
      return;
    }
    case "vent": {
      ctx.fillStyle = "#1b1310";
      ctx.fillRect(sx + ts * 0.12, sy + ts * 0.12, ts * 0.76, ts * 0.76);
      ctx.strokeStyle = s.next ? PALETTE.ember : "#4a3a33";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + ts * (0.2 + i * 0.2), sy + ts * 0.16);
        ctx.lineTo(sx + ts * (0.2 + i * 0.2), sy + ts * 0.84);
        ctx.stroke();
      }
      if (s.up) {
        glow(ctx, cx, cy, ts * 0.8, "rgba(255,90,20,0.5)");
        flame(ctx, cx - ts * 0.18, sy + ts * 0.88, ts * 0.3, t, e.x);
        flame(ctx, cx + ts * 0.16, sy + ts * 0.88, ts * 0.34, t, e.y + 2);
      } else if (s.next) {
        glow(ctx, cx, cy, ts * 0.5, "rgba(255,120,30,0.3)");
      }
      return;
    }
    case "crack": {
      ctx.strokeStyle = "rgba(10,6,5,0.85)";
      ctx.lineWidth = Math.max(1, ts / 24);
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.18, sy + ts * 0.3);
      ctx.lineTo(sx + ts * 0.42, sy + ts * 0.48);
      ctx.lineTo(sx + ts * 0.36, sy + ts * 0.7);
      ctx.moveTo(sx + ts * 0.42, sy + ts * 0.48);
      ctx.lineTo(sx + ts * 0.74, sy + ts * 0.4);
      ctx.lineTo(sx + ts * 0.82, sy + ts * 0.62);
      ctx.stroke();
      return;
    }
    case "trap": {
      ctx.fillStyle = "#050202";
      ctx.beginPath();
      ctx.ellipse(cx, cy, ts * 0.4, ts * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.effect === "fall" ? PALETTE.violet : PALETTE.blood;
      ctx.lineWidth = lw;
      ctx.stroke();
      return;
    }
    case "crumble": {
      if (s.collapsed) {
        ctx.fillStyle = "#050202";
        ctx.fillRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
        ctx.strokeStyle = "#3a2c26";
        ctx.strokeRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
        return;
      }
      ctx.strokeStyle = s.stood ? PALETTE.ember : "rgba(10,6,5,0.9)";
      ctx.lineWidth = Math.max(1, ts / 22);
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.1, sy + ts * 0.5);
      ctx.lineTo(sx + ts * 0.5, sy + ts * 0.45);
      ctx.lineTo(sx + ts * 0.9, sy + ts * 0.55);
      ctx.moveTo(sx + ts * 0.5, sy + ts * 0.1);
      ctx.lineTo(sx + ts * 0.5, sy + ts * 0.9);
      ctx.moveTo(sx + ts * 0.2, sy + ts * 0.15);
      ctx.lineTo(sx + ts * 0.35, sy + ts * 0.35);
      ctx.moveTo(sx + ts * 0.65, sy + ts * 0.75);
      ctx.lineTo(sx + ts * 0.85, sy + ts * 0.88);
      ctx.stroke();
      return;
    }
    case "portal": {
      const a = t / 500;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? PALETTE.teal : PALETTE.violet;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * (0.15 + i * 0.1), a + i, a + i + Math.PI * 1.3);
        ctx.stroke();
      }
      glow(ctx, cx, cy, ts * 0.5, "rgba(120,90,255,0.3)");
      return;
    }
    case "oneway": {
      for (const off of [-0.18, 0.12]) {
        const d = String(s.dir);
        arrow(
          ctx,
          cx + DX(d) * ts * off,
          cy + DY(d) * ts * off,
          d,
          ts * 0.17,
          "rgba(232,194,90,0.75)",
        );
      }
      return;
    }
    case "beam": {
      ctx.fillStyle = "#2b1a14";
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.firing ? "#ff5a1f" : "#4a2a20";
      ctx.beginPath();
      ctx.ellipse(
        cx + DX(String(s.dir)) * ts * 0.12,
        cy + DY(String(s.dir)) * ts * 0.12,
        ts * 0.16,
        ts * 0.16,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      if (s.firing) glow(ctx, cx, cy, ts * 0.6, "rgba(255,80,20,0.4)");
      return;
    }
    case "mirror": {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dfe8f0";
      ctx.lineWidth = lw * 2;
      ctx.beginPath();
      if (s.slant === "/") {
        ctx.moveTo(sx + ts * 0.15, sy + ts * 0.85);
        ctx.lineTo(sx + ts * 0.85, sy + ts * 0.15);
      } else {
        ctx.moveTo(sx + ts * 0.15, sy + ts * 0.15);
        ctx.lineTo(sx + ts * 0.85, sy + ts * 0.85);
      }
      ctx.stroke();
      return;
    }
    case "receiver": {
      const lit = s.lit === true || s.done === true;
      if (lit) glow(ctx, cx, cy, ts * 0.7, "rgba(255,200,80,0.5)");
      ctx.fillStyle = lit ? PALETTE.lavaHot : "#5b4a6b";
      ctx.beginPath();
      ctx.moveTo(cx, sy + ts * 0.1);
      ctx.lineTo(sx + ts * 0.78, cy);
      ctx.lineTo(cx, sy + ts * 0.9);
      ctx.lineTo(sx + ts * 0.22, cy);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "altar": {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(sx + ts * 0.12, sy + ts * 0.45, ts * 0.76, ts * 0.45);
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(sx + ts * 0.06, sy + ts * 0.38, ts * 0.88, ts * 0.12);
      if (s.done) {
        glow(ctx, cx, sy + ts * 0.3, ts * 0.6, "rgba(232,194,90,0.5)");
        flame(ctx, cx, sy + ts * 0.38, ts * 0.25, t);
      }
      ctx.fillStyle = PALETTE.bone;
      ctx.font = `${Math.round(ts * 0.22)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(Number(s.threshold ?? 0.75) * 100)}%`, cx, sy + ts * 0.8);
      return;
    }
    case "vigil": {
      ctx.fillStyle = s.done ? "#4d4430" : "#33302c";
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.38, 0, Math.PI * 2);
      ctx.fill();
      const n = Number(s.turns ?? 5),
        c = Number(s.count ?? 0);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        ctx.fillStyle = s.done || i < c ? PALETTE.gold : "#1d1a17";
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * ts * 0.25,
          cy + Math.sin(a) * ts * 0.25,
          ts * 0.06,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      return;
    }
    case "sign": {
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(cx - ts * 0.04, sy + ts * 0.5, ts * 0.08, ts * 0.4);
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(sx + ts * 0.14, sy + ts * 0.18, ts * 0.72, ts * 0.4);
      ctx.fillStyle = PALETTE.bone;
      for (let i = 0; i < 3; i++)
        ctx.fillRect(
          sx + ts * 0.22,
          sy + ts * (0.26 + i * 0.1),
          ts * (0.56 - i * 0.12),
          Math.max(1, ts * 0.04),
        );
      return;
    }
    case "light": {
      glow(ctx, cx, cy, ts * 0.9, "rgba(255,140,40,0.35)");
      ctx.fillStyle = PALETTE.iron;
      ctx.fillRect(sx + ts * 0.3, sy + ts * 0.62, ts * 0.4, ts * 0.12);
      ctx.fillRect(cx - ts * 0.05, sy + ts * 0.7, ts * 0.1, ts * 0.22);
      flame(ctx, cx, sy + ts * 0.64, ts * 0.22, t, e.x * 3 + e.y);
      return;
    }
    case "item":
      return drawItem(ctx, String(s.item), cx, cy, ts, t, String(s.opens ?? ""));
    default: {
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(sx + ts * 0.3, sy + ts * 0.3, ts * 0.4, ts * 0.4);
    }
  }
}

const DX = (d: string) => ({ left: -1, right: 1 })[d as "left"] ?? 0;
const DY = (d: string) => ({ up: -1, down: 1 })[d as "up"] ?? 0;

export function drawItem(
  ctx: CanvasRenderingContext2D,
  type: string,
  cx: number,
  cy: number,
  ts: number,
  t: number,
  opens = "",
) {
  const lw = Math.max(1, ts / 14);
  glow(ctx, cx, cy, ts * 0.45, "rgba(232,194,90,0.18)");
  switch (type) {
    case "key": {
      const c = lockColor(opens);
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx - ts * 0.15, cy, ts * 0.12, 0, Math.PI * 2);
      ctx.moveTo(cx - ts * 0.03, cy);
      ctx.lineTo(cx + ts * 0.3, cy);
      ctx.moveTo(cx + ts * 0.2, cy);
      ctx.lineTo(cx + ts * 0.2, cy + ts * 0.1);
      ctx.moveTo(cx + ts * 0.28, cy);
      ctx.lineTo(cx + ts * 0.28, cy + ts * 0.12);
      ctx.stroke();
      return;
    }
    case "torch": {
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(cx - ts * 0.05, cy - ts * 0.05, ts * 0.1, ts * 0.38);
      flame(ctx, cx, cy - ts * 0.02, ts * 0.2, t);
      return;
    }
    case "weight": {
      ctx.fillStyle = PALETTE.stone;
      ctx.beginPath();
      ctx.arc(cx, cy + ts * 0.04, ts * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(cx - ts * 0.08, cy - ts * 0.04, ts * 0.08, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "plank": {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.5);
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(-ts * 0.36, -ts * 0.1, ts * 0.72, ts * 0.2);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(-ts * 0.36, -ts * 0.02, ts * 0.72, ts * 0.03);
      ctx.restore();
      return;
    }
    case "hourglass": {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.18, cy - ts * 0.28);
      ctx.lineTo(cx + ts * 0.18, cy - ts * 0.28);
      ctx.lineTo(cx - ts * 0.18, cy + ts * 0.28);
      ctx.lineTo(cx + ts * 0.18, cy + ts * 0.28);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.1, cy + ts * 0.24);
      ctx.lineTo(cx + ts * 0.1, cy + ts * 0.24);
      ctx.lineTo(cx, cy + ts * 0.08);
      ctx.fill();
      return;
    }
    default:
      ctx.fillStyle = PALETTE.bone;
      ctx.fillRect(cx - ts * 0.1, cy - ts * 0.1, ts * 0.2, ts * 0.2);
  }
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  body: string,
  shade: string,
) {
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.36, ts * 0.22, ts * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.2, cy + ts * 0.34);
  ctx.quadraticCurveTo(cx - ts * 0.22, cy - ts * 0.05, cx, cy - ts * 0.08);
  ctx.quadraticCurveTo(cx + ts * 0.22, cy - ts * 0.05, cx + ts * 0.2, cy + ts * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.2, ts * 0.13, 0, Math.PI * 2);
  ctx.fill();
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
  glow(ctx, cx, cy, ts * 0.8, "rgba(234,220,198,0.18)");
  const breathe = Math.sin(t / 500) * ts * 0.01;
  drawFigure(ctx, cx, cy + breathe, ts, PALETTE.bone, "rgba(0,0,0,0.5)");
  ctx.fillStyle = PALETTE.blood;
  ctx.fillRect(cx - ts * 0.2, cy + ts * 0.05 + breathe, ts * 0.4, ts * 0.06);
  arrow(
    ctx,
    cx + DX(hero.facing) * ts * 0.42,
    cy + DY(hero.facing) * ts * 0.42,
    hero.facing,
    ts * 0.11,
    PALETTE.ember,
  );
}
