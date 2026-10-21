/**
 * Atmosphere drawn over the floor: torchlight that falls off toward the edge of what the crowd
 * can see (and flickers there), fog drifting through the dark, and a warm glow around the hero
 * and braziers. It only uses what the client already knows (which tiles are visible), so it
 * gives nothing away.
 */

export interface AtmosphereView {
  /** Visible terrain rows (" " = not visible now). */
  rows: string[];
  width: number;
  height: number;
  /** Tiles seen before but not visible now (drawn dimmed, not black). */
  remembered: (x: number, y: number) => boolean;
  camX: number;
  camY: number;
  tile: number;
  time: number;
  /** False with prefers-reduced-motion: no flicker, fog holds still. */
  motion: boolean;
  /** Warm light sources in tile coordinates (the hero, braziers). */
  glows: { x: number; y: number; radius: number }[];
}

/** Darkness of the unseen; the edge of the light ramps up to it over EDGE tiles. */
const EDGE = 2.2;
const REMEMBERED_DARK = 0.8;

interface Layers {
  mask: HTMLCanvasElement;
  fog: HTMLCanvasElement;
  noise: HTMLCanvasElement;
}

const layersFor = new WeakMap<CanvasRenderingContext2D, Layers>();

function layers(ctx: CanvasRenderingContext2D): Layers {
  let l = layersFor.get(ctx);
  if (!l) {
    l = {
      mask: document.createElement("canvas"),
      fog: document.createElement("canvas"),
      noise: makeNoise(128),
    };
    layersFor.set(ctx, l);
  }
  return l;
}

/** A slow, wandering value in [-1, 1] for each seed: the flicker of one flame. */
function flicker(t: number, seed: number): number {
  return (
    0.55 * Math.sin(t / 170 + seed * 6.283) +
    0.3 * Math.sin(t / 61 + seed * 17.1) +
    0.15 * Math.sin(t / 23 + seed * 41.7)
  );
}

function seedOf(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Per-tile darkness (0 lit … 1 black) for the tiles in view, from each tile's distance to the
 * nearest unseen tile (a two-pass chamfer distance, so the light rounds off naturally).
 */
function darkness(v: AtmosphereView, x0: number, y0: number, w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const INF = 1e6;
  let anyDark = false;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i,
        y = y0 + j;
      const inside = x >= 0 && y >= 0 && x < v.width && y < v.height;
      const seen = inside && (v.rows[y]?.[x] ?? " ") !== " ";
      // Beyond the floor's edge is neither lit nor a source of darkness.
      const dark = inside && !seen;
      if (dark) anyDark = true;
      dist[j * w + i] = dark ? 0 : INF;
    }
  }
  if (!anyDark) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const x = x0 + i,
          y = y0 + j;
        out[j * w + i] = x >= 0 && y >= 0 && x < v.width && y < v.height ? 0 : 1;
      }
    return out;
  }
  const D = 1.41;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let d = dist[j * w + i]!;
      if (i > 0) d = Math.min(d, dist[j * w + i - 1]! + 1);
      if (j > 0) d = Math.min(d, dist[(j - 1) * w + i]! + 1);
      if (i > 0 && j > 0) d = Math.min(d, dist[(j - 1) * w + i - 1]! + D);
      if (i < w - 1 && j > 0) d = Math.min(d, dist[(j - 1) * w + i + 1]! + D);
      dist[j * w + i] = d;
    }
  for (let j = h - 1; j >= 0; j--)
    for (let i = w - 1; i >= 0; i--) {
      let d = dist[j * w + i]!;
      if (i < w - 1) d = Math.min(d, dist[j * w + i + 1]! + 1);
      if (j < h - 1) d = Math.min(d, dist[(j + 1) * w + i]! + 1);
      if (i < w - 1 && j < h - 1) d = Math.min(d, dist[(j + 1) * w + i + 1]! + D);
      if (i > 0 && j < h - 1) d = Math.min(d, dist[(j + 1) * w + i - 1]! + D);
      dist[j * w + i] = d;
    }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i,
        y = y0 + j;
      const inside = x >= 0 && y >= 0 && x < v.width && y < v.height;
      const d = dist[j * w + i]!;
      if (!inside) {
        out[j * w + i] = 1;
      } else if (d === 0) {
        out[j * w + i] = v.remembered(x, y) ? REMEMBERED_DARK : 1;
      } else {
        // 0 at the light's heart, rising toward the edge; the edge tiles breathe.
        const edge = Math.max(0, 1 - (d - 0.5) / EDGE);
        const eased = edge * edge * (3 - 2 * edge);
        const wobble = v.motion ? 0.13 * eased * flicker(v.time, seedOf(x, y)) : 0;
        out[j * w + i] = Math.min(0.8, Math.max(0, 0.58 * eased + wobble));
      }
    }
  }
  return out;
}

