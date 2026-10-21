import { describeAction } from "../game/interact.js";
import type { GameView } from "../game/store.js";

/**
 * The turn's state in words: who has voted, and (for screen readers) the live counts. The fuse
 * in the controls shows the same thing at a glance.
 */
export function Tally({ view }: { view: GameView }) {
  const tally = view.tally;
  if (!tally) {
    return (
      <div className="tally idle" aria-live="polite">
        The first vote lights the fuse.
      </div>
    );
  }
  const max = Math.max(...tally.counts.map((c) => c.votes));
  const lead = tally.counts.filter((c) => c.votes === max).map((c) => describeAction(c.action));
  return (
    <div className="tally" aria-live="polite">
      <span>
        The crowd leans <b>{lead.join(" or ")}</b>
      </span>
      <span className="tally-meta">
        {tally.voted} of {tally.active} voted
      </span>
      <ul className="sr-only">
        {tally.counts.map((c) => (
          <li key={JSON.stringify(c.action)}>
            {describeAction(c.action)}: {c.votes}
          </li>
        ))}
      </ul>
    </div>
  );
}
