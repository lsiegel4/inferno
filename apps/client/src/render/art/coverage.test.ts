import { describe, expect, it } from "vitest";
import { loadFloors } from "../../lab/floors.js";
import { drawFigureArt } from "./figures.js";
import { drawThingArt } from "./things.js";

/** A canvas context that accepts every call and draws nothing (jsdom has no canvas). */
function nullContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, prop) => {
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "measureText") return () => ({ width: 0 });
      return () => {};
    },
    set: () => true,
  });
}

describe("the art", () => {
  it("draws every kind of thing the floors contain (no placeholder ever shows)", () => {
    const kinds = new Set(loadFloors().flatMap((f) => f.entities.map((e) => e.kind)));
    // Made during play, or how other things look to clients:
    for (const k of ["bridge", "crack", "item"]) kinds.add(k);
    const ctx = nullContext();
    const missing = [...kinds].filter((kind) => {
      const e = { id: kind, kind, x: 1, y: 1, state: {} };
      return !(
        drawFigureArt(ctx, e, 0, 0, 64, 0, { x: 2, y: 2 }, 0) || drawThingArt(ctx, e, 0, 0, 64, 0)
      );
    });
    expect(missing).toEqual([]);
  });
});
