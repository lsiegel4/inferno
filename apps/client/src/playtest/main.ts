/**
 * Floor lab: play any floor with the real rules engine, alone or with a simulated crowd, and
 * browse every floor in an atlas. A design and playtesting tool, not the game client.
 */
import {
  actionKey,
  applyTurn,
  createGame,
  crowdOf,
  resolveVotes,
  revealAll,
  revealFor,
  toFloorState,
  toProtocolHero,
  type Action,
  type Crowd,
  type Entity,
  type FloorDef,
  type GameEvent,
  type GameState,
} from "@inferno/shared";
import { loadFloors, loadSolutions, type FloorSolution } from "./floors.js";
import { drawItem, drawScene, PALETTE, type Light } from "./render.js";

const VIEW_W = 13;
const VIEW_H = 9;

const floors = loadFloors();
const solutions = loadSolutions();
const fresh = createGame(floors);

// ---------------------------------------------------------------------------
// Helpers

export function roman(n: number): string {
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function atFloorStart(game: GameState, floorId: string): GameState {
  const s = structuredClone(game);
  const { start } = s.floors[floorId]!.def;
  s.currentFloor = floorId;
  s.hero = { x: start.x, y: start.y, facing: "up", stairsLock: false };
  return s;
}

const MECHANIC_NAMES: Record<string, string> = {
  lever: "levers",
  door: "doors",
  locked_door: "locks",
  item: "items",
  sign: "signs",
  pit: "pits",
  light: "braziers",
  block: "blocks",
  plate: "plates",
  platform: "ferries",
  vent: "fire vents",
  patrol: "patrols",
  statue: "watchers",
  echo: "the echo",
  trap: "hidden traps",
  crack: "cracks",
  crumble: "crumbling floor",
  portal: "portals",
  switch: "switches",
  oneway: "one-way",
  beam: "beams",
  mirror: "mirrors",
  receiver: "receivers",
  altar: "altar of accord",
  vigil: "vigil",
};

function mechanicsOf(def: FloorDef): string[] {
  const out = new Set<string>();
  if (def.terrain.some((r) => r.includes("L"))) out.add("lava");
  if (def.terrain.some((r) => r.includes("I"))) out.add("ice");
  if (def.reveal.mode !== "viewport")
    out.add(def.reveal.mode === "line_of_sight" ? "line of sight" : "darkness");
  for (const e of def.entities) {
    if (e.kind === "item") out.add(String(e.props.item) + "s");
    else if (MECHANIC_NAMES[e.kind]) out.add(MECHANIC_NAMES[e.kind]!);
  }
  return [...out];
}

const BASE_ACTIONS: Action[] = [
  { kind: "move", dir: "up" },
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "jump" },
  { kind: "interact" },
  { kind: "wait" },
];

function describe(a: Action): string {
  switch (a.kind) {
    case "move":
      return { up: "↑", down: "↓", left: "←", right: "→" }[a.dir];
    case "use":
      return `use ${a.itemId}`;
    default:
      return a.kind;
  }
}

// ---------------------------------------------------------------------------
// State

interface Lab {
  game: GameState;
  /** Snapshot of the game when the hero arrived on the current floor (for Restart). */
  arrival: GameState;
  remembered: Map<string, Map<string, string>>;
  deaths: number;
  turnsHere: number;
  log: { text: string; tone: "info" | "death" | "sign" | "good" }[];
  sign: { text: string; until: number } | null;
  hurt: number;
  xray: boolean;
  dissent: Action | null;
  players: number;
  focus: number;
  lastTally: { action: Action; votes: number }[] | null;
  lastCrowd: Crowd | null;
  autoplay: { moves: FloorSolution["moves"]; i: number; next: number } | null;
  camX: number;
  camY: number;
}

