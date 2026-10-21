/**
 * The ember fuse at the heart of the D-pad: it lights when the first vote opens a turn, burns
 * down toward the tick's deadline, and flares when the turn resolves.
 */
import { useRef, type CSSProperties } from "react";
import type { GameView } from "../game/store.js";
import { Icon } from "./Icon.js";

/** The longest a tick stays open (server RULES.tickMaxMs). */
export const TICK_MS = 3_000;
const R = 26;
const C = 2 * Math.PI * R;

export function VoteFuse({ view }: { view: GameView }) {
  const { tally, turn } = view;
  // Fix the fuse's length the first time a tick is seen, so tally updates don't restart it.
  const lit = useRef<{ tick: number; remaining: number } | null>(null);
  if (tally && lit.current?.tick !== tally.tick) {
    const remaining = Math.max(0, Math.min(TICK_MS, Date.parse(tally.endsAt) - Date.now()));
    lit.current = { tick: tally.tick, remaining };
  }
  if (!tally) lit.current = null;
  const fuse = lit.current;
  const share = fuse ? fuse.remaining / TICK_MS : 0;

  return (
    <div className={`fuse${tally ? " burning" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="fuse-ring">
        <circle className="fuse-coil" cx="32" cy="32" r={R} />
        {fuse && (
          <g key={fuse.tick}>
            <circle
              className="fuse-burn"
              cx="32"
              cy="32"
              r={R}
              strokeDasharray={`${C} ${C}`}
              style={
                {
                  "--from": `${C * (1 - share)}`,
                  "--to": `${C}`,
                  "--dur": `${fuse.remaining}ms`,
                } as CSSProperties
              }
            />
            <g
              className="fuse-spark"
              style={
                {
                  "--a0": `${share * 360}deg`,
                  "--dur": `${fuse.remaining}ms`,
                } as CSSProperties
              }
            >
              <circle cx={32 + R} cy="32" r="3.2" />
              <circle cx={32 + R} cy="32" r="6" className="fuse-halo" />
            </g>
          </g>
        )}
      </svg>
      <div className="fuse-core">
        {tally ? (
          <span className="fuse-count">
            {tally.voted}
            <small>/{tally.active}</small>
          </span>
        ) : (
          <Icon name="flame" size={20} />
        )}
      </div>
      {/* A one-shot flare each time a turn resolves. */}
      <span key={turn} className="fuse-flare" />
    </div>
  );
}
