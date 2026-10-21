import type { GameView } from "../game/store.js";
import { Icon } from "./Icon.js";

export interface HeaderProps {
  view: GameView;
  /** Open the record and chat (a sheet on small screens). */
  onOpenSide?: () => void;
  sideOpen?: boolean;
}

/** The top bar: the circle you are on, and the crowd descending with you. */
export function Header({ view, onOpenSide, sideOpen = false }: HeaderProps) {
  const p = view.presence;
  const needed = p ? Math.max(0, p.minimum - p.active) : 0;
  return (
    <header className="topbar">
      <p className="brand">Inferno</p>
      <div className="circle">
        <span className="circle-numeral" aria-label={`Floor ${view.floor?.index ?? ""}`}>
          {view.floor ? toRoman(view.floor.index) : "—"}
        </span>
        <span className="circle-name">{view.floor?.name ?? "The descent"}</span>
      </div>
      <dl className="crowd" aria-label="The crowd">
        <div className="crowd-chip">
          <dt>
            <Icon name="crowd" size={18} />
            <span className="sr-only">Playing</span>
          </dt>
          <dd>
            {p ? p.active : "—"}
            <span className="crowd-unit"> playing</span>
          </dd>
        </div>
        <div className="crowd-chip quiet">
          <dt>
            <Icon name="eye" size={18} />
            <span className="sr-only">Watching</span>
          </dt>
          <dd>
            {p ? p.spectators : "—"}
            <span className="crowd-unit"> watching</span>
          </dd>
        </div>
        {needed > 0 && (
          <div className="crowd-chip warn">
            <dt className="sr-only">Needed</dt>
            <dd>needs {needed} more</dd>
          </div>
        )}
      </dl>
      {onOpenSide && (
        <button
          type="button"
          className="topbar-button side-toggle"
          aria-expanded={sideOpen}
          aria-label="Record and chat"
          onClick={onOpenSide}
        >
          <Icon name="scroll" size={20} />
        </button>
      )}
    </header>
  );
}

/** Floors are numbered in Roman numerals, like the circles of Dante's Inferno. */
export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
