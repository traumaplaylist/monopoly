import type { MatchState } from './types';

/**
 * Shift every absolute timestamp by `delta` ms. Used when a room is resumed after being suspended
 * (everybody disconnected), so nobody loses a decision window while the table was empty.
 */
export function shiftTime(state: MatchState, delta: number): MatchState {
  if (delta <= 0) return state;
  const s = structuredClone(state);
  const add = (t: number | null) => (t === null ? null : t + delta);
  s.now += delta;
  s.deadline = add(s.deadline);
  s.stats.phaseSince += delta;
  if (s.auction) {
    s.auction.deadline += delta;
    s.auction.startedAt += delta;
  }
  if (s.trade) s.trade.deadline += delta;
  if (s.duelOffer) s.duelOffer.deadline += delta;
  for (const p of s.players) if (p.pendingItem) p.pendingItem.deadline += delta;
  const mg = s.minigame;
  if (mg) {
    mg.stageEndsAt += delta;
    if (mg.game.kind === 'reaction') {
      if (mg.game.playStart) mg.game.playStart += delta;
      if (mg.game.playEnd) mg.game.playEnd += delta;
    } else {
      for (const r of mg.game.rounds) {
        r.showStart += delta;
        r.showEnd += delta;
        r.inputEnd += delta;
      }
    }
  }
  return s;
}
