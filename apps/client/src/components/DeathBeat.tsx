/** The moment the hero dies: the light goes red and the record says so, then the floor resets. */
import type { GameView } from "../game/store.js";

const LINES = ["The hero falls.", "The fire takes the hero.", "Darkness closes in."];

export function DeathBeat({ view }: { view: GameView }) {
  const last = view.log.at(-1);
  if (last?.outcome !== "died") return null;
  return (
    <div key={last.turn} className="death-beat" aria-hidden="true">
      <p>{LINES[last.turn % LINES.length]}</p>
    </div>
  );
}
