/** The explored floor map: a compact overview drawn with the shared floor renderer's entities. */
import type { FloorView } from "../game/store.js";
import { drawEntity, PALETTE } from "./renderer.js";

function terrainColour(c: string): string {
  switch (c) {
    case " ":
      return PALETTE.void;
    case "#":
      return PALETTE.wallTop;
    case "L":
      return PALETTE.lava;
    default:
      return PALETTE.floorA;
  }
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  floor: FloorView,
  hero: { x: number; y: number },
): void {
  const { width: cw, height: ch } = ctx.canvas;
  const ts = Math.max(2, Math.floor(Math.min(cw / floor.width, ch / floor.height)));
  const ox = Math.floor((cw - ts * floor.width) / 2);
  const oy = Math.floor((ch - ts * floor.height) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const c = floor.explored[y]?.[x] ?? " ";
      ctx.fillStyle = terrainColour(c);
      ctx.fillRect(ox + x * ts, oy + y * ts, ts, ts);
      if (c === "U" || c === "D") {
        ctx.fillStyle = PALETTE.bone;
        ctx.fillRect(ox + x * ts + ts * 0.25, oy + y * ts + ts * 0.25, ts * 0.5, ts * 0.5);
      }
    }
  }
  for (const e of Object.values(floor.entities)) {
    if ((floor.explored[e.y]?.[e.x] ?? " ") === " ") continue;
    drawEntity(ctx, e, ox + e.x * ts, oy + e.y * ts, ts, 0);
  }
  ctx.fillStyle = PALETTE.bone;
  ctx.strokeStyle = PALETTE.void;
  ctx.lineWidth = Math.max(1.5, ts / 8);
  ctx.beginPath();
  ctx.arc(
    ox + hero.x * ts + ts / 2,
    oy + hero.y * ts + ts / 2,
    Math.max(ts, 8) * 0.38,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();
}
