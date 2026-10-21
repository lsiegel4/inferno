import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { viewFrom, welcome } from "../test-fixtures.js";
import { Lobby } from "./Lobby.js";

const props = { googleClientId: "", onAccountChange: vi.fn() };

describe("Lobby", () => {
  it("shows the live descent and lets a player enter", async () => {
    const onEnter = vi.fn();
    const view = viewFrom(
      welcome({ presence: { active: 11, minimum: 2, spectators: 3, paused: false } }),
    );
    render(
      <Lobby {...props} view={view} connected me={{ id: "u1", handle: "ana" }} onEnter={onEnter} />,
    );
    expect(screen.getByText("11")).toBeTruthy();
    expect(screen.getByText("The descent is under way.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Enter the Inferno" }));
    expect(onEnter).toHaveBeenCalled();
  });

  it("says how many more souls a paused descent needs, and offers watching when signed out", () => {
    const view = viewFrom(
      welcome({ presence: { active: 3, minimum: 5, spectators: 0, paused: true } }),
    );
    render(<Lobby {...props} view={view} connected me={null} onEnter={vi.fn()} />);
    expect(screen.getByText("The descent waits for 2 more souls.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Watch the descent" })).toBeTruthy();
  });
});
