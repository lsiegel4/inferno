import type { GameView } from "../game/store.js";

export function Header({ view }: { view: GameView }) {
  const p = view.presence;
  return (
    <header className="header">
      <div>
        <h1 className="title">Inferno</h1>
        {view.floor?.name && <p className="floor-name">{view.floor.name}</p>}
      </div>
      <dl className="stats">
        <div>
          <dt>Floor</dt>
          <dd>{view.floor ? toRoman(view.floor.index) : "—"}</dd>
        </div>
        <div>
          <dt>Playing</dt>
          <dd>{p ? p.active : "—"}</dd>
        </div>
        <div>
          <dt>Watching</dt>
          <dd>{p ? p.spectators : "—"}</dd>
        </div>
        <div>
          <dt>Needed</dt>
          <dd>{p ? p.minimum : "—"}</dd>
        </div>
      </dl>
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