const lab: Lab = {
  game: atFloorStart(fresh, fresh.floorOrder[0]!),
  arrival: atFloorStart(fresh, fresh.floorOrder[0]!),
  remembered: new Map(),
  deaths: 0,
  turnsHere: 0,
  log: [],
  sign: null,
  hurt: 0,
  xray: false,
  dissent: null,
  players: 1,
  focus: 75,
  lastTally: null,
  lastCrowd: null,
  autoplay: null,
  camX: 0,
  camY: 0,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("view");
const ctx = canvas.getContext("2d")!;

function def(): FloorDef {
  return lab.game.floors[lab.game.currentFloor]!.def;
}

function remember() {
  const id = lab.game.currentFloor;
  let mem = lab.remembered.get(id);
  if (!mem) lab.remembered.set(id, (mem = new Map()));
  const fs = toFloorState(lab.game);
  fs.tiles.split("\n").forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== " ") mem.set(`${x},${y}`, ch);
    }),
  );
}

function log(text: string, tone: Lab["log"][number]["tone"] = "info") {
  lab.log.unshift({ text, tone });
  lab.log.length = Math.min(lab.log.length, 40);
}

function enterFloor(state: GameState) {
  lab.game = state;
  lab.arrival = structuredClone(state);
  lab.turnsHere = 0;
  lab.dissent = null;
  const d = def();
  log(`Floor ${roman(d.index)}: ${d.name ?? d.id}`, "good");
  remember();
  snapCamera();
  renderHud();
}

function playFloor(floorId: string) {
  lab.autoplay = null;
  lab.deaths = 0;
  enterFloor(atFloorStart(fresh, floorId));
  showScreen("play");
}

// ---------------------------------------------------------------------------
// Turns and the simulated crowd

function randomAction(state: GameState): Action {
  const options = [
    ...BASE_ACTIONS,
    ...state.inventory.map((i): Action => ({ kind: "use", itemId: i.id })),
  ];
  return options[Math.floor(Math.random() * options.length)]!;
}

/**
 * Your vote plus (players - 1) simulated voters. Focused voters copy your vote (or your armed
 * runner-up, for a share of them); the rest vote at random. Plurality decides, as on the server.
 */
function crowdVote(mine: Action): { action: Action; crowd: Crowd } {
  if (lab.players <= 1) {
    if (lab.dissent) return { action: mine, crowd: { support: 0.6, dissent: lab.dissent } };
    return { action: mine, crowd: { support: 1, dissent: null } };
  }
  const votes: Action[] = [mine];
  for (let i = 1; i < lab.players; i++) {
    if (Math.random() * 100 < lab.focus) {
      votes.push(lab.dissent && Math.random() < 0.38 ? lab.dissent : mine);
    } else {
      votes.push(randomAction(lab.game));
    }
  }
  const action = resolveVotes(votes, Math.random)!;
  const counts = new Map<string, { action: Action; votes: number }>();
  for (const v of votes) {
    const k = actionKey(v);
    const c = counts.get(k) ?? { action: v, votes: 0 };
    c.votes++;
    counts.set(k, c);
  }
  lab.lastTally = [...counts.values()].sort((a, b) => b.votes - a.votes);
  return { action, crowd: crowdOf(votes, action) };
}

function act(mine: Action, fixedCrowd?: Crowd) {
  if (lab.game.gameOver) return;
  const { action, crowd } = fixedCrowd ? { action: mine, crowd: fixedCrowd } : crowdVote(mine);
  lab.lastCrowd = crowd;
  lab.dissent = null;
  const before = lab.game;
  const r = applyTurn(before, action, crowd);
  lab.game = r.state;
  lab.turnsHere++;
  for (const e of r.events) onEvent(e, before);
  if (r.outcome === "died") {
    lab.deaths++;
    lab.hurt = 1;
  }
  if (r.state.currentFloor !== before.currentFloor) {
    enterFloor(r.state);
  } else {
    remember();
  }
  if (action !== mine) log(`The crowd overruled you: ${describe(action)}`, "info");
  renderHud();
}

