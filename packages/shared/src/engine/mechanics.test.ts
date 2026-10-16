import { describe, expect, it } from "vitest";
import { parseFloor, type FloorDef, type Reveal } from "../floor.js";
import type { Action } from "../protocol.js";
import { createGame, validateFloorSet } from "./game.js";
import { applyTurn } from "./turn.js";
import type { Crowd, GameState } from "./types.js";
import { toFloorState } from "./view.js";

const up: Action = { kind: "move", dir: "up" };
const down: Action = { kind: "move", dir: "down" };
const left: Action = { kind: "move", dir: "left" };
const right: Action = { kind: "move", dir: "right" };
const wait: Action = { kind: "wait" };
const jump: Action = { kind: "jump" };
const interact: Action = { kind: "interact" };
const use = (itemId: string): Action => ({ kind: "use", itemId });

type Legend = Record<string, Record<string, unknown>>;

function floor(index: number, rows: string[], legend: Legend = {}, reveal?: Reveal): FloorDef {
  return parseFloor(rows.join("\n"), {
    id: `f${index}`,
    index,
    minimumPlayers: 1,
    legend,
    ...(reveal ? { reveal } : {}),
  });
}

const game = (rows: string[], legend: Legend = {}, reveal?: Reveal) =>
  createGame([floor(1, rows, legend, reveal)]);

function play(state: GameState, actions: (Action | [Action, Crowd])[]) {
  let s = state;
  let r = null as ReturnType<typeof applyTurn> | null;
  for (const a of actions) {
    r = Array.isArray(a) ? applyTurn(s, a[0], a[1]) : applyTurn(s, a);
    s = r.state;
  }
  return r!;
}

const pos = (s: GameState) => [s.hero.x, s.hero.y] as const;
const entity = (s: GameState, id: string) =>
  s.floors[s.currentFloor]!.entities.find((e) => e.id === id)!;
const at = (s: GameState, id: string) => [entity(s, id).x, entity(s, id).y] as const;
const dissent = (a: Action, support = 0.6): Crowd => ({ support, dissent: a });

describe("turn order", () => {
  it("the hero acts first, then the world moves, even on a no-effect turn", () => {
    const s = game(["#######", "#S...p#", "#######"], {
      p: { id: "p", kind: "patrol", route: "LR" },
    });
    const r = applyTurn(s, interact); // nothing to interact with
    expect(r.outcome).toBe("no_effect");
    expect(at(r.state, "p")).toEqual([4, 1]);
  });
});

describe("ice", () => {
  it("the hero slides until something stops it", () => {
    const s = game(["#######", "#SIII.#", "#######"]);
    expect(pos(applyTurn(s, right).state)).toEqual([5, 1]);
  });

  it("stops against a wall while still on ice", () => {
    const s = game(["######", "#SIII#", "######"]);
    expect(pos(applyTurn(s, right).state)).toEqual([4, 1]);
  });

  it("sliding into lava kills", () => {
    const s = game(["######", "#SIIL#", "######"]);
    expect(applyTurn(s, right).outcome).toBe("died");
  });

  it("a pushed block slides across ice and fills the lava at the end", () => {
    const s = game(["########", "#SbIIL.#", "########"], { b: { id: "b", kind: "block" } });
    const r = applyTurn(s, right);
    expect(at(r.state, "b")).toEqual([5, 1]);
    expect(entity(r.state, "b").state.filled).toBe(true);
  });
});

describe("legend 'on'", () => {
  it("puts the named terrain under an entity", () => {
    const f = floor(1, ["#####", "#Sp.#", "#####"], {
      p: { id: "p", kind: "plate", targets: ["p"], on: "I" },
    });
    expect(f.terrain[1]).toBe("#SI.#");
  });
});

