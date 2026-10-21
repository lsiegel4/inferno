import { describe, expect, it } from "vitest";
import css from "../styles.css?raw";
import { PALETTE } from "./renderer.js";

/** The map and the interface share the Manuscript colours; this keeps them from drifting. */
describe("PALETTE", () => {
  it("matches the stylesheet's colour tokens", () => {
    const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    const pairs: [keyof typeof PALETTE, string][] = [
      ["void", "ink"],
      ["wallTop", "stone-light"],
      ["floorA", "floor"],
      ["lava", "lava"],
      ["ember", "ember"],
      ["bone", "bone"],
      ["teal", "verdigris"],
    ];
    for (const [key, name] of pairs) expect(PALETTE[key].toLowerCase(), key).toBe(token(name));
  });
});
