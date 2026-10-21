/**
 * Generic ad slot (ADR-0014). Placeholder until an ad network is wired up in Phase 7.
 * Never used during play; only on the pause screen and beside sign-in.
 */
export function AdSlot({ placement }: { placement: "pause" | "sign-in" }) {
  return (
    <aside className={`ad-slot ad-${placement}`} aria-label="Advertisement">
      <span>Advertisement</span>
    </aside>
  );
}
