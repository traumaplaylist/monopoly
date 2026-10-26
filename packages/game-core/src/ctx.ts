import { Rng } from './rng';
import type { EventInput, MatchEvent, MatchState } from './types';

export const LOG_LIMIT = 150;

export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function ensure(cond: unknown, code: string): asserts cond {
  if (!cond) throw new RuleError(code);
}

/** Mutable context of one state transition. */
export interface Ctx {
  s: MatchState;
  rng: Rng;
  now: number;
  events: MatchEvent[];
  /** Set when state changed without an event (e.g. hidden data expired). */
  changed: boolean;
}

export function makeCtx(state: MatchState, now: number): Ctx {
  const s = structuredClone(state);
  return { s, rng: new Rng(s.rng), now: Math.max(now, s.now), events: [], changed: false };
}

export function emit(ctx: Ctx, e: EventInput): void {
  ctx.changed = true;
  ctx.s.eventSeq += 1;
  ctx.events.push({ ...e, seq: ctx.s.eventSeq, at: ctx.now } as MatchEvent);
}

export function commit(ctx: Ctx): MatchState {
  const s = ctx.s;
  s.rng = ctx.rng.state;
  s.now = ctx.now;
  if (ctx.events.length) s.log = [...s.log, ...ctx.events].slice(-LOG_LIMIT);
  return s;
}
