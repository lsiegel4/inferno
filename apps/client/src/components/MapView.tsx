import { cameraOrigin, VIEW_HEIGHT, VIEW_WIDTH } from "@inferno/shared";
import { useEffect, useRef } from "react";
import type { GameView } from "../game/store.js";
import { drawView } from "../render/draw.js";

/** The follow camera: a 9 × 13 window of the floor centred on the hero. */
export function MapView({ view }: { view: GameView }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(view);
  latest.current = view;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return; // no canvas support (tests)
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let cam: { x: number; y: number } | null = null;
    let raf = 0;
    const frame = (t: number) => {
      const { floor, hero } = latest.current;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      if (el.width !== w) {
        el.width = w;
        el.height = Math.round((w * VIEW_HEIGHT) / VIEW_WIDTH);
      }
      if (floor && hero) {
        const target = cameraOrigin(hero, floor);
        if (!cam || reduceMotion) cam = { ...target };
        else cam = { x: cam.x + (target.x - cam.x) * 0.2, y: cam.y + (target.y - cam.y) * 0.2 };
        drawView(ctx, floor, hero, cam, el.width / VIEW_WIDTH, t);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="map-canvas" aria-label="The dungeon around the hero" />;
}
