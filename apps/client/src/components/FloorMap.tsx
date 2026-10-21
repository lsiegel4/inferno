import { useEffect, useRef } from "react";
import type { GameView } from "../game/store.js";
import { drawMap } from "../render/draw.js";

/** Full-floor view of what the crowd has explored (shared by everyone). */
export function FloorMap({ view, onClose }: { view: GameView; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { floor, hero } = view;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !floor || !hero) return;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(rect.width * dpr);
    el.height = Math.round(rect.height * dpr);
    drawMap(ctx, floor, hero);
  }, [floor, hero]);

  const explored = floor ? countExplored(floor.explored) : { seen: 0, total: 0 };
  return (
    <div className="floor-map" role="dialog" aria-label="Explored floor map">
      <canvas ref={canvas} className="floor-map-canvas" />
      <p className="floor-map-note">
        {explored.total ? Math.round((100 * explored.seen) / explored.total) : 0}% of this floor
        explored ·{" "}
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </p>
    </div>
  );
}

export function countExplored(rows: string[]): { seen: number; total: number } {
  let seen = 0;
  let total = 0;
  for (const row of rows) {
    for (const c of row) {
      total += 1;
      if (c !== " ") seen += 1;
    }
  }
  return { seen, total };
}
