import { describe, expect, it } from "vitest";
import type { Action } from "../protocol.js";
import { resolveVotes, tallyVotes } from "./votes.js";

const up: Action = { kind: "move", dir: "up" };
const left: Action = { kind: "move", dir: "left" };
const useKey: Action = { kind: "use", itemId: "key-red" };

describe("votes", () => {
  it("no votes means no turn", () => {
    expect(resolveVotes([], Math.random)).toBeNull();
  });

  it("plurality wins", () => {
    expect(resolveVotes([up, left, left], () => 0)).toEqual(left);
  });

  it("ties are broken by random selection among the tied options", () => {
    const votes = [up, left];
    expect(resolveVotes(votes, () => 0)).toEqual(up);
    expect(resolveVotes(votes, () => 0.99)).toEqual(left);
  });

  it("each use(itemId) is its own option, and invalid actions are counted", () => {
    const useTorch: Action = { kind: "use", itemId: "torch-1" };
    expect(tallyVotes([useKey, useTorch, useKey])).toEqual([
      { action: useKey, votes: 2 },
      { action: useTorch, votes: 1 },
    ]);
    expect(resolveVotes([useKey], () => 0)).toEqual(useKey);
  });
});
