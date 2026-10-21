/**
 * Arriving on a floor: the map goes dark, the circle's numeral and name rise out of it, then the
 * floor is revealed from the hero outward, like a lamp being lifted.
 */
import { cameraOrigin, VIEW_HEIGHT, VIEW_WIDTH } from "@inferno/shared";
import { useRef, type CSSProperties } from "react";
import type { GameView } from "../game/store.js";
import { toRoman } from "./Header.js";

function arrival(view: GameView): string {
  const outcome = view.log.at(-1)?.outcome;
  if (outcome === "fell") return "You fall to";
  if (outcome === "floor_down") return "You climb back to";
  if (outcome === "floor_up") return "You descend to";
  return "You enter";
}

export function FloorTransition({ view }: { view: GameView }) {
  const { floor } = view;
  // Words chosen once per arrival, so later turns don't rewrite the card as it fades.
  const shown = useRef<{ floorId: string; how: string } | null>(null);
  if (floor && shown.current?.floorId !== floor.floorId) {
    shown.current = { floorId: floor.floorId, how: arrival(view) };
  }
  if (!floor || !shown.current) return null;
  // The lamp lifts from wherever the hero stands in the camera window.
  const hero = view.hero ?? { x: 0, y: 0 };
  const cam = cameraOrigin(hero, floor);
  const at = {
    "--cx": `${((hero.x - cam.x + 0.5) / VIEW_WIDTH) * 100}%`,
    "--cy": `${((hero.y - cam.y + 0.5) / VIEW_HEIGHT) * 100}%`,
  } as CSSProperties;
  return (
    <div key={floor.floorId} className="descent" style={at} aria-hidden="true">
      <div className="descent-card">
        <p className="descent-how">{shown.current.how}</p>
        <p className="descent-numeral">{toRoman(floor.index)}</p>
        <span className="descent-rule" />
        {floor.name && <p className="descent-name">{floor.name}</p>}
      </div>
    </div>
  );
}
