import type { Action, Direction } from "@inferno/shared";
import { useState } from "react";
import { describeAction, interactLabel, sameAction } from "../game/interact.js";
import type { GameView } from "../game/store.js";

const ARROWS: Record<Direction, string> = { up: "▲", down: "▼", left: "◀", right: "▶" };

export interface ControlsProps {
  view: GameView;
  onVote: (action: Action) => void;
}

/** D-pad plus action column (game design §9.1). Each press is one vote for the current turn. */
export function Controls({ view, onVote }: ControlsProps) {
  const [menu, setMenu] = useState(false);
  const isPlayer = view.you?.role === "player";
  const paused = view.presence?.paused ?? true;
  const disabled = !isPlayer || paused || view.gameOver || view.myVote !== null;

  const button = (action: Action, label: string, className: string, aria?: string, off = false) => (
    <button
      key={JSON.stringify(action)}
      type="button"
      className={`key ${className}${sameAction(view.myVote, action) ? " chosen" : ""}`}
      disabled={disabled || off}
      aria-label={aria ?? label}
      onClick={() => onVote(action)}
    >
      {label}
    </button>
  );

  return (
    <section className="controls" aria-label="Controls">
      <div className="dpad">
        {(["up", "left", "right", "down"] as const).map((dir) =>
          button({ kind: "move", dir }, ARROWS[dir], `dir-${dir}`, `Move ${dir}`),
        )}
      </div>
      <div className="actions">
        {button({ kind: "interact" }, interactLabel(view), "primary")}
        {button({ kind: "jump" }, "Jump", "", undefined, !view.canJump)}
        <div className="use">
          <button
            type="button"
            className="key"
            disabled={disabled || view.inventory.length === 0}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            Use {view.inventory.length > 0 && <small>({view.inventory.length})</small>}
          </button>
          {menu && !disabled && (
            <ul className="use-menu" role="menu">
              {view.inventory.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onVote({ kind: "use", itemId: item.id });
                    }}
                  >
                    {item.type}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {button({ kind: "wait" }, "Wait", "")}
      </div>
      <p className="controls-hint" aria-live="polite">
        {!isPlayer
          ? "Sign in to vote."
          : view.myVote
            ? `You voted ${describeAction(view.myVote)}. Waiting for the turn.`
            : paused
              ? "Paused."
              : "One vote per turn. Keys: arrows/WASD, Space jump, E interact, Q wait, M map."}
      </p>
    </section>
  );
}
