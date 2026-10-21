import { useEffect, useState } from "react";
import { describeAction } from "../game/interact.js";
import type { GameView } from "../game/store.js";

/** Live vote tally and countdown for the open tick. */
export function Tally({ view }: { view: GameView }) {
  const [now, setNow] = useState(() => Date.now());
  const tally = view.tally;
  useEffect(() => {
    if (!tally) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [tally]);

  if (!tally) {
    return <div className="tally idle">No votes yet this turn.</div>;
  }
  const left = Math.max(0, (Date.parse(tally.endsAt) - now) / 1000);
  const max = Math.max(...tally.counts.map((c) => c.votes));
  return (
    <div className="tally" aria-live="polite">
      <ul className="tally-counts">
        {tally.counts.map((c) => (
          <li key={JSON.stringify(c.action)} className={c.votes === max ? "lead" : ""}>
            {describeAction(c.action)} <b>{c.votes}</b>
          </li>
        ))}
      </ul>
      <span className="tally-meta">
        {tally.voted}/{tally.active} voted · {left.toFixed(1)}s
      </span>
    </div>
  );
}
