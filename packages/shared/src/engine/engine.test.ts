import { describe, expect, it } from "vitest";
import { parseFloor, type FloorDef } from "../floor.js";
import type { Action } from "../protocol.js";
import { createGame, validateFloorSet } from "./game.js";
import { applyTurn } from "./turn.js";
import type { GameState } from "./types.js";

const up: Action = { kind: "move", dir: "up" };
const down: Action = { kind: "move", dir: "down" };
const left: Action = { kind: "move", dir: "left" };
const right: Action = { kind: "move", dir: "right" };
const jump: Action = { kind: "jump" };
const interact: Action = { kind: "interact" };
const wait: Action = { kind: "wait" };

function floor(
  index: number,
  rows: string[],
  legend: Record<string, Record<string, unknown>> = {},
): FloorDef {
  return parseFloor(rows.join("\n"), { id: `f${index}`, index, minimumPlayers: 1, legend });
}

/** Apply actions in order, returning the final result. */
function play(state: GameState, actions: Action[]) {
  let result = applyTurn(state, actions[0]!);
  for (const a of actions.slice(1)) result = applyTurn(result.state, a);
  return result;
}

const hero = (s: GameState) => [s.hero.x, s.hero.y, s.hero.facing] as const;
const entity = (s: GameState, id: string) =>
  s.floors[s.currentFloor]!.entities.find((e) => e.id === id)!;

