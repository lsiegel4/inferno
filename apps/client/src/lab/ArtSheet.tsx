/**
 * The floor lab's art sheet: every terrain, every thing in each of its states, and the creature
 * of each circle, drawn with the game's own renderer, to review the art at a glance.
 */
import type { Entity } from "@inferno/shared";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { drawTerrainArt } from "../render/art/terrain.js";
import { drawEntity } from "../render/renderer.js";

interface Specimen {
  label: string;
  terrain?: string;
  entity?: Omit<Entity, "id" | "x" | "y">;
  circle?: number;
}

const e = (kind: string, state: Record<string, unknown> = {}) => ({ kind, state });

export const SPECIMENS: Specimen[] = [
  { label: "wall", terrain: "#" },
  { label: "floor", terrain: "." },
  { label: "start", terrain: "S" },
  { label: "lava", terrain: "L" },
  { label: "ice", terrain: "I" },
  { label: "stairs down (on)", terrain: "U" },
  { label: "stairs up (back)", terrain: "D" },
  { label: "sign", entity: e("sign") },
  { label: "door", entity: e("door", { open: false }) },
  { label: "door open", entity: e("door", { open: true }) },
  { label: "locked door", entity: e("locked_door", { lock: "copper", open: false }) },
  { label: "lever", entity: e("lever", { pulled: false }) },
  { label: "lever pulled", entity: e("lever", { pulled: true }) },
  { label: "switch off", entity: e("switch", { on: false }) },
  { label: "switch on", entity: e("switch", { on: true }) },
  { label: "plate", entity: e("plate", { pressed: false }) },
  { label: "plate pressed", entity: e("plate", { pressed: true }) },
  { label: "plate + stone", entity: e("plate", { pressed: true, stone: { id: "w" } }) },
  { label: "block", entity: e("block", { filled: false }) },
  { label: "block in a hole", terrain: "L", entity: e("block", { filled: true }) },
  { label: "watcher", entity: e("statue", { watched: true }) },
  { label: "watcher free", entity: e("statue", { watched: false }) },
  { label: "vent", entity: e("vent", { up: false, next: false }) },
  { label: "vent about to fire", entity: e("vent", { up: false, next: true }) },
  { label: "vent firing", entity: e("vent", { up: true, next: false }) },
  { label: "crack", entity: e("crack") },
  { label: "trap (burn)", entity: e("trap", { discovered: true, effect: "burn" }) },
  { label: "trap (fall)", entity: e("trap", { discovered: true, effect: "fall" }) },
  { label: "pit", entity: e("pit") },
  { label: "ledge", entity: e("crumble", { stood: false, collapsed: false }) },
  { label: "ledge stood on", entity: e("crumble", { stood: true, collapsed: false }) },
  { label: "ledge fallen", entity: e("crumble", { stood: false, collapsed: true }) },
  { label: "portal", entity: e("portal") },
  { label: "one-way", entity: e("oneway", { dir: "right" }) },
  { label: "flame source", entity: e("beam", { dir: "right", firing: false }) },
  { label: "flame source firing", entity: e("beam", { dir: "right", firing: true }) },
  { label: "mirror /", entity: e("mirror", { slant: "/" }) },
  { label: "mirror \\", entity: e("mirror", { slant: "\\" }) },
  { label: "eye", entity: e("receiver", { lit: false }) },
  { label: "eye lit", entity: e("receiver", { lit: true }) },
  { label: "altar", entity: e("altar", { done: false, threshold: 0.8 }) },
  { label: "altar won", entity: e("altar", { done: true, threshold: 0.8 }) },
  { label: "vigil 2/5", entity: e("vigil", { turns: 5, count: 2 }) },
  { label: "brazier", entity: e("light") },
  { label: "ferry", terrain: "L", entity: e("platform", { dir: "right" }) },
  { label: "plank laid", terrain: "L", entity: e("bridge") },
  { label: "key", entity: e("item", { item: "key", opens: "copper" }) },
  { label: "torch", entity: e("item", { item: "torch" }) },
  { label: "stone", entity: e("item", { item: "weight" }) },
  { label: "plank", entity: e("item", { item: "plank" }) },
  { label: "hourglass", entity: e("item", { item: "hourglass" }) },
  { label: "Dante's shade", entity: e("echo", { facing: "down" }) },
  { label: "VI Cerberus", entity: e("patrol", { next: "right" }), circle: 6 },
  { label: "XI centaur", entity: e("patrol", { next: "right" }), circle: 11 },
  { label: "XII harpy", entity: e("patrol", { next: "right" }), circle: 12 },
  { label: "XV demon, whip", entity: e("patrol", { next: "right" }), circle: 15 },
  { label: "XVIII Malebranche", entity: e("patrol", { next: "right" }), circle: 18 },
  { label: "XX serpent", entity: e("patrol", { next: "right" }), circle: 20 },
  { label: "other demons", entity: e("patrol", { next: "right" }), circle: 0 },
];

const TS = 96;
const COLS = 6;
const LABEL = 22;

export function ArtSheet({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let raf = 0;
    const frame = (t: number) => {
      ctx.fillStyle = "#0b0907";
      ctx.fillRect(0, 0, el.width, el.height);
      SPECIMENS.forEach((sp, i) => {
        const sx = (i % COLS) * TS,
          sy = Math.floor(i / COLS) * (TS + LABEL);
        drawTerrainArt(ctx, sp.terrain ?? ".", i, 3, sx, sy, TS, t, () => ".");
        if (sp.entity) {
          const ent = { id: sp.label, x: i % COLS, y: 0, ...sp.entity } as Entity;
          drawEntity(ctx, ent, sx, sy, TS, t, { x: (i % COLS) + 1, y: 1 }, sp.circle ?? 0);
        }
        ctx.fillStyle = "#a29482";
        ctx.font = '13px "Alegreya Sans", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sp.label, sx + TS / 2, sy + TS + LABEL / 2);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const rows = Math.ceil(SPECIMENS.length / COLS);
  // On the page itself: the drawer's transform would trap a fixed overlay inside it.
  return createPortal(
    <div className="art-sheet" role="dialog" aria-label="Art sheet">
      <button type="button" className="key" onClick={onClose}>
        Close
      </button>
      <canvas ref={canvas} width={COLS * TS} height={rows * (TS + LABEL)} />
    </div>,
    document.body,
  );
}
