import { describe, expect, it } from "vitest";
import { TOOLS } from "./index.js";

describe("tools", () => {
  it("lists planned tools", () => {
    expect(TOOLS).toContain("floor-solver");
  });
});
