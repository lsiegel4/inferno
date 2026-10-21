import type { GameView } from "../game/store.js";
import { AdSlot } from "./AdSlot.js";
import { ShareButton } from "./ShareButton.js";

/** Shown over the map while paused (game design §5.3). Chat stays usable beside it. */
export function PauseOverlay({ view, onReady }: { view: GameView; onReady: () => void }) {
  const p = view.presence;
  if (!p?.paused || view.gameOver) return null;
  const needed = Math.max(0, p.minimum - p.active);
  const isPlayer = view.you?.role === "player";
  return (
    <div className="overlay pause" role="status">
      <h2>Paused</h2>
      <p>
        {needed === 1 ? "1 more player needed" : `${needed} more players needed`} to continue the
        descent.
      </p>
      {isPlayer ? (
        <button type="button" className="key primary" onClick={onReady}>
          I&rsquo;m ready
        </button>
      ) : (
        <p className="muted">Sign in to join in.</p>
      )}
      <ShareButton />
      <AdSlot placement="pause" />
    </div>
  );
}
