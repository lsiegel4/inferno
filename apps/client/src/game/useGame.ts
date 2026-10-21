import { PROTOCOL_VERSION, type Action, type ClientMessage } from "@inferno/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { GameSocket, socketUrl, type SocketStatus } from "../net/socket.js";
import { initialView, reduce, withMyVote, type GameView } from "./store.js";

type Event =
  { kind: "server"; msg: Parameters<typeof reduce>[1] } | { kind: "vote"; action: Action };

function reducer(view: GameView, ev: Event): GameView {
  return ev.kind === "server" ? reduce(view, ev.msg, Date.now()) : withMyVote(view, ev.action);
}

export interface GameControls {
  view: GameView;
  status: SocketStatus;
  vote(action: Action): void;
  ready(): void;
  chat(text: string): void;
  /** Reconnect so the server picks up a new session cookie. */
  reconnect(): void;
}

/** Connects to the game server and exposes the view plus the actions a player can take. */
export function useGame(): GameControls {
  const [view, dispatch] = useReducer(reducer, initialView);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const socket = useRef<GameSocket | null>(null);
  const turnRef = useRef(0);
  turnRef.current = view.turn;

  useEffect(() => {
    const s = new GameSocket(socketUrl(), (msg) => dispatch({ kind: "server", msg }), setStatus);
    socket.current = s;
    s.connect();
    return () => s.close();
  }, []);

  const send = useCallback((msg: Omit<ClientMessage, "v">) => {
    socket.current?.send({ v: PROTOCOL_VERSION, ...msg } as ClientMessage);
  }, []);

  return {
    view,
    status,
    vote: (action) => {
      send({ type: "vote", data: { tick: turnRef.current, action } });
      dispatch({ kind: "vote", action });
    },
    ready: () => send({ type: "ready", data: {} }),
    chat: (text) => send({ type: "chat_send", data: { text } }),
    reconnect: () => socket.current?.reconnect(),
  };
}
