import { describe, expect, it } from "vitest";
import { HeroMotion, moveKind } from "./motion.js";

describe("moveKind", () => {
  it("tells steps, jumps, slides and cuts apart", () => {
    expect(moveKind({ x: 1, y: 1 }, { x: 2, y: 1 }, "move", false)).toBe("step");
    expect(moveKind({ x: 1, y: 1 }, { x: 3, y: 1 }, "jump", false)).toBe("jump");
    expect(moveKind({ x: 1, y: 1 }, { x: 5, y: 1 }, "move", false)).toBe("slide");
    expect(moveKind({ x: 1, y: 1 }, { x: 4, y: 6 }, "move", false)).toBe("snap"); // a portal
    expect(moveKind({ x: 1, y: 1 }, { x: 2, y: 1 }, "move", true)).toBe("snap"); // a death
  });
});

describe("HeroMotion", () => {
  it("eases a step and arcs a jump", () => {
    const m = new HeroMotion();
    m.moveTo(1, 1, "snap", 0);
    m.moveTo(2, 1, "step", 1000);
    const mid = m.at(1060);
    expect(mid.x).toBeGreaterThan(1);
    expect(mid.x).toBeLessThan(2);
    expect(m.at(2000)).toEqual({ x: 2, y: 1, lift: 0 });

    m.moveTo(4, 1, "jump", 3000);
    expect(m.at(3160).lift).toBeGreaterThan(0.3); // top of the arc
    expect(m.at(4000).lift).toBe(0);
  });

  it("cuts straight to the target the first time and on a snap", () => {
    const m = new HeroMotion();
    m.moveTo(5, 5, "step", 0);
    expect(m.at(0)).toEqual({ x: 5, y: 5, lift: 0 });
    m.moveTo(9, 2, "snap", 10);
    expect(m.at(10)).toEqual({ x: 9, y: 2, lift: 0 });
  });
});