describe("platforms", () => {
  const legend = { f: { id: "ferry", kind: "platform", dir: "right", on: "L" } };

  it("shuttle across lava and turn back at the far shore", () => {
    let s = createGame([floor(1, ["#######", "#SfLL.#", "#######"], legend)]);
    const xs: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = applyTurn(s, wait).state;
      xs.push(entity(s, "ferry").x);
    }
    expect(xs).toEqual([3, 4, 3, 2, 3]);
  });

  it("carry the hero standing on them", () => {
    const s = createGame([floor(1, ["#######", "#SfLL.#", "#######"], legend)]);
    // Step on (the ferry then moves right with the hero), ride, step off on the far shore.
    const r = play(s, [right, wait, right]);
    expect(r.outcome).toBeUndefined();
    expect(pos(r.state)).toEqual([5, 1]);
  });

  it("lava where the platform was is deadly again", () => {
    const s = createGame([floor(1, ["#######", "#S.fL.#", "#######"], legend)]);
    const r = play(s, [right, right]); // the ferry has moved on to (4,1); (3,1) is lava
    expect(r.outcome).toBe("died");
  });
});

describe("fire vents", () => {
  const legend = { v: { id: "v", kind: "vent", period: 2, burn: 1 } };

  it("burn a hero who ends the turn on them while raised", () => {
    const s = game(["######", "#Sv.U#", "######"], legend);
    // Vent starts raised (t=0); after the first world step it is down, so stepping on is safe.
    const r1 = applyTurn(s, right);
    expect(r1.outcome).toBeUndefined();
    expect(entity(r1.state, "v").state.up).toBe(false);
    const r2 = applyTurn(r1.state, wait); // it rises with the hero on it
    expect(r2.outcome).toBe("died");
  });

  it("can be crossed with the right timing", () => {
    const s = game(["######", "#Sv.U#", "######"], legend);
    expect(play(s, [right, right, right]).outcome).toBe("floor_up");
  });

  it("telegraph the next state", () => {
    const s = game(["#####", "#Sv.#", "#####"], legend);
    expect(entity(s, "v").state).toMatchObject({ up: true, next: false });
  });
});

