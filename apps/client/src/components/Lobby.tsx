/**
 * The way in: the live state of the descent (which circle the crowd is on, how many are playing,
 * whether it waits for more), and a door to enter by. The game behind it is already connected,
 * so the numbers are live. Pausing is still the pause screen's job, inside the game.
 */
import type { CSSProperties } from "react";
import type { Me } from "../net/api.js";
import type { GameView } from "../game/store.js";
import { Account } from "./Account.js";
import { toRoman } from "./Header.js";
import { Icon } from "./Icon.js";

export interface LobbyProps {
  view: GameView;
  connected: boolean;
  me: Me | null;
  googleClientId: string;
  onAccountChange: (me: Me | null) => void;
  onEnter: () => void;
}

export function Lobby({
  view,
  connected,
  me,
  googleClientId,
  onAccountChange,
  onEnter,
}: LobbyProps) {
  const p = view.presence;
  const needed = p ? Math.max(0, p.minimum - p.active) : 0;
  const status = !connected
    ? "Listening at the gate…"
    : view.gameOver
      ? "The crowd has reached the bottom of the Inferno."
      : p?.paused
        ? needed === 1
          ? "The descent waits for one more soul."
          : `The descent waits for ${needed} more souls.`
        : "The descent is under way.";

  return (
    <div className="lobby" role="dialog" aria-modal="true" aria-labelledby="lobby-title">
      <div className="lobby-embers" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="lobby-card">
        <p className="lobby-kicker">Abandon all hope</p>
        <h1 id="lobby-title" className="lobby-title">
          Inferno
        </h1>
        <p className="lobby-lede">
          One hero. One crowd. Every move is a vote, and the crowd must agree on the way down.
        </p>

        <dl className="lobby-stats" aria-live="polite">
          <div>
            <dt>Circle</dt>
            <dd className="roman">{view.floor ? toRoman(view.floor.index) : "—"}</dd>
          </div>
          <div>
            <dt>Playing</dt>
            <dd>{p ? p.active : "—"}</dd>
          </div>
          <div>
            <dt>Watching</dt>
            <dd>{p ? p.spectators : "—"}</dd>
          </div>
        </dl>
        {view.floor?.name && <p className="lobby-floor">{view.floor.name}</p>}
        <p className={`lobby-status${p?.paused ? " waiting" : ""}`}>
          <span className="lobby-dot" aria-hidden="true" />
          {status}
        </p>

        <button type="button" className="key primary lobby-enter" onClick={onEnter}>
          <Icon name={me ? "flame" : "eye"} />
          <span className="key-label">{me ? "Enter the Inferno" : "Watch the descent"}</span>
        </button>
        {!me && (
          <div className="lobby-account">
            <Account me={me} googleClientId={googleClientId} onChange={onAccountChange} />
          </div>
        )}
        {me && (
          <p className="lobby-me">
            Playing as <b>{me.handle}</b>
          </p>
        )}
      </div>
    </div>
  );
}
