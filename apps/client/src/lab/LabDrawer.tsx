/** The floor lab's dev tools: pick a floor, shape the simulated crowd, x-ray, solver playback. */
import type { Action } from "@inferno/shared";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toRoman } from "../components/Header.js";
import type { LabServer } from "./server.js";

const DISSENTS: { label: string; action: Action | null }[] = [
  { label: "None", action: null },
  { label: "Up", action: { kind: "move", dir: "up" } },
  { label: "Down", action: { kind: "move", dir: "down" } },
  { label: "Left", action: { kind: "move", dir: "left" } },
  { label: "Right", action: { kind: "move", dir: "right" } },
  { label: "Jump", action: { kind: "jump" } },
  { label: "Interact", action: { kind: "interact" } },
];

export function LabDrawer({ lab }: { lab: LabServer }) {
  const [open, setOpen] = useState(false);

  const status = useSyncExternalStore(
    (fn) => lab.subscribe(fn),
    () => lab.status(),
  );
  const { settings } = status;
  const solution = lab.solutions.get(status.floorId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`") setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`lab-drawer${open ? " open" : ""}`}>
      <button
        type="button"
        className="lab-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Lab
      </button>
      {open && (
        <section className="lab-panel" aria-label="Floor lab">
          <label className="lab-field">
            <span>Floor</span>
            <select value={status.floorId} onChange={(e) => lab.playFloor(e.target.value)}>
              {lab.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {toRoman(f.index)} · {f.name ?? f.id} (min {f.minimumPlayers})
                </option>
              ))}
            </select>
          </label>
          <div className="lab-row">
            <button type="button" className="key" onClick={() => lab.restartFloor()}>
              Restart floor
            </button>
            {status.autoplay === null ? (
              <button
                type="button"
                className="key"
                disabled={!solution}
                onClick={() => lab.playSolution()}
              >
                Play solution{solution ? ` (${solution.moves.length})` : ""}
              </button>
            ) : (
              <button type="button" className="key" onClick={() => lab.stopSolution()}>
                Stop ({status.autoplay}/{solution?.moves.length ?? 0})
              </button>
            )}
          </div>
          <label className="lab-field">
            <span>Crowd: {settings.crowd}</span>
            <input
              type="range"
              min={1}
              max={40}
              value={settings.crowd}
              onChange={(e) => lab.update({ crowd: Number(e.target.value) })}
            />
          </label>
          <label className="lab-field">
            <span>Agreement: {Math.round(settings.agreement * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.agreement * 100)}
              onChange={(e) => lab.update({ agreement: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="lab-field">
            <span>Runner-up vote (for the echo)</span>
            <select
              value={DISSENTS.findIndex(
                (d) => JSON.stringify(d.action) === JSON.stringify(settings.dissent),
              )}
              onChange={(e) => lab.update({ dissent: DISSENTS[Number(e.target.value)]!.action })}
            >
              {DISSENTS.map((d, i) => (
                <option key={d.label} value={i}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lab-check">
            <input
              type="checkbox"
              checked={settings.xray}
              onChange={(e) => lab.update({ xray: e.target.checked })}
            />
            X-ray hidden traps
          </label>
          <p className="lab-meta">
            {status.turnsHere} turns on this floor
            {solution ? ` · par ${solution.moves.length}` : ""} · ` toggles this panel
          </p>
        </section>
      )}
    </div>
  );
}