function onEvent(e: GameEvent, before: GameState) {
  switch (e.type) {
    case "died":
      log("You died. The floor resets.", "death");
      break;
    case "sign_read":
      lab.sign = { text: e.text, until: performance.now() + Math.max(3500, e.text.length * 45) };
      log(`“${e.text}”`, "sign");
      break;
    case "item_picked_up":
      log(`Picked up ${e.itemId}`, "good");
      break;
    case "item_used":
      log(`Used ${e.itemId}`, "info");
      break;
    case "echo_dissolved":
      log("The echo dissolves and re-forms.", "info");
      break;
    case "floor_changed":
      if (e.how === "fell")
        log(`You fell to floor ${roman(lab.game.floors[e.to]!.def.index)}!`, "death");
      if (e.how === "down") log("You climb back up a floor.", "info");
      void before;
      break;
    case "game_over":
      log("You escaped Hell and saw the stars again.", "good");
      break;
  }
}

// ---------------------------------------------------------------------------
// Rendering

function lights(): Light[] | null {
  const d = def();
  if (d.reveal.mode === "viewport") return null;
  const r = d.reveal.radius;
  const fs = toFloorState(lab.game);
  const out: Light[] = [{ x: lab.game.hero.x, y: lab.game.hero.y, radius: r }];
  for (const e of fs.entities) {
    if (e.kind === "light")
      out.push({
        x: e.x,
        y: e.y,
        radius: typeof e.state?.radius === "number" ? e.state.radius : r,
      });
    if (e.kind === "beam" && e.state?.firing) {
      for (const [x, y] of (e.state.path as [number, number][]) ?? [])
        out.push({ x, y, radius: 0.6 });
    }
  }
  return out;
}

function xrayEntities(): Entity[] {
  if (!lab.xray) return [];
  const floor = lab.game.floors[lab.game.currentFloor]!;
  return floor.entities
    .filter((e) => e.kind === "trap" && !e.state.discovered)
    .map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y }));
}

function tileSize(): number {
  const wrap = $("stage");
  return Math.max(16, Math.floor(Math.min(wrap.clientWidth / VIEW_W, wrap.clientHeight / VIEW_H)));
}

function cameraTarget(ts: number): [number, number] {
  const d = def();
  const vw = canvas.width / devicePixelRatio / ts;
  const vh = canvas.height / devicePixelRatio / ts;
  const clamp = (v: number, size: number, view: number) =>
    size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v));
  return [
    clamp(lab.game.hero.x + 0.5 - vw / 2, d.width, vw),
    clamp(lab.game.hero.y + 0.5 - vh / 2, d.height, vh),
  ];
}

function snapCamera() {
  const [x, y] = cameraTarget(tileSize());
  lab.camX = x;
  lab.camY = y;
}

