import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { viewFrom, welcome } from "../test-fixtures.js";
import { PauseOverlay } from "./PauseOverlay.js";

const paused = (you = { role: "player" as const, userId: "u1", handle: "ana" }) =>
  viewFrom(welcome({ you, presence: { active: 1, minimum: 3, spectators: 4, paused: true } }));

describe("PauseOverlay", () => {
  it("says how many more players are needed and offers Ready, share and an ad slot", async () => {
    const onReady = vi.fn();
    render(<PauseOverlay view={paused()} onReady={onReady} />);
    expect(screen.getByText(/2 more players needed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite friends" })).toBeTruthy();
    expect(screen.getByLabelText("Advertisement")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /ready/ }));
    expect(onReady).toHaveBeenCalled();
  });

  it("asks spectators to sign in instead of offering Ready", () => {
    render(<PauseOverlay view={paused({ role: "spectator" } as never)} onReady={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /ready/ })).toBeNull();
    expect(screen.getByText("Sign in to join in.")).toBeTruthy();
  });

  it("renders nothing while the game is running", () => {
    const { container } = render(<PauseOverlay view={viewFrom(welcome())} onReady={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});
