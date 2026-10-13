import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("toRoman", () => {
  it("numbers floors like Dante's circles", () => {
    expect([1, 4, 9, 14, 40].map(toRoman)).toEqual(["I", "IV", "IX", "XIV", "XL"]);
  });
});
