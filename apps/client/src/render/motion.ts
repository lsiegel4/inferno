/**
 * The hero's motion between turns. The server sends where the hero is; this eases the figure
 * there: a quick step, a hop for a jump, a glide across ice, and an instant cut for deaths,
 * portals and new floors.
 */

export type MoveKind = "step" | "jump" | "slide" | "snap";

export interface HeroPose {
  x: number;
  y: number;
  /** Height above the floor in tiles (a jump's arc). */
  lift: number;
}

const STEP_MS = 170;
const JUMP_MS = 320;
const SLIDE_MS_PER_TILE = 85;
const JUMP_HEIGHT = 0.42;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutQuad = (t: number) => 1 - (1 - t) ** 2;

export class HeroMotion {
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private start = 0;
  private duration = 0;
  private kind: MoveKind = "snap";
  private placed = false;

  /** Start moving toward a new tile (or cut straight to it). */
  moveTo(x: number, y: number, kind: MoveKind, now: number): void {
    if (!this.placed || kind === "snap") {
      this.from = this.to = { x, y };
      this.duration = 0;
      this.placed = true;
      return;
    }
    const here = this.at(now);
    this.from = { x: here.x, y: here.y };
    this.to = { x, y };
    this.start = now;
    this.kind = kind;
    const dist = Math.hypot(x - here.x, y - here.y);
    this.duration =
      kind === "jump"
        ? JUMP_MS
        : kind === "slide"
          ? Math.min(650, dist * SLIDE_MS_PER_TILE)
          : STEP_MS;
  }

  at(now: number): HeroPose {
    const t = this.duration > 0 ? Math.min(1, (now - this.start) / this.duration) : 1;
    if (t >= 1) return { x: this.to.x, y: this.to.y, lift: 0 };
    const k = this.kind === "jump" ? t : this.kind === "slide" ? easeOutQuad(t) : easeOutCubic(t);
    return {
      x: this.from.x + (this.to.x - this.from.x) * k,
      y: this.from.y + (this.to.y - this.from.y) * k,
      lift: this.kind === "jump" ? JUMP_HEIGHT * Math.sin(Math.PI * t) : 0,
    };
  }
}

/** How the hero got from one tile to another, judged from the turn that moved it. */
export function moveKind(
  from: { x: number; y: number },
  to: { x: number; y: number },
  action: string | undefined,
  cut: boolean,
): MoveKind {
  const dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  if (cut || dist === 0) return "snap";
  if (action === "jump" && dist === 2) return "jump";
  if (dist === 1) return "step";
  // Several tiles in a straight line: ice or a ferry. Anything else is a portal.
  return from.x === to.x || from.y === to.y ? "slide" : "snap";
}
