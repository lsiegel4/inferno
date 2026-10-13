import { useEffect, useState } from "react";
import type { GameView } from "../game/store.js";

/** A sign's text, shown to everyone for 2 seconds (game design §7a). */
export function SignOverlay({ view }: { view: GameView }) {
  const [, force] = useState(0);
  const sign = view.sign;
  useEffect(() => {
    if (!sign) return;
    const id = setTimeout(() => force((n) => n + 1), Math.max(0, sign.until - Date.now()));
    return () => clearTimeout(id);
  }, [sign]);
  if (!sign || Date.now() >= sign.until) return null;
  return (
    <div className="overlay sign" role="status">
      <p>{sign.text}</p>
    </div>
  );
}