describe("movement", () => {
  const game = () => createGame([floor(1, ["#####", "#...#", "#.S.#", "#####"])]);

  it("moves one tile and faces the direction moved", () => {
    const r = applyTurn(game(), left);
    expect(hero(r.state)).toEqual([1, 2, "left"]);
    expect(r.outcome).toBeUndefined();
    expect(r.state.turn).toBe(1);
  });

  it("turns in place when blocked, and still uses a turn", () => {
    const r = applyTurn(game(), down);
    expect(hero(r.state)).toEqual([2, 2, "down"]);
    expect(r.events).toContainEqual({ type: "turned" });
    expect(r.state.turn).toBe(1);
  });

  it("does not mutate the input state", () => {
    const s = game();
    const before = JSON.stringify(s);
    applyTurn(s, left);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("wait uses a turn and changes nothing else", () => {
    const r = applyTurn(game(), wait);
    expect(hero(r.state)).toEqual([2, 2, "up"]);
    expect(r.state.turn).toBe(1);
    expect(r.outcome).toBeUndefined();
  });
});

describe("lava and death", () => {
  const game = () => createGame([floor(1, ["######", "#L...#", "#.SL.#", "######"])]);

  it("walking into lava kills the hero and returns it to the start facing up", () => {
    const r = play(game(), [right]);
    expect(r.outcome).toBe("died");
    expect(hero(r.state)).toEqual([2, 2, "up"]);
  });

  it("jumping over lava lands safely; landing on lava kills", () => {
    const s = game();
    s.hero.facing = "right";
    const safe = applyTurn(s, jump); // over (3,2) lava onto (4,2)
    expect(safe.outcome).toBeUndefined();
    expect(hero(safe.state)).toEqual([4, 2, "right"]);

    const t = game();
    t.hero = { x: 3, y: 1, facing: "left", stairsLock: false };
    expect(applyTurn(t, jump).outcome).toBe("died"); // lands on (1,1) lava
  });
});

describe("jump", () => {
  const game = () =>
    createGame([
      floor(1, ["#######", "#.....#", "#SL.#.#", "#a....#", "#######"], {
        a: { id: "sign-a", kind: "sign", text: "hi" },
      }),
    ]);

  it("jumps over one lava tile in the facing direction", () => {
    const s = game();
    s.hero.facing = "right";
    const r = applyTurn(s, jump);
    expect(hero(r.state)).toEqual([3, 2, "right"]);
    expect(r.outcome).toBeUndefined();
  });

  it("cannot jump over a wall or land in one (no effect, turn used)", () => {
    const s = game();
    s.hero.x = 3;
    s.hero.facing = "right";
    const r = applyTurn(s, jump);
    expect(r.outcome).toBe("no_effect");
    expect(hero(r.state)).toEqual([3, 2, "right"]);
    expect(r.state.turn).toBe(1);
  });

  it("cannot jump over a blocking entity, or land on one", () => {
    const over = createGame([
      floor(1, ["#######", "#S.s..#", "#######"], {
        s: { id: "sign-1", kind: "sign", text: "hi" },
      }),
    ]);
    over.hero = { x: 2, y: 1, facing: "right", stairsLock: false };
    expect(applyTurn(over, jump).outcome).toBe("no_effect"); // sign at (3,1) in the way

    const onto = game();
    onto.hero = { x: 1, y: 1, facing: "down", stairsLock: false };
    expect(applyTurn(onto, jump).outcome).toBe("no_effect"); // would land on the sign at (1,3)
  });
});

describe("levers and doors", () => {
  const rows = ["#######", "#.a.LU#", "#..S#A#", "#######"];
  const legend = {
    a: { id: "lever-a", kind: "lever", targets: ["door-a"] },
    A: { id: "door-a", kind: "door" },
  };
  const game = () =>
    createGame([floor(1, ["#######", "#.a...#", "#..S.A#", "#....U#", "#######"], legend)]);

  it("closed doors block; pulling the lever opens linked doors", () => {
    const blocked = play(game(), [right, right]); // (5,2) is the door: second move turns in place
    expect(hero(blocked.state)).toEqual([4, 2, "right"]);

    const s = game();
    s.hero = { x: 3, y: 1, facing: "left", stairsLock: false }; // lever at (2,1)
    const r = applyTurn(s, interact);
    expect(entity(r.state, "lever-a").state.pulled).toBe(true);
    expect(entity(r.state, "door-a").state.open).toBe(true);
    expect(r.changed).toEqual(expect.arrayContaining(["lever-a", "door-a"]));
  });

  it("pulling an already-pulled lever has no effect", () => {
    const s = game();
    s.hero = { x: 3, y: 1, facing: "left", stairsLock: false };
    const r = play(s, [interact, interact]);
    expect(r.outcome).toBe("no_effect");
  });

  it("interacting with nothing has no effect but uses the turn", () => {
    const r = applyTurn(game(), interact);
    expect(r.outcome).toBe("no_effect");
    expect(r.state.turn).toBe(1);
  });

  it("opened doors and pulled levers stay that way after a death", () => {
    const withLava = createGame([floor(1, rows, legend)]);
    withLava.hero = { x: 3, y: 1, facing: "left", stairsLock: false };
    const r = play(withLava, [interact, right]); // (4,1) is lava
    expect(r.outcome).toBe("died");
    expect(entity(r.state, "door-a").state.open).toBe(true);
    expect(entity(r.state, "lever-a").state.pulled).toBe(true);
  });

  it("validation rejects levers that target unknown entities", () => {
    const bad = floor(1, ["####", "#Sa#", "####"], {
      a: { id: "lever-a", kind: "lever", targets: ["nope"] },
    });
    expect(validateFloorSet([bad])).toEqual([`floor "f1": lever "lever-a" targets unknown "nope"`]);
  });
});

describe("items", () => {
  const legend = {
    k: { id: "key-red", kind: "item", item: "key", opens: "red" },
    t: { id: "torch-1", kind: "item", item: "torch" },
    R: { id: "door-red", kind: "locked_door", lock: "red" },
  };
  const game = () => createGame([floor(1, ["#######", "#k.S.R#", "#t.L..#", "#######"], legend)]);

  it("Interact picks up the faced item; it disappears and is not respawned by a death", () => {
    let s = game();
    s = play(s, [left, left]).state; // (2,1) facing left, key at (1,1)
    const picked = applyTurn(s, interact);
    expect(picked.state.inventory.map((i) => i.id)).toEqual(["key-red"]);
    expect(entity(picked.state, "key-red").state.taken).toBe(true);
    expect(picked.events).toContainEqual({ type: "item_picked_up", itemId: "key-red" });

    const died = play(picked.state, [down, right]); // (3,2) is lava
    expect(died.outcome).toBe("died");
    expect(died.state.inventory.map((i) => i.id)).toEqual(["key-red"]);
    expect(entity(died.state, "key-red").state.taken).toBe(true);
  });

  it("a key opens its matching locked door, is consumed, and is not returned on reset", () => {
    let s = game();
    s = play(s, [left, left, interact, right, right, right]).state; // (4,1) facing right
    expect(hero(s)).toEqual([4, 1, "right"]);
    const used = applyTurn(s, { kind: "use", itemId: "key-red" });
    expect(used.outcome).toBeUndefined();
    expect(entity(used.state, "door-red").state.open).toBe(true);
    expect(used.state.inventory).toEqual([]);

    const died = play(used.state, [down, left]); // (3,2) is lava
    expect(died.outcome).toBe("died");
    expect(entity(died.state, "door-red").state.open).toBe(true);
    expect(died.state.inventory).toEqual([]);
  });

  it("using an item you don't hold, or on nothing, has no effect", () => {
    const s = game();
    expect(applyTurn(s, { kind: "use", itemId: "key-red" }).outcome).toBe("no_effect");
    const holding = play(s, [left, left, interact, down]).state; // facing down at (2,1)
    expect(applyTurn(holding, { kind: "use", itemId: "key-red" }).outcome).toBe("no_effect");
  });

  it("validation rejects unknown item types and keys without a lock name", () => {
    const bad = floor(1, ["#####", "#Sxy#", "#####"], {
      x: { id: "i1", kind: "item", item: "banana" },
      y: { id: "i2", kind: "item", item: "key" },
    });
    expect(validateFloorSet([bad])).toEqual([
      `floor "f1": item "i1" has invalid item type "banana"`,
      `floor "f1": key "i2" has no "opens"`,
    ]);
  });
});

describe("signs", () => {
  it("Interact shows the sign's text", () => {
    const s = createGame([
      floor(1, ["#####", "#S.s#", "#####"], {
        s: { id: "sign-1", kind: "sign", text: "Mind the lava" },
      }),
    ]);
    const r = play(s, [right, interact]);
    expect(r.events).toContainEqual({
      type: "sign_read",
      entityId: "sign-1",
      text: "Mind the lava",
    });
    expect(r.outcome).toBeUndefined();
  });
});

describe("floor transitions", () => {
  const floors = () => [
    floor(1, ["######", "#S..U#", "#..a.#", "#..A.#", "######"], {
      a: { id: "lever-1", kind: "lever", targets: ["door-1"] },
      A: { id: "door-1", kind: "door" },
    }),
    floor(2, ["######", "#D.SU#", "#.p..#", "######"], {
      p: { id: "pit-1", kind: "pit", landing: { floor: "f1", x: 1, y: 3 } },
    }),
    floor(3, ["#####", "#SU.#", "#####"]),
  ];

  it("stairs up lead to the next floor's start", () => {
    const r = play(createGame(floors()), [right, right, right]);
    expect(r.outcome).toBe("floor_up");
    expect(r.state.currentFloor).toBe("f2");
    expect([r.state.hero.x, r.state.hero.y]).toEqual([3, 1]);
  });

  it("stairs down land on the previous floor's stairs up, without climbing again", () => {
    const s = play(createGame(floors()), [right, right, right]).state; // on f2 at (3,1)
    const r = play(s, [left, left]); // (1,1) is stairs down
    expect(r.outcome).toBe("floor_down");
    expect(r.state.currentFloor).toBe("f1");
    expect([r.state.hero.x, r.state.hero.y]).toEqual([4, 1]);
    expect(r.state.hero.stairsLock).toBe(true);

    const waited = applyTurn(r.state, wait);
    expect(waited.state.currentFloor).toBe("f1");
    const bumped = applyTurn(r.state, up); // turn in place, still on the stairs
    expect(bumped.state.currentFloor).toBe("f1");

    const climbed = play(r.state, [left, right]);
    expect(climbed.outcome).toBe("floor_up");
    expect(climbed.state.currentFloor).toBe("f2");
  });

  it("pits drop the hero to the designer's landing spot on a lower floor", () => {
    const s = play(createGame(floors()), [right, right, right]).state;
    const r = play(s, [down, left]); // (3,2) then (2,2) is the pit
    expect(r.outcome).toBe("fell");
    expect(r.state.currentFloor).toBe("f1");
    expect([r.state.hero.x, r.state.hero.y]).toEqual([1, 3]);
  });

  it("leaving a floor preserves its puzzle state", () => {
    let s = createGame(floors());
    s.hero = { x: 2, y: 2, facing: "right", stairsLock: false };
    s = applyTurn(s, interact).state; // pull lever-1 on f1
    s = play(s, [up, right, right]).state; // to f2
    s = play(s, [left, left]).state; // back down to f1
    expect(entity(s, "lever-1").state.pulled).toBe(true);
    expect(entity(s, "door-1").state.open).toBe(true);
  });

  it("climbing the last floor's stairs ends the game", () => {
    let s = play(createGame(floors()), [right, right, right]).state; // f2
    s = applyTurn(s, right).state; // f3
    const r = applyTurn(s, right);
    expect(r.state.gameOver).toBe(true);
    expect(r.events).toContainEqual({ type: "game_over" });
    expect(applyTurn(r.state, left).outcome).toBe("no_effect");
  });

  it("validation: pits must land on a lower floor; stairs down need a previous stairs up", () => {
    const pitUp = floor(1, ["#####", "#Sp.#", "#####"], {
      p: { id: "pit-x", kind: "pit", landing: { floor: "f1", x: 1, y: 1 } },
    });
    expect(validateFloorSet([pitUp])).toEqual([
      `floor "f1": pit "pit-x" must land on a lower floor`,
    ]);
    const downFirst = floor(1, ["####", "#SD#", "####"]);
    expect(validateFloorSet([downFirst])).toEqual([
      `floor "f1" has stairs down but no previous floor with stairs up`,
    ]);
  });
});
