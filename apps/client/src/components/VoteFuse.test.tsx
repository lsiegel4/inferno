import { PROTOCOL_VERSION, type ServerMessage } from "@inferno/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { viewFrom, welcome } from "../test-fixtures.js";
import { FloorTransition } from "./FloorTransition.js";
import { Tally } from "./Tally.js";
import { VoteFuse } from "./VoteFuse.js";

const tally: ServerMessage = {
  v: PROTOCOL_VERSION,
  type: "tally",
  data: {
    tick: 3,
    endsAt: new Date(Date.now() + 2_000).toISOString(),
    voted: 4,
    active: 9,
    counts: [
      { action: { kind: "move", dir: "up" }, votes: 3 },
      { action: { kind: "wait" }, votes: 1 },
    ],
  },
};

describe("the vote fuse and tally", () => {
  it("are unlit until the first vote", () => {
    const view = viewFrom(welcome());
    const { container } = render(<VoteFuse view={view} />);
    expect(container.querySelector(".fuse-burn")).toBeNull();
    render(<Tally view={view} />);
    expect(screen.getByText("The first vote lights the fuse.")).toBeTruthy();
  });

  it("burn while the crowd votes and show who is ahead", () => {
    const view = viewFrom(welcome(), tally);
    const { container } = render(<VoteFuse view={view} />);
    expect(container.querySelector(".fuse-burn")).toBeTruthy();
    expect(container.querySelector(".fuse-count")?.textContent).toBe("4/9");
    render(<Tally view={view} />);
    expect(screen.getByText("4 of 9 voted")).toBeTruthy();
    expect(screen.getByText("↑", { selector: "b" })).toBeTruthy();
  });
});

describe("FloorTransition", () => {
  it("announces the circle's numeral and name on arrival", () => {
    const view = viewFrom(
      welcome({
        floor: {
          floorId: "limbo",
          index: 4,
          name: "Limbo",
          width: 3,
          height: 3,
          tiles: "###\n#S#\n###",
          explored: "###\n#S#\n###",
          entities: [],
          minimumPlayers: 2,
        },
        hero: { x: 1, y: 1, facing: "up" },
      }),
    );
    render(<FloorTransition view={view} />);
    expect(screen.getByText("IV")).toBeTruthy();
    expect(screen.getByText("Limbo")).toBeTruthy();
    expect(screen.getByText("You enter")).toBeTruthy();
  });
});

describe("DeathBeat", () => {
  it("writes a line when the last turn killed the hero, and nothing otherwise", async () => {
    const { DeathBeat } = await import("./DeathBeat.js");
    const turn = (outcome?: "died"): ServerMessage => ({
      v: PROTOCOL_VERSION,
      type: "turn",
      data: {
        turn: 4,
        action: { kind: "wait" },
        hero: { x: 2, y: 1, facing: "up" },
        canJump: false,
        changes: [],
        ...(outcome ? { outcome } : {}),
      },
    });
    const { container, rerender } = render(<DeathBeat view={viewFrom(welcome(), turn())} />);
    expect(container.querySelector(".death-beat")).toBeNull();
    rerender(<DeathBeat view={viewFrom(welcome(), turn("died"))} />);
    expect(container.querySelector(".death-beat p")?.textContent).toMatch(/hero|Darkness/);
  });
});
