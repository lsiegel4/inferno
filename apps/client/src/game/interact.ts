import type { Action, Direction, Entity } from "@inferno/shared";
import type { GameView } from "./store.js";

const DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function facedTile(hero: { x: number; y: number; facing: Direction }) {
  const [dx, dy] = DELTA[hero.facing];
  return { x: hero.x + dx, y: hero.y + dy };
}

/** Entities on the tile the hero faces. */
export function facedEntities(view: GameView): Entity[] {
  if (!view.hero || !view.floor) return [];
  const { x, y } = facedTile(view.hero);
  return Object.values(view.floor.entities).filter((e) => e.x === x && e.y === y);
}

/** Context label for the Interact button (game design §2). */
export function interactLabel(view: GameView): string {
  for (const e of facedEntities(view)) {
    const s = e.state ?? {};
    switch (e.kind) {
      case "lever":
        return s.pulled ? "Pulled" : "Pull";
      case "item":
        return `Take ${String(s.item ?? "item")}`;
      case "sign":
        return "Read";
      case "locked_door":
        return s.open ? "Interact" : "Locked";
      case "plate":
        return s.stone ? "Take stone" : "Interact";
    }
  }
  return "Interact";
}

export function describeAction(a: Action): string {
  switch (a.kind) {
    case "move":
      return { up: "↑", down: "↓", left: "←", right: "→" }[a.dir];
    case "use":
      return `use ${a.itemId}`;
    default:
      return a.kind;
  }
}

export function sameAction(a: Action | null, b: Action): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}