describe("patrols", () => {
  it("walk their route and kill on contact", () => {
    const s = game(["#######", "#S..p.#", "#######"], {
      p: { id: "p", kind: "patrol", route: "LLRR" },
    });
    expect(at(applyTurn(s, wait).state, "p")).toEqual([3, 1]);
    expect(play(s, [right, wait]).outcome).toBe("died"); // it walks into the hero at (2,1)
  });

  it("kill a hero who walks into them", () => {
    const s = game(["#####", "#Sp.#", "#####"], { p: { id: "p", kind: "patrol", route: "W" } });
    expect(applyTurn(s, right).outcome).toBe("died");
  });

  it("can be jumped over", () => {
    const s = game(["######", "#Sp..#", "######"], { p: { id: "p", kind: "patrol", route: "W" } });
    const turned = applyTurn(s, { kind: "move", dir: "up" }).state; // face up (wall)
    expect(turned.hero.facing).toBe("up");
    const facing = { ...turned, hero: { ...turned.hero, facing: "right" as const } };
    const r = applyTurn(facing, jump);
    expect(r.outcome).toBeUndefined();
    expect(pos(r.state)).toEqual([3, 1]);
  });

  it("wait when blocked, so a block pins them", () => {
    const s = game(["########", "#S.b..p#", "########"], {
      b: { id: "b", kind: "block" },
      p: { id: "p", kind: "patrol", route: "L" },
    });
    // The hero pushes the block into (4,1) just before the patrol would step there.
    const r = play(s, [right, right]);
    expect(at(r.state, "b")).toEqual([4, 1]);
    const later = play(r.state, [wait, wait, wait]);
    expect(at(later.state, "p")).toEqual([5, 1]);
  });

  it("press plates", () => {
    const s = game(["#######", "#S.q.p#", "###A###"], {
      q: { id: "q", kind: "plate", targets: ["A"] },
      p: { id: "p", kind: "patrol", route: "LLRR" },
      A: { id: "A", kind: "door" },
    });
    const r = play(s, [wait, wait]);
    expect(at(r.state, "p")).toEqual([3, 1]);
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("do not reveal their route to clients", () => {
    const s = game(["#####", "#Sp.#", "#####"], { p: { id: "p", kind: "patrol", route: "RL" } });
    const e = toFloorState(s).entities.find((x) => x.id === "p")!;
    expect(e.state).toEqual({ next: "right" });
  });
});

describe("statues", () => {
  const legend = { w: { id: "w", kind: "statue" } };

  it("stay still while watched", () => {
    const s = game(["#######", "#S...w#", "#######"], legend);
    const faced = applyTurn(s, right).state; // facing right, statue ahead
    expect(at(faced, "w")).toEqual([5, 1]);
    expect(at(applyTurn(faced, wait).state, "w")).toEqual([5, 1]);
  });

  it("creep toward the hero when it looks away, and kill on reaching it", () => {
    const s = game(["#######", "#S..w.#", "#######"], legend); // hero faces up: statue beside
    const r1 = applyTurn(s, wait);
    expect(at(r1.state, "w")).toEqual([3, 1]);
    const r2 = applyTurn(r1.state, wait);
    expect(at(r2.state, "w")).toEqual([2, 1]);
    expect(applyTurn(r2.state, wait).outcome).toBe("died");
  });

  it("can be pushed while watched and fill lava", () => {
    const s = game(["#######", "#S.wL.#", "#######"], legend);
    const r = play(s, [right, right]);
    expect(entity(r.state, "w").state.filled).toBe(true);
    expect(pos(r.state)).toEqual([3, 1]);
  });

  it("do not move in the dark even when in front... they move: unlit is unwatched", () => {
    const s = game(["##########", "#S......w#", "##########"], legend, {
      mode: "torchlight",
      radius: 2,
    });
    const r = applyTurn(s, right);
    expect(at(r.state, "w")).toEqual([7, 1]);
  });

  it("weigh down plates", () => {
    const s = game(["#######", "#S.qw.#", "###A###"], {
      ...legend,
      q: { id: "q", kind: "plate", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    const r = applyTurn(s, wait); // facing up: the statue steps left onto the plate
    expect(at(r.state, "w")).toEqual([3, 1]);
    expect(entity(r.state, "A").state.open).toBe(true);
  });
});

describe("the echo (Shade of Dissent)", () => {
  const legend = { e: { id: "e", kind: "echo" } };

  it("performs the runner-up vote", () => {
    const s = game(["#######", "#S..e.#", "#######"], legend);
    const r = applyTurn(s, wait, dissent(right));
    expect(at(r.state, "e")).toEqual([5, 1]);
  });

  it("stands still when the crowd agrees", () => {
    const s = game(["#######", "#S..e.#", "#######"], legend);
    expect(at(applyTurn(s, right).state, "e")).toEqual([4, 1]);
  });

  it("presses a plate the hero cannot reach at the same time", () => {
    const s = game(["#########", "#S.A..pe#", "#########"], {
      ...legend,
      p: { id: "p", kind: "plate", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    const r = applyTurn(s, wait, dissent(left));
    expect(at(r.state, "e")).toEqual([6, 1]);
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("dissolves in lava and re-forms at home without resetting the floor", () => {
    const s = game(["########", "#Sa.Le.#", "#####A##"], {
      ...legend,
      a: { id: "a", kind: "lever", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    const moved = applyTurn(s, wait, dissent(right)).state;
    expect(at(moved, "e")).toEqual([6, 1]);
    const r = play(moved, [
      [wait, dissent(left)],
      [wait, dissent(left)],
    ]);
    expect(at(r.state, "e")).toEqual([5, 1]);
    expect(r.events).toContainEqual({ type: "echo_dissolved", entityId: "e" });
    expect(r.outcome).toBeUndefined();
  });

  it("springs hidden traps and reveals them", () => {
    const s = game(["#######", "#S..et#", "#######"], { ...legend, t: { id: "t", kind: "trap" } });
    const r = applyTurn(s, wait, dissent(right));
    expect(entity(r.state, "t").state.discovered).toBe(true);
    expect(at(r.state, "e")).toEqual([4, 1]);
  });

  it("pulls levers", () => {
    const s = game(["#######", "#S..e.#", "####a##", "####A##"], {
      ...legend,
      a: { id: "a", kind: "lever", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    const r = play(s, [
      [wait, dissent(down)],
      [wait, dissent(interact)],
    ]);
    expect(entity(r.state, "a").state.pulled).toBe(true);
  });
});

describe("hidden traps", () => {
  it("are not sent to clients until sprung, then stay revealed through deaths", () => {
    const s = game(["######", "#St.U#", "######"], { t: { id: "t", kind: "trap" } });
    expect(toFloorState(s).entities).toEqual([]);
    const r = applyTurn(s, right);
    expect(r.outcome).toBe("died");
    expect(entity(r.state, "t").state.discovered).toBe(true);
    expect(toFloorState(r.state).entities.map((e) => e.kind)).toEqual(["trap"]);
  });

  it("with a hint look exactly like a harmless crack", () => {
    const s = game(["#######", "#Stc.U#", "#######"], {
      t: { id: "t", kind: "trap", hint: true },
      c: { id: "c", kind: "crack" },
    });
    const kinds = toFloorState(s).entities.map((e) => [e.kind, e.state]);
    expect(kinds).toEqual([
      ["crack", {}],
      ["crack", {}],
    ]);
  });

  it("can drop the hero to a lower floor", () => {
    const f1 = floor(1, ["#####", "#S.U#", "#####"]);
    const f2 = floor(2, ["#####", "#St.#", "#####"], {
      t: { id: "t", kind: "trap", effect: "fall", landing: { floor: "f1", x: 2, y: 1 } },
    });
    let s = createGame([f1, f2]);
    s = play(s, [right, right]).state; // climb to f2
    const r = applyTurn(s, right);
    expect(r.outcome).toBe("fell");
    expect(r.state.currentFloor).toBe("f1");
  });

  it("a pushed block falls in, fills it and reveals it", () => {
    const s = game(["#######", "#Sbt.U#", "#######"], {
      b: { id: "b", kind: "block" },
      t: { id: "t", kind: "trap" },
    });
    const r = play(s, [right, right, right, right]);
    expect(r.outcome).toBe("floor_up");
  });
});

describe("crumbling floor", () => {
  it("collapses after the hero steps off, and the hole kills", () => {
    const s = game(["######", "#Sc..#", "######"], { c: { id: "c", kind: "crumble" } });
    const r = play(s, [right, right]);
    expect(entity(r.state, "c").state.collapsed).toBe(true);
    expect(applyTurn(r.state, left).outcome).toBe("died");
  });

  it("is whole again after a death", () => {
    const s = game(["######", "#Sc.L#", "######"], { c: { id: "c", kind: "crumble" } });
    const r = play(s, [right, right, right]);
    expect(r.outcome).toBe("died");
    expect(entity(r.state, "c").state.collapsed).toBe(false);
  });
});

describe("portals", () => {
  const legend = {
    a: { id: "a", kind: "portal", to: "b" },
    b: { id: "b", kind: "portal", to: "a" },
  };

  it("move the hero to the partner without chaining", () => {
    const s = game(["#######", "#Sa#b.#", "#######"], legend);
    const r = applyTurn(s, right);
    expect(pos(r.state)).toEqual([4, 1]);
    expect(pos(applyTurn(r.state, right).state)).toEqual([5, 1]);
  });

  it("hide where they lead", () => {
    const s = game(["#######", "#Sa#b.#", "#######"], legend);
    expect(toFloorState(s).entities.every((e) => Object.keys(e.state ?? {}).length === 0)).toBe(
      true,
    );
  });
});

describe("switches and door logic", () => {
  it("a switch toggles a door open and closed", () => {
    const s = game(["#####", "#Ss.#", "#A###"], {
      s: { id: "s", kind: "switch", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    const faced = applyTurn(s, right).state;
    const on = applyTurn(faced, interact).state;
    expect(entity(on, "A").state.open).toBe(true);
    expect(entity(applyTurn(on, interact).state, "A").state.open).toBe(false);
  });

  it("need: 2 opens only while two plates are held", () => {
    const legend = {
      p: { id: "p", kind: "plate", targets: ["A"] },
      q: { id: "q", kind: "plate", targets: ["A"] },
      b: { id: "b", kind: "block" },
      A: { id: "A", kind: "door", need: 2 },
    };
    const s = game(["########", "#Sp.bq.#", "####A###"], legend);
    const one = play(s, [right]).state;
    expect(entity(one, "A").state.open).toBe(false);
    const blockOnQ = play(one, [right, right]).state; // block pushed onto q; hero left p
    expect(entity(blockOnQ, "A").state.open).toBe(false);
    const both = play(blockOnQ, [left, left]).state; // back on p while the block holds q
    expect(entity(both, "A").state.open).toBe(true);
  });

  it("parity: open while an odd number of switches are on", () => {
    const legend = {
      s: { id: "s", kind: "switch", targets: ["A"] },
      t: { id: "t", kind: "switch", targets: ["A"] },
      A: { id: "A", kind: "door", parity: true },
    };
    const s = game(["######", "#s.t.#", "#.S..#", "###A##"], legend);
    let st = applyTurn(s, { kind: "move", dir: "left" }).state; // to (1,2)
    st = applyTurn(st, up).state; // face s
    st = applyTurn(st, interact).state;
    expect(entity(st, "A").state.open).toBe(true);
    st = play(st, [right, right, up, interact]).state;
    expect(entity(st, "A").state.open).toBe(false);
  });

  it("inverted doors start open and a lever closes them for good", () => {
    const s = game(["#####", "#Sa.#", "#A###"], {
      a: { id: "a", kind: "lever", targets: ["A"] },
      A: { id: "A", kind: "door", inverted: true },
    });
    expect(entity(s, "A").state.open).toBe(true);
    const r = play(s, [right, interact]);
    expect(entity(r.state, "A").state.open).toBe(false);
  });

  it("levers can open a door on another floor", () => {
    const f1 = floor(1, ["######", "#SAU.#", "######"], { A: { id: "A", kind: "door" } });
    const f2 = floor(2, ["#####", "#Sa.#", "#####"], {
      a: { id: "a", kind: "lever", targets: ["f1/A"] },
    });
    expect(validateFloorSet([f1, f2])).toEqual([]);
    const s = createGame([f1, f2]);
    s.currentFloor = "f2";
    const r = play(s, [right, interact]);
    expect(r.state.floors.f1!.entities.find((e) => e.id === "A")!.state.open).toBe(true);
  });

  it("validation rejects cross-floor targets from non-latching sources", () => {
    const f1 = floor(1, ["#####", "#SAU#", "#####"], { A: { id: "A", kind: "door" } });
    const f2 = floor(2, ["#####", "#Sp.#", "#####"], {
      p: { id: "p", kind: "plate", targets: ["f1/A"] },
    });
    expect(validateFloorSet([f1, f2])).toEqual([
      `floor "f2": plate "p" cannot target another floor ("f1/A")`,
    ]);
  });
});

describe("one-way tiles", () => {
  it("can be entered only in their direction", () => {
    const s = game(["######", "#S>..#", "######"], {
      ">": { id: "o", kind: "oneway", dir: "right" },
    });
    const across = play(s, [right, right]);
    expect(pos(across.state)).toEqual([3, 1]);
    expect(pos(applyTurn(across.state, left).state)).toEqual([3, 1]); // refused
  });
});

describe("weight stone", () => {
  it("can be put down on the plate the hero stands on, and stays when the hero leaves", () => {
    const s = game(["#######", "#Swp..#", "####A##"], {
      w: { id: "stone", kind: "item", item: "weight" },
      p: { id: "p", kind: "plate", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    let st = play(s, [right, interact]).state; // face the stone (it blocks) and take it
    st = play(st, [right, right, use("stone"), right]).state; // onto the plate, drop it, walk off
    expect(entity(st, "p").state.stone).not.toBeNull();
    expect(entity(st, "A").state.open).toBe(true);
  });
});

describe("items: plank and hourglass", () => {
  it("a plank bridges lava for good, surviving deaths", () => {
    const s = game(["#######", "#SpL.L#", "#######"], {
      p: { id: "plank", kind: "item", item: "plank" },
    });
    let st = play(s, [right, interact]).state; // pick up while facing right
    expect(st.inventory.map((i) => i.type)).toEqual(["plank"]);
    // Walk onto (2,1) and lay it over (3,1).
    st = play(st, [right, use("plank")]).state;
    st = play(st, [right, right]).state;
    expect(pos(st)).toEqual([4, 1]);
    const died = applyTurn(st, right);
    expect(died.outcome).toBe("died");
    expect(died.state.inventory).toEqual([]);
    expect(
      died.state.floors.f1!.entities.some((e) => e.kind === "bridge" && !e.state.removed),
    ).toBe(true);
  });

  it("an hourglass freezes the world for three steps", () => {
    const s = game(["########", "#Sh..p.#", "########"], {
      h: { id: "hg", kind: "item", item: "hourglass" },
      p: { id: "p", kind: "patrol", route: "LR" },
    });
    let st = play(s, [right, interact]).state; // patrol moved twice: L then R
    const start = at(st, "p");
    st = play(st, [use("hg"), wait, wait]).state;
    expect(at(st, "p")).toEqual(start);
    st = applyTurn(st, wait).state;
    expect(at(st, "p")).not.toEqual(start);
  });
});

describe("beams and mirrors", () => {
  it("a beam burns the hero who ends a turn in it", () => {
    const s = game(["#######", "#.S...#", "#.....#", "#>....#", "#######"], {
      ">": { id: "b", kind: "beam", dir: "right" },
    });
    expect(play(s, [down]).outcome).toBeUndefined();
    expect(play(s, [down, down]).outcome).toBe("died");
  });

  it("mirrors turn it onto a receiver, which opens a door", () => {
    const s = game(["#########", "####r####", "#>..m.S.#", "####A####"], {
      ">": { id: "b", kind: "beam", dir: "right" },
      m: { id: "m", kind: "mirror", slant: "\\" },
      r: { id: "r", kind: "receiver", targets: ["A"] },
      A: { id: "A", kind: "door" },
    });
    // "\\" sends the rightward beam down into the closed door: the receiver is dark.
    const first = applyTurn(s, wait).state;
    expect(entity(first, "b").state.hits).toEqual([[4, 3]]);
    // From beside the mirror (out of the beam), turn it to "/": the beam now goes up to r.
    const r = play(first, [left, interact]);
    expect(entity(r.state, "m").state.slant).toBe("/");
    expect(entity(r.state, "A").state.open).toBe(true);
  });

  it("turning a mirror onto yourself is deadly", () => {
    const s = game(["#########", "#...S...#", "#>..m...#", "#########"], {
      ">": { id: "b", kind: "beam", dir: "right" },
      m: { id: "m", kind: "mirror", slant: "\\" },
    });
    expect(play(s, [down, interact]).outcome).toBe("died"); // "/" turns the beam up into the hero
  });

  it("a block stops the beam, and the beam lights its path in the dark", () => {
    const s = game(
      ["########", "#>..r..#", "#S.....#", "####A###"],
      {
        ">": { id: "b", kind: "beam", dir: "right" },
        r: { id: "r", kind: "receiver", targets: ["A"] },
        A: { id: "A", kind: "door" },
      },
      { mode: "torchlight", radius: 1 },
    );
    const st = applyTurn(s, wait).state;
    expect(entity(st, "A").state.open).toBe(true);
    const tiles = toFloorState(st).tiles.split("\n");
    expect(tiles[1]!.slice(2, 4)).toBe("..");
  });

  it("a lever switches the beam off", () => {
    const s = game(["#######", "#>....#", "#Sa...#", "#######"], {
      ">": { id: "b", kind: "beam", dir: "right" },
      a: { id: "a", kind: "lever", targets: ["b"] },
    });
    const st = play(s, [right, interact]).state;
    expect(entity(st, "b").state.firing).toBe(false);
    expect(play(st, [down, up, up]).outcome).toBeUndefined();
  });
});

describe("altar of accord and vigil", () => {
  const legend = {
    a: { id: "a", kind: "altar", targets: ["A"], threshold: 0.8 },
    A: { id: "A", kind: "door" },
  };

  it("an altar answers only a united crowd", () => {
    const s = game(["#####", "#Sa.#", "#A###"], legend);
    const faced = applyTurn(s, right).state;
    const divided = applyTurn(faced, interact, { support: 0.6, dissent: wait });
    expect(entity(divided.state, "A").state.open).toBe(false);
    expect(divided.events.some((e) => e.type === "sign_read")).toBe(true);
    const united = applyTurn(divided.state, interact, { support: 0.85, dissent: null });
    expect(entity(united.state, "A").state.open).toBe(true);
  });

  it("a vigil needs consecutive waits on the stone", () => {
    const s = game(["#####", "#Sv.#", "#A###"], {
      v: { id: "v", kind: "vigil", targets: ["A"], turns: 3 },
      A: { id: "A", kind: "door" },
    });
    let st = play(s, [right, wait, wait]).state;
    expect(entity(st, "v").state.count).toBe(2);
    st = applyTurn(st, interact).state; // breaks the vigil
    expect(entity(st, "v").state.count).toBe(0);
    st = play(st, [wait, wait, wait]).state;
    expect(entity(st, "A").state.open).toBe(true);
  });
});
