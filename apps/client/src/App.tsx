import type { Action } from "@inferno/shared";
import { useCallback, useEffect, useState } from "react";
import { Account } from "./components/Account.js";
import { Chat } from "./components/Chat.js";
import { Controls } from "./components/Controls.js";
import { EventLog } from "./components/EventLog.js";
import { FloorMap } from "./components/FloorMap.js";
import { Header } from "./components/Header.js";
import { MapView } from "./components/MapView.js";
import { PauseOverlay } from "./components/PauseOverlay.js";
import { SignOverlay } from "./components/SignOverlay.js";
import { Tally } from "./components/Tally.js";
import { useGame } from "./game/useGame.js";
import { api, type Me } from "./net/api.js";

const KEYS: Record<string, Action> = {
  ArrowUp: { kind: "move", dir: "up" },
  ArrowDown: { kind: "move", dir: "down" },
  ArrowLeft: { kind: "move", dir: "left" },
  ArrowRight: { kind: "move", dir: "right" },
  w: { kind: "move", dir: "up" },
  s: { kind: "move", dir: "down" },
  a: { kind: "move", dir: "left" },
  d: { kind: "move", dir: "right" },
  " ": { kind: "jump" },
  e: { kind: "interact" },
  q: { kind: "wait" },
};

export function App() {
  const game = useGame();
  const { view } = game;
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"log" | "chat">("log");
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    void api.me().then(setMe);
  }, []);

  const onAccountChange = useCallback((next: Me | null) => {
    setMe(next);
    game.reconnect();
  }, []);

  const canVote =
    view.you?.role === "player" && !view.presence?.paused && !view.gameOver && !view.myVote;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "m") return setMapOpen((o) => !o);
      if (key === "Escape") return setMapOpen(false);
      const action = KEYS[key];
      if (action && canVote) {
        e.preventDefault();
        game.vote(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canVote, game]);

  return (
    <div className="app">
      <main className="stage">
        <Header view={view} />
        <div className="map-frame">
          <MapView view={view} />
          <button
            type="button"
            className="key map-button"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((o) => !o)}
          >
            Map
          </button>
          {mapOpen && <FloorMap view={view} onClose={() => setMapOpen(false)} />}
          <SignOverlay view={view} />
          <PauseOverlay view={view} onReady={game.ready} />
          {view.gameOver && (
            <div className="overlay" role="status">
              <h2>The descent is complete</h2>
              <p>The crowd reached the bottom of the Inferno.</p>
            </div>
          )}
          {game.status !== "open" && (
            <div className="overlay connection" role="status">
              <p>{game.status === "connecting" ? "Connecting…" : "Reconnecting…"}</p>
            </div>
          )}
        </div>
        <Tally view={view} />
        <Controls view={view} onVote={game.vote} />
      </main>
      <aside className="side">
        <Account
          me={me}
          googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}
          onChange={onAccountChange}
        />
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "log"}
            onClick={() => setTab("log")}
          >
            Record
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
        </div>
        <div className="panel">
          {tab === "log" ? (
            <EventLog log={view.log} />
          ) : (
            <Chat messages={view.chat} canChat={view.you?.role === "player"} onSend={game.chat} />
          )}
        </div>
      </aside>
    </div>
  );
}
