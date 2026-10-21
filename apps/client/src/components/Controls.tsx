import { actionKey, type Action, type Direction } from "@inferno/shared";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { describeAction, interactLabel, sameAction } from "../game/interact.js";
import type { GameView } from "../game/store.js";
import { Icon, type IconName } from "./Icon.js";
import { VoteFuse } from "./VoteFuse.js";

export interface ControlsProps {
  view: GameView;
  onVote: (action: Action) => void;
}

/**
 * D-pad plus action column (game design §9.1). Each press is one vote for the current turn; the
 * fuse in the middle burns while the crowd votes, and each key shows how much of the crowd leans
 * its way.
 */
export function Controls({ view, onVote }: ControlsProps) {
  const [menu, setMenu] = useState(false);
  const isPlayer = view.you?.role === "player";
  const paused = view.presence?.paused ?? true;
  const disabled = !isPlayer || paused || view.gameOver || view.myVote !== null;

  // The crowd's lean: each action's share of the active players.
  const lean = new Map<string, number>();
  const counts = view.tally?.counts ?? [];
  const top = Math.max(0, ...counts.map((c) => c.votes));
  for (const c of counts) {
    lean.set(actionKey(c.action), c.votes / Math.max(1, view.tally?.active ?? 1));
  }

  // When the crowd picked something else, your key flinches.
  const lastVote = useRef<Action | null>(null);
  const [overruled, setOverruled] = useState<{ turn: number; key: string } | null>(null);
  if (view.myVote) lastVote.current = view.myVote;
  useEffect(() => {
    const mine = lastVote.current;
    const taken = view.log.at(-1);
    lastVote.current = null;
    if (mine && taken && taken.turn === view.turn && !sameAction(mine, taken.action)) {
      setOverruled({ turn: view.turn, key: actionKey(mine) });
    }
  }, [view.turn]); // once per resolved turn

  const button = (
    action: Action,
    label: string,
    icon: IconName,
    className: string,
    aria?: string,
    off = false,
  ) => {
    const key = actionKey(action);
    const share = lean.get(key) ?? 0;
    const lead = share > 0 && counts.find((c) => actionKey(c.action) === key)?.votes === top;
    const classes = [
      "key",
      className,
      sameAction(view.myVote, action) ? "chosen" : "",
      lead ? "lead" : "",
      overruled?.key === key ? "overruled" : "",
    ].filter(Boolean);
    return (
      <button
        key={overruled?.key === key ? `${key}:${overruled.turn}` : key}
        type="button"
        className={classes.join(" ")}
        style={{ "--share": share } as CSSProperties}
        disabled={disabled || off}
        aria-label={aria ?? label}
        onClick={() => onVote(action)}
      >
        <Icon name={icon} />
        {!aria && <span className="key-label">{label}</span>}
      </button>
    );
  };

  return (
    <section className="controls" aria-label="Controls">
      <div className="dpad">
        {(["up", "left", "right", "down"] as Direction[]).map((dir) =>
          button({ kind: "move", dir }, dir, dir, `dir-${dir}`, `Move ${dir}`),
        )}
        <VoteFuse view={view} />
      </div>
      <div className="actions-wrap">
        <div className="actions">
          {button({ kind: "interact" }, interactLabel(view), "interact", "primary")}
          {button({ kind: "jump" }, "Jump", "jump", "", undefined, !view.canJump)}
          <div className="use">
            <button
              type="button"
              className="key"
              disabled={disabled || view.inventory.length === 0}
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              <Icon name="use" />
              <span className="key-label">
                Use {view.inventory.length > 0 && <small>({view.inventory.length})</small>}
              </span>
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
          {button({ kind: "wait" }, "Wait", "wait", "")}
        </div>
      </div>
      <p className="controls-hint" aria-live="polite">
        {!isPlayer ? (
          "Sign in to vote."
        ) : view.myVote ? (
          `You voted ${describeAction(view.myVote)}. Waiting for the crowd.`
        ) : paused ? (
          "Paused."
        ) : (
          <>
            <span className="hint-touch">Tap a key to cast your vote. One vote per turn.</span>
            <span className="hint-keys">
              One vote per turn. Arrows/WASD move · Space jump · E interact · Q wait · M map.
            </span>
          </>
        )}
      </p>
    </section>
  );
}
