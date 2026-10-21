import { cameraOrigin, VIEW_HEIGHT, VIEW_WIDTH } from "@inferno/shared";
import { useEffect, useRef } from "react";
import type { GameView } from "../game/store.js";
import { useServices } from "../services.js";
import { HeroMotion, moveKind } from "../render/motion.js";
import { drawScene, PALETTE } from "../render/renderer.js";
import { toSceneFloor, visibleEntities } from "../render/scene.js";

const NO_MEMORY = new Map<string, string>(); // tiles are not remembered in the main view (§7a)
const HURT_MS = 600;

/** The follow camera: a 9 × 13 window of the floor centred on the hero. */
export function MapView({ view }: { view: GameView }) {
  const { xray } = useServices();
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(view);
  latest.current = view;
  const diedAt = useRef(0);
  const lastDeathTurn = useRef(0);

  const last = view.log.at(-1);
  if (last?.outcome === "died" && last.turn !== lastDeathTurn.current) {
    lastDeathTurn.current = last.turn;
    diedAt.current = performance.now();
  }

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return; // no canvas support (tests)
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let cam: { x: number; y: number } | null = null;
    let raf = 0;
    const motion = new HeroMotion();
    let at: { floorId: string; x: number; y: number } | null = null;
    let deathSeen = lastDeathTurn.current;
    const frame = (t: number) => {
      const { floor, hero, log } = latest.current;
      if (floor && hero && (at?.floorId !== floor.floorId || at.x !== hero.x || at.y !== hero.y)) {
        const died = lastDeathTurn.current !== deathSeen;
        deathSeen = lastDeathTurn.current;
        const cut = reduceMotion || died || at?.floorId !== floor.floorId;
        const kind = moveKind(at ?? hero, hero, log.at(-1)?.action.kind, cut);
        motion.moveTo(hero.x, hero.y, kind, t);
        at = { floorId: floor.floorId, x: hero.x, y: hero.y };
      }
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      if (el.width !== w) {
        el.width = w;
        el.height = Math.round((w * VIEW_HEIGHT) / VIEW_WIDTH);
      }
      if (floor && hero) {
        const pose = motion.at(t);
        // The camera rides with the moving figure, so a step never jolts the view.
        const target = cameraOrigin(pose, floor);
        if (!cam || reduceMotion) cam = { ...target };
        else cam = { x: cam.x + (target.x - cam.x) * 0.35, y: cam.y + (target.y - cam.y) * 0.35 };
        const ts = el.width / VIEW_WIDTH;
        drawScene(
          ctx,
          {
            floor: toSceneFloor(floor, visibleEntities(floor)),
            hero: { ...hero, x: pose.x, y: pose.y },
            heroLift: pose.lift,
            remembered: NO_MEMORY,
            xray: xray?.() ?? [],
            camX: cam.x,
            camY: cam.y,
            tile: ts,
            time: t,
            hurt: Math.max(0, 1 - (t - diedAt.current) / HURT_MS),
            motion: !reduceMotion,
          },
          el.width,
          el.height,
        );
        // The tile the hero faces, so voters can see what Interact and Jump act on (once the
        // hero has arrived).
        const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[hero.facing];
        const settled = pose.x === hero.x && pose.y === hero.y;
        ctx.save();
        ctx.setLineDash([ts / 8, ts / 8]);
        ctx.strokeStyle = PALETTE.ember;
        ctx.globalAlpha = settled ? 0.7 : 0;
        ctx.lineWidth = Math.max(1, ts / 30);
        ctx.strokeRect(
          (hero.x + f[0]! - cam.x) * ts + 3,
          (hero.y + f[1]! - cam.y) * ts + 3,
          ts - 6,
          ts - 6,
        );
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [xray]);

  return <canvas ref={canvas} className="map-canvas" aria-label="The dungeon around the hero" />;
}
