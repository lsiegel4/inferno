/** Test helpers: a controllable clock. */
import type { Clock } from "./clock.js";

interface Timer {
  id: number;
  at: number;
  fn: () => void;
  every: number | null;
}

export class FakeClock implements Clock {
  private t: number;
  private seq = 0;
  private timers: Timer[] = [];

  constructor(start = Date.UTC(2026, 9, 11)) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    return this.add(fn, ms, null);
  }

  setInterval(fn: () => void, ms: number): unknown {
    return this.add(fn, ms, ms);
  }

  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }

  clearInterval(handle: unknown): void {
    this.clearTimeout(handle);
  }

  /** Move time forward, firing due timers in order. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const next = this.timers
        .filter((t) => t.at <= end)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!next) break;
      this.t = next.at;
      if (next.every === null) this.clearTimeout(next.id);
      else next.at += next.every;
      next.fn();
    }
    this.t = end;
  }

  private add(fn: () => void, ms: number, every: number | null): number {
    const id = ++this.seq;
    this.timers.push({ id, at: this.t + Math.max(0, ms), fn, every });
    return id;
  }
}
