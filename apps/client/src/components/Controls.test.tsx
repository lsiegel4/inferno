import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { withMyVote } from "../game/store.js";
import { viewFrom, welcome } from "../test-fixtures.js";
import { Controls } from "./Controls.js";

describe("Controls", () => {
  it("votes with the D-pad and the contextual Interact button", async () => {
    const onVote = vi.fn();
    render(<Controls view={viewFrom(welcome())} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: "Move up" }));
    await userEvent.click(screen.getByRole("button", { name: "Pull" }));
    await userEvent.click(screen.getByRole("button", { name: "Wait" }));
    expect(onVote.mock.calls).toEqual([
      [{ kind: "move", dir: "up" }],
      [{ kind: "interact" }],
      [{ kind: "wait" }],
    ]);
  });

  it("locks after voting and says what you voted for", () => {
    render(<Controls view={withMyVote(viewFrom(welcome()), { kind: "jump" })} onVote={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Jump" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/You voted jump/)).toBeTruthy();
  });

  it("is disabled for spectators and while paused", () => {
    const { unmount } = render(
      <Controls view={viewFrom(welcome({ you: { role: "spectator" } }))} onVote={vi.fn()} />,
    );
    expect((screen.getByRole("button", { name: "Move up" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("Sign in to vote.")).toBeTruthy();
    unmount();
    const paused = welcome({ presence: { active: 1, minimum: 2, spectators: 0, paused: true } });
    render(<Controls view={viewFrom(paused)} onVote={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Move up" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("Use opens the inventory and votes use(itemId)", async () => {
    const onVote = vi.fn();
    render(
      <Controls
        view={viewFrom(welcome({ inventory: [{ id: "key-red", type: "key" }] }))}
        onVote={onVote}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Use/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "key" }));
    expect(onVote).toHaveBeenCalledWith({ kind: "use", itemId: "key-red" });
  });
});
