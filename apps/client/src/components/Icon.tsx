/**
 * The action icon set: one stroke weight on a 24-unit grid, round caps, drawn in currentColor.
 * Every control uses these, so a move, a jump or a wait always looks the same wherever it shows.
 */
import type { Action, Direction } from "@inferno/shared";

export type IconName =
  Direction | "jump" | "interact" | "wait" | "use" | "map" | "crowd" | "eye" | "flame";

const PATHS: Record<IconName, string> = {
  // A chevron with a tail, pointing the way.
  up: "M12 19V6M6 11l6-6 6 6",
  down: "M12 5v13M6 13l6 6 6-6",
  left: "M19 12H6M11 6l-6 6 6 6",
  right: "M5 12h13M13 6l6 6-6 6",
  // An arc over a gap, landing beyond it.
  jump: "M4 18c2-9 14-9 16 0M17 15l3 3 2-4M4 21h4M16 21h4",
  // An open hand reaching.
  interact:
    "M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13.5a1.6 1.6 0 0 1 2.6-1.8L8 14",
  // An hourglass.
  wait: "M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9",
  // A satchel.
  use: "M5 9h14l-1.5 11h-11L5 9zM9 9V6a3 3 0 0 1 6 0v3M9 13h6",
  // A folded map.
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14",
  // Three heads: the crowd.
  crowd:
    "M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12a2.5 2.5 0 1 0 0-5M18 12a2.5 2.5 0 1 0 0-5M6 20c0-3 2.7-5 6-5s6 2 6 5M2 19c0-2 1.5-3.5 4-4M22 19c0-2-1.5-3.5-4-4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  flame: "M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z",
};

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The icon for a vote. */
export function actionIcon(a: Action): IconName {
  switch (a.kind) {
    case "move":
      return a.dir;
    case "jump":
      return "jump";
    case "interact":
      return "interact";
    case "wait":
      return "wait";
    case "use":
      return "use";
  }
}
