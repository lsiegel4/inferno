import { describe, expect, it } from "vitest";
import { describeServer } from "./index.js";

describe("server", () => {
  it("links against the shared package", () => {
    expect(describeServer()).toContain("protocol v1");
  });
});
