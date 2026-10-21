/** Server messages and views shared by the client tests. */
import { PROTOCOL_VERSION, type ServerMessage } from "@inferno/shared";
import { initialView, reduce, type GameView } from "./game/store.js";

type Welcome = Extract<ServerMessage, { type: "welcome" }>["data"];

export function welcome(overrides: Partial<Welcome> = {}): ServerMessage {
  return {
    v: PROTOCOL_VERSION,
    type: "welcome",
    data: {
      you: { role: "player", userId: "u1", handle: "ana" },
      turn: 3,
      floor: {
        floorId: "f1",
        index: 1,
        width: 5,
        height: 3,
        tiles: "#####\n#.S.#\n#####",
        explored: "#####\n#.S.#\n#####",
        entities: [{ id: "lever-a", kind: "lever", x: 3, y: 1, state: { pulled: false } }],
        minimumPlayers: 2,
      },
      hero: { x: 2, y: 1, facing: "right" },
      inventory: [],
      presence: { active: 2, minimum: 2, spectators: 1, paused: false },
      tally: null,
      recentTurns: [],
      recentChat: [],
      gameOver: false,
      ...overrides,
    },
  };
}

export function viewFrom(...msgs: ServerMessage[]): GameView {
  return msgs.reduce((v, m) => reduce(v, m, 0), initialView);
}
