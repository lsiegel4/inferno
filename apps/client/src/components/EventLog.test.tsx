import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventLog } from "./EventLog.js";
import { toRoman } from "./Header.js";

describe("EventLog", () => {
  it("lists hero turns without names, with outcomes and sign text", () => {
    render(
      <EventLog
        log={[
          { turn: 1, action: { kind: "move", dir: "up" } },
          { turn: 2, action: { kind: "move", dir: "right" }, outcome: "died" },
          { turn: 3, action: { kind: "interact" }, sign: "Mind the gap" },
        ]}
      />,
    );
    expect(screen.getByText("↑")).toBeTruthy();
    expect(screen.getByText("→ · the hero died")).toBeTruthy();
    expect(screen.getByText("Mind the gap")).toBeTruthy();
  });
});

describe("EventLog auto-scroll", () => {
  it("follows new turns inside its panel, without scrolling the page", () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView as never;
    try {
      const turn = (n: number) => ({ turn: n, action: { kind: "wait" as const } });
      const panel = document.createElement("div");
      panel.style.overflowY = "auto";
      Object.defineProperty(panel, "scrollHeight", { value: 500 });
      document.body.append(panel);
      const { rerender } = render(<EventLog log={[turn(1)]} />, { container: panel });
      rerender(<EventLog log={[turn(1), turn(2)]} />);
      expect(screen.getAllByText("wait")).toHaveLength(2);
      expect(panel.scrollTop).toBe(500);
      expect(scrollIntoView).not.toHaveBeenCalled();
      panel.remove();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe("toRoman", () => {
  it("numbers floors like Dante's circles", () => {
    expect([1, 4, 9, 14, 40].map(toRoman)).toEqual(["I", "IV", "IX", "XIV", "XL"]);
  });
});
