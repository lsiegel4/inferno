import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { App } from "./App.js";

describe("client", () => {
  it("renders the placeholder app", () => {
    expect(renderToString(<App />)).toContain("Inferno");
  });
});
