import { describe, expect, it } from "vitest";
import { viewFrom, welcome } from "../test-fixtures.js";
import { interactLabel } from "./interact.js";

describe("interact label", () => {
  it("names what the hero faces", () => {
    expect(interactLabel(viewFrom(welcome()))).toBe("Pull");
  });

  it("falls back to Interact when facing nothing", () => {
    expect(interactLabel(viewFrom(welcome({ hero: { x: 2, y: 1, facing: "left" } })))).toBe(
      "Interact",
    );
  });

  it("labels items and signs", () => {
    const floor = (kind: string, state: Record<string, unknown>) =>
      welcome({
        floor: {
          floorId: "f1",
          index: 1,
          width: 5,
          height: 3,
          tiles: "#####\n#.S.#\n#####",
          explored: "#####\n#.S.#\n#####",
          entities: [{ id: "x", kind, x: 3, y: 1, state }],
          minimumPlayers: 1,
        },
      });
    expect(interactLabel(viewFrom(floor("item", { item: "torch" })))).toBe("Take torch");
    expect(interactLabel(viewFrom(floor("sign", { text: "hi" })))).toBe("Read");
  });
});
