// Injectable clock so tests can run whole matches without waiting real minutes.
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
  clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
};

/** Manual clock for tests: time moves only when advance() is called. */
export class ManualClock implements Clock {
  private t: number;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private seq = 0;

  constructor(start = 1_700_000_000_000) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + Math.max(0, ms), fn });
    return id;
  }

  clearTimeout(h: unknown): void {
    this.timers.delete(h as number);
  }

  /** Move time forward, firing due timers in order. */
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = Math.max(this.t, next[1].at);
      next[1].fn();
      await new Promise((r) => setImmediate(r));
    }
    this.t = end;
  }
}