function frame(now: number) {
  requestAnimationFrame(frame);
  if (currentScreen !== "play") return;
  const wrap = $("stage");
  const w = wrap.clientWidth,
    h = wrap.clientHeight;
  if (
    canvas.width !== Math.round(w * devicePixelRatio) ||
    canvas.height !== Math.round(h * devicePixelRatio)
  ) {
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const ts = tileSize();
  const [tx, ty] = cameraTarget(ts);
  lab.camX += (tx - lab.camX) * 0.18;
  lab.camY += (ty - lab.camY) * 0.18;
  lab.hurt = Math.max(0, lab.hurt - 0.025);

  if (lab.autoplay && now >= lab.autoplay.next) {
    const m = lab.autoplay.moves[lab.autoplay.i];
    if (!m) lab.autoplay = null;
    else {
      lab.autoplay.i++;
      lab.autoplay.next = now + 260;
      act(m.action, m.crowd);
    }
  }

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const fs = lab.xray
    ? toFloorState(lab.game, revealAll)
    : toFloorState(lab.game, revealFor(lab.game));
  drawScene(
    ctx,
    {
      floor: fs,
      hero: toProtocolHero(lab.game),
      remembered: lab.remembered.get(lab.game.currentFloor) ?? new Map(),
      lights: lab.xray ? null : lights(),
      xray: xrayEntities(),
      camX: lab.camX,
      camY: lab.camY,
      tile: ts,
      time: now,
      hurt: lab.hurt,
    },
    w,
    h,
  );

  const sign = $("sign");
  if (lab.sign && now < lab.sign.until) {
    sign.textContent = lab.sign.text;
    sign.hidden = false;
  } else {
    sign.hidden = true;
  }
}

function renderHud() {
  const d = def();
  $("floor-num").textContent = roman(d.index);
  $("floor-name").textContent = d.name ?? d.id;
  const reveal =
    d.reveal.mode === "viewport"
      ? "lit"
      : `${d.reveal.mode === "line_of_sight" ? "line of sight" : "torchlight"} r${d.reveal.radius}`;
  $("floor-meta").textContent = `${reveal} · needs ${d.minimumPlayers}+ players`;
  $("stat-turns").textContent = String(lab.turnsHere);
  $("stat-deaths").textContent = String(lab.deaths);
  const sol = solutions.get(d.id);
  $("stat-par").textContent = sol ? String(sol.moves.length) : "–";

  const inv = $("inventory");
  inv.replaceChildren();
  lab.game.inventory.forEach((item, i) => {
    const b = document.createElement("button");
    b.className = "item";
    b.title = `${item.id} (${i + 1})`;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    drawItem(g, item.type, 32, 32, 56, performance.now(), String(item.props.opens ?? ""));
    b.append(c, Object.assign(document.createElement("span"), { textContent: String(i + 1) }));
    b.onclick = () => act({ kind: "use", itemId: item.id });
    inv.append(b);
  });
  if (!lab.game.inventory.length) inv.textContent = "Empty";

  $("dissent").textContent = lab.dissent ? `Runner-up vote armed: ${describe(lab.dissent)}` : "";
  const tally = $("tally");
  tally.replaceChildren();
  if (lab.lastCrowd) {
    const head = document.createElement("div");
    head.className = "tally-head";
    head.textContent = `Support ${Math.round(lab.lastCrowd.support * 100)}% · runner-up ${lab.lastCrowd.dissent ? describe(lab.lastCrowd.dissent) : "none"}`;
    tally.append(head);
  }
  for (const c of (lab.players > 1 ? lab.lastTally : null)?.slice(0, 5) ?? []) {
    const row = document.createElement("div");
    row.className = "vote";
    const pct = (c.votes / lab.players) * 100;
    row.innerHTML = `<span>${describe(c.action)}</span><i style="width:${pct}%"></i><b>${c.votes}</b>`;
    tally.append(row);
  }

  const logEl = $("log");
  logEl.replaceChildren(
    ...lab.log
      .slice(0, 14)
      .map((l) =>
        Object.assign(document.createElement("li"), { textContent: l.text, className: l.tone }),
      ),
  );
  $<HTMLButtonElement>("btn-solution").disabled = !sol;
}

// ---------------------------------------------------------------------------
// Atlas

let currentScreen: "atlas" | "play" = "atlas";

function showScreen(s: "atlas" | "play") {
  currentScreen = s;
  $("atlas").hidden = s !== "atlas";
  $("play").hidden = s !== "play";
  if (s === "play") {
    snapCamera();
    renderHud();
  }
}

function buildAtlas() {
  const grid = $("atlas-grid");
  for (const d of floors) {
    const card = document.createElement("button");
    card.className = "card";
    const thumb = document.createElement("canvas");
    const ts = Math.max(6, Math.floor(Math.min(300 / d.width, 190 / d.height)));
    thumb.width = d.width * ts;
    thumb.height = d.height * ts;
    const state = atFloorStart(fresh, d.id);
    const g = thumb.getContext("2d")!;
    drawScene(
      g,
      {
        floor: toFloorState(state, revealAll),
        hero: toProtocolHero(state),
        remembered: new Map(),
        lights: null,
        xray: [],
        camX: 0,
        camY: 0,
        tile: ts,
        time: 0,
        hurt: 0,
      },
      thumb.width,
      thumb.height,
    );
    const sol = solutions.get(d.id);
    const stats = sol
      ? `<span>${sol.moves.length} turns</span><span>${sol.dangerSteps} deadly</span>${sol.splitSteps ? `<span>${sol.splitSteps} split</span>` : ""}`
      : "";
    card.innerHTML = `<div class="num">${roman(d.index)}</div><div class="name">${d.name ?? d.id}</div>
      <div class="chips">${mechanicsOf(d)
        .map((m) => `<em>${m}</em>`)
        .join("")}</div>
      <div class="stats"><span>${d.minimumPlayers}+ players</span>${stats}</div>`;
    card.prepend(thumb);
    card.onclick = () => playFloor(d.id);
    grid.append(card);
  }
}

// ---------------------------------------------------------------------------
// Input

const DIRS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

window.addEventListener("keydown", (ev) => {
  if (currentScreen !== "play") {
    if (ev.key === "Enter") playFloor(lab.game.currentFloor);
    return;
  }
  if (ev.target instanceof HTMLInputElement) return;
  const dir = DIRS[ev.key];
  if (dir) {
    ev.preventDefault();
    if (ev.shiftKey) {
      lab.dissent = { kind: "move", dir };
      renderHud();
    } else act({ kind: "move", dir });
    return;
  }
  switch (ev.key) {
    case " ":
      ev.preventDefault();
      if (ev.shiftKey) {
        lab.dissent = { kind: "jump" };
        renderHud();
      } else act({ kind: "jump" });
      break;
    case "e":
    case "Enter":
      act({ kind: "interact" });
      break;
    case "E":
      lab.dissent = { kind: "interact" };
      renderHud();
      break;
    case "q":
    case ".":
      act({ kind: "wait" });
      break;
    case "r":
      restart();
      break;
    case "x":
      lab.xray = !lab.xray;
      break;
    case "Escape":
      showScreen("atlas");
      break;
    default:
      if (/^[1-9]$/.test(ev.key)) {
        const item = lab.game.inventory[Number(ev.key) - 1];
        if (item) act({ kind: "use", itemId: item.id });
      }
  }
});

function restart() {
  lab.autoplay = null;
  lab.game = structuredClone(lab.arrival);
  lab.turnsHere = 0;
  lab.dissent = null;
  log("Restarted the floor.", "info");
  remember();
  snapCamera();
  renderHud();
}

function bind() {
  document.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const a = b.dataset.act!;
      if (["up", "down", "left", "right"].includes(a)) act({ kind: "move", dir: a as "up" });
      else act({ kind: a as "jump" });
    });
  });
  $("btn-atlas").onclick = () => showScreen("atlas");
  $("btn-restart").onclick = restart;
  $("btn-xray").onclick = () => (lab.xray = !lab.xray);
  $("btn-prev").onclick = () => {
    const i = floors.findIndex((f) => f.id === lab.game.currentFloor);
    if (i > 0) playFloor(floors[i - 1]!.id);
  };
  $("btn-next").onclick = () => {
    const i = floors.findIndex((f) => f.id === lab.game.currentFloor);
    if (i < floors.length - 1) playFloor(floors[i + 1]!.id);
  };
  $("btn-solution").onclick = () => {
    const sol = solutions.get(lab.game.currentFloor);
    if (!sol) return;
    restart();
    lab.autoplay = { moves: sol.moves, i: 0, next: performance.now() + 300 };
  };
  const players = $<HTMLInputElement>("players");
  const focus = $<HTMLInputElement>("focus");
  const sync = () => {
    lab.players = Number(players.value);
    lab.focus = Number(focus.value);
    $("players-v").textContent = String(lab.players);
    $("focus-v").textContent = `${lab.focus}%`;
  };
  players.oninput = focus.oninput = sync;
  sync();
  $("atlas-play").onclick = () => playFloor(floors[0]!.id);
}

buildAtlas();
bind();
renderHud();
showScreen("atlas");
requestAnimationFrame(frame);
void PALETTE;
