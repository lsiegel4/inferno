import { useEffect, useRef } from "react";
import { describeAction } from "../game/interact.js";
import type { LogEntry } from "../game/store.js";

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

/** Hero turns, without player names (game design §9.3). */
export function EventLog({ log }: { log: LogEntry[] }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must
    // return nothing or a cleanup function.
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [log.length]);
  if (log.length === 0)
    return <p className="empty">No turns yet. Every hero move is recorded here.</p>;
  return (
    <ol className="log">
      {log.map((e) => (
        <li
          key={e.turn}
          className={e.outcome === "died" ? "bad" : e.outcome === "floor_up" ? "good" : ""}
        >
          <span className="turn-no">{e.turn}</span>
          <span>
            {describeEntry(e)}
            {e.sign && <q className="sign-text">{e.sign}</q>}
          </span>
        </li>
      ))}
      <li ref={end} aria-hidden="true" className="log-end" />
    </ol>
  );
}
