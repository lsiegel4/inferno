import type { GameView } from "../game/store.js";
import { AdSlot } from "./AdSlot.js";
import { ShareButton } from "./ShareButton.js";

/**
 * Shown over the map while paused (game design §5.3): the way is sealed until enough souls are
 * here. A row of flames counts them in. Chat stays usable beside it.
 */
export function PauseOverlay({ view, onReady }: { view: GameView; onReady: () => void }) {
  const p = view.presence;
  if (!p?.paused || view.gameOver) return null;
  const needed = Math.max(0, p.minimum - p.active);
  const isPlayer = view.you?.role === "player";
  const souls = Math.min(p.minimum, 20);
  return (
    <div className="overlay pause" role="status">
      <div className="plate">
        <p className="plate-kicker">The way is sealed</p>
        <h2>Paused</h2>
        <ol className="souls" aria-hidden="true">
          {Array.from({ length: souls }, (_, i) => (
            <li key={i} className={i < p.active ? "lit" : ""} />
          ))}
        </ol>
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
      </div>
      <AdSlot placement="pause" />
    </div>
  );
}
