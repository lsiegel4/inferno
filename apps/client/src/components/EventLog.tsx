import { useEffect, useRef } from "react";
import { describeAction } from "../game/interact.js";
import type { LogEntry } from "../game/store.js";
import { actionIcon, Icon } from "./Icon.js";

const OUTCOMES: Record<string, string> = {
  died: "the hero died",
  floor_up: "climbed the stairs",
  floor_down: "went back down",
  fell: "fell through a pit",
  no_effect: "nothing happened",
};

export function describeEntry(e: LogEntry): string {
  const outcome = e.outcome ? ` · ${OUTCOMES[e.outcome] ?? e.outcome}` : "";
  return `${describeAction(e.action)}${outcome}`;
}

/** The turn in words, for the record ("down", "interact · the hero died"). */
export function entryWords(e: LogEntry): string {
  const outcome = e.outcome ? ` · ${OUTCOMES[e.outcome] ?? e.outcome}` : "";
  const a = e.action;
  return `${a.kind === "move" ? a.dir : a.kind === "use" ? `use ${a.itemId}` : a.kind}${outcome}`;
}

/** Hero turns, without player names (game design §9.3). */
/** The nearest ancestor that scrolls vertically (the record's panel). */
function scrollBox(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
}

export function EventLog({ log }: { log: LogEntry[] }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Follow the newest turn by scrolling the record's own panel only. (scrollIntoView would
    // also scroll the page, dragging the screen down to the controls on every turn.)
    const box = scrollBox(list.current);
    if (box) box.scrollTop = box.scrollHeight;
  }, [log.length]);
  if (log.length === 0)
    return <p className="empty">No turns yet. Every hero move is recorded here.</p>;
  return (
    <ol ref={list} className="log">
      {log.map((e) => (
        <li
          key={e.turn}
          className={e.outcome === "died" ? "bad" : e.outcome === "floor_up" ? "good" : ""}
        >
          <span className="turn-no">{e.turn}</span>
          <span className="log-entry">
            <span className="log-act">
              <Icon name={actionIcon(e.action)} size={16} />
              <span>{entryWords(e)}</span>
            </span>
            {e.sign && <q className="sign-text">{e.sign}</q>}
          </span>
        </li>
      ))}
    </ol>
  );
}