/** Tileable fractal value noise, as a grey alpha texture. */
function makeNoise(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(size, size);
  const lattice = (cells: number, salt: number) => {
    const v: number[] = [];
    for (let i = 0; i < cells * cells; i++) v.push(seedOf(i, salt));
    return (x: number, y: number) => {
      const fx = (x / size) * cells,
        fy = (y / size) * cells;
      const ix = Math.floor(fx),
        iy = Math.floor(fy);
      const tx = fx - ix,
        ty = fy - iy;
      const at = (a: number, b: number) => v[((b % cells) * cells + (a % cells)) % v.length]!;
      const sx = tx * tx * (3 - 2 * tx),
        sy = ty * ty * (3 - 2 * ty);
      const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
      const bottom = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
      return top * (1 - sy) + bottom * sy;
    };
  };
  const octaves = [lattice(4, 1), lattice(8, 2), lattice(16, 3)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = 0.55 * octaves[0]!(x, y) + 0.3 * octaves[1]!(x, y) + 0.15 * octaves[2]!(x, y);
      const a = Math.max(0, Math.min(1, (n - 0.5) * 2.6)) ** 1.4;
      const i = (y * size + x) * 4;
      img.data[i] = 150;
      img.data[i + 1] = 132;
      img.data[i + 2] = 150;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** Draw the darkness, fog and glow over a scene already drawn into `ctx` (w × h pixels). */
export function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  v: AtmosphereView,
  w: number,
  h: number,
): void {
  const ts = v.tile;
  const x0 = Math.floor(v.camX) - 1;
  const y0 = Math.floor(v.camY) - 1;
  const cols = Math.ceil(w / ts) + 3;
  const rowsN = Math.ceil(h / ts) + 3;
  const dark = darkness(v, x0, y0, cols, rowsN);
  const { mask, fog, noise } = layers(ctx);
  const px = (x: number) => (x - v.camX) * ts;
  const py = (y: number) => (y - v.camY) * ts;

  // 1. Darkness: one pixel per tile, scaled up smoothly, so the light fades instead of stepping.
  if (mask.width !== cols || mask.height !== rowsN) {
    mask.width = cols;
    mask.height = rowsN;
  }
  const m = mask.getContext("2d");
  if (!m) return;
  const img = m.createImageData(cols, rowsN);
  for (let i = 0; i < dark.length; i++) {
    img.data[i * 4] = 5;
    img.data[i * 4 + 1] = 3;
    img.data[i * 4 + 2] = 4;
    img.data[i * 4 + 3] = Math.round(dark[i]! * 255);
  }
  m.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Pixel centres sit on tile centres.
  ctx.drawImage(mask, px(x0), py(y0), cols * ts, rowsN * ts);
  ctx.restore();

  // 2. Fog: two drifting noise layers, thickest in the dark, faint over the light.
  const scale = 4; // the fog is soft, so a quarter-resolution layer is plenty
  const fw = Math.max(1, Math.ceil(w / scale)),
    fh = Math.max(1, Math.ceil(h / scale));
  if (fog.width !== fw || fog.height !== fh) {
    fog.width = fw;
    fog.height = fh;
  }
  const f = fog.getContext("2d");
  if (f) {
    const pattern = f.createPattern(noise, "repeat");
    if (pattern) {
      f.globalCompositeOperation = "source-over";
      f.clearRect(0, 0, fw, fh);
      const drift = v.motion ? v.time : 0;
      const tsF = ts / scale;
      for (const layer of [
        { speed: 1 / 9000, size: 6, alpha: 0.55, dir: 1 },
        { speed: 1 / 14000, size: 10, alpha: 0.45, dir: -0.6 },
      ]) {
        const k = (tsF * layer.size) / noise.width;
        const ox = -(v.camX + drift * layer.speed * layer.dir) * tsF;
        const oy = -(v.camY + drift * layer.speed * 0.35) * tsF;
        pattern.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
        f.globalAlpha = layer.alpha;
        f.fillStyle = pattern;
        f.fillRect(0, 0, fw, fh);
      }
      // Keep fog where it is dark (and a trace of it in the light).
      f.globalAlpha = 1;
      f.globalCompositeOperation = "destination-in";
      f.imageSmoothingEnabled = true;
      f.drawImage(
        fogMask(mask, dark, cols, rowsN),
        px(x0) / scale,
        py(y0) / scale,
        (cols * ts) / scale,
        (rowsN * ts) / scale,
      );
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fog, 0, 0, w, h);
      ctx.restore();
    }
  }

  // 3. Warm glow: the torch breathes a little.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const g of v.glows) {
    const breath = v.motion ? 1 + 0.05 * flicker(v.time, seedOf(g.x * 7, g.y * 3)) : 1;
    const cx = px(g.x + 0.5),
      cy = py(g.y + 0.5);
    const r = ts * g.radius * breath;
    const grad = ctx.createRadialGradient(cx, cy, ts * 0.2, cx, cy, r);
    grad.addColorStop(0, `rgba(245,160,70,${0.2 * breath})`);
    grad.addColorStop(0.5, "rgba(210,95,35,0.07)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

const fogMasks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** The darkness map reshaped for fog: thick in the dark, a faint trace in the light. */
function fogMask(
  mask: HTMLCanvasElement,
  dark: Float32Array,
  cols: number,
  rows: number,
): HTMLCanvasElement {
  let c = fogMasks.get(mask);
  if (!c) {
    c = document.createElement("canvas");
    fogMasks.set(mask, c);
  }
  if (c.width !== cols || c.height !== rows) {
    c.width = cols;
    c.height = rows;
  }
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(cols, rows);
  for (let i = 0; i < dark.length; i++) {
    img.data[i * 4 + 3] = Math.round((0.08 + 0.92 * dark[i]! ** 2) * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
