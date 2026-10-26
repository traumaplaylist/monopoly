import { applyCommand, createMatch, __test } from '../src';
import type { Command, MatchState, SeatId } from '../src';

export const T0 = 1_000_000;

/** Match with a fixed turn order s0, s1, s2, s3. */
export function newMatch(opts: { seats?: number; minigameEvery?: 1 | 2 | 3; maxRounds?: number } = {}): MatchState {
  const n = opts.seats ?? 4;
  const s = createMatch({
    matchId: 'm1',
    seed: 7,
    seats: Array.from({ length: n }, (_, i) => ({ seat: `s${i}`, name: `P${i}`, avatar: i })),
    settings: { minigameEvery: opts.minigameEvery ?? 3, maxRounds: opts.maxRounds ?? 12, debug: n !== 4 },
    now: T0,
  });
  s.order = Array.from({ length: n }, (_, i) => `s${i}`);
  s.turn.seat = 's0';
  return s;
}

export function act(s: MatchState, seat: SeatId, cmd: Command, now = s.now): MatchState {
  const r = applyCommand(s, seat, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} by ${seat} rejected: ${r.error}`);
  return r.state;
}

export function fail(s: MatchState, seat: SeatId, cmd: Command, now = s.now): string {
  const r = applyCommand(s, seat, cmd, now);
  if (r.ok) throw new Error(`expected ${cmd.type} by ${seat} to fail`);
  return r.error;
}

export const rollWith = (s: MatchState, d1: number, d2: number, now = s.now) => __test.rollWith(s, d1, d2, now);

export function giveTiles(s: MatchState, seat: SeatId, ...tiles: number[]): MatchState {
  const c = structuredClone(s);
  for (const t of tiles) c.tiles[t] = { owner: seat, level: 0, mortgaged: false };
  return c;
}

export function cash(s: MatchState, seat: SeatId): number {
  return s.players.find((p) => p.seat === seat)!.cash;
}

export function p(s: MatchState, seat: SeatId) {
  return s.players.find((x) => x.seat === seat)!;
}

/** Finish the current player's turn quickly (decline purchase / pass auction / end turn). */
export function finishTurn(s: MatchState): MatchState {
  for (let i = 0; i < 20; i++) {
    const seat = s.order[s.turnIndex]!;
    if (s.phase === 'PURCHASE') s = act(s, seat, { type: 'DECLINE_BUY' });
    else if (s.phase === 'AUCTION') {
      for (const x of s.players)
        if (x.role === 'alive' && x.seat !== s.auction?.leader && s.phase === 'AUCTION')
          s = act(s, x.seat, { type: 'PASS_AUCTION' });
    } else if (s.phase === 'RENT_CHOICE') s = act(s, seat, { type: 'PAY_FULL' });
    else if (s.phase === 'DEBT') s = act(s, seat, { type: 'DECLARE_BANKRUPTCY' });
    else if (s.phase === 'POST_ROLL') return act(s, seat, { type: 'END_TURN' });
    else return s;
  }
  return s;
}
