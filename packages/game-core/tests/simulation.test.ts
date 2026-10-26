import { describe, expect, it } from 'vitest';
import { advance, applyCommand, botCommand, createMatch, nextDeadline } from '../src';
import type { MatchState } from '../src';

/** Plays a whole match with debug bots and a simulated clock. */
export function simulate(seed: number, seats = 4): { s: MatchState; steps: number } {
  let s = createMatch({
    matchId: `sim${seed}`,
    seed,
    seats: Array.from({ length: seats }, (_, i) => ({ seat: `s${i}`, name: `B${i}`, avatar: i })),
    settings: { minigameEvery: 2, debug: seats !== 4 },
    now: 0,
  });
  let now = 0;
  let steps = 0;
  for (; steps < 20000 && s.phase !== 'FINISHED'; steps++) {
    let acted = false;
    for (const p of s.players) {
      const cmd = botCommand(s, p.seat, now);
      if (!cmd) continue;
      const r = applyCommand(s, p.seat, cmd, now);
      if (r.ok) {
        s = r.state;
        acted = true;
        break;
      }
    }
    for (const p of s.players) if (p.cash < 0) throw new Error(`negative cash ${p.seat}`);
    if (acted) {
      now += 250;
      continue;
    }
    const d = nextDeadline(s);
    if (d === null) throw new Error(`stuck in ${s.phase}`);
    now = Math.max(now + 250, Math.min(d, now + 250));
    const a = advance(s, now);
    if (a) s = a.state;
  }
  return { s, steps };
}

describe('симуляция партий', () => {
  it('партии ботов доходят до финала без зависаний', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { s } = simulate(seed);
      expect(s.phase).toBe('FINISHED');
      expect(s.standings!.some((x) => x.winner)).toBe(true);
      expect(s.stats.minigamesPlayed).toBeGreaterThan(0);
    }
  });

  it('одинаковый seed и одинаковые команды — одинаковая партия', () => {
    expect(simulate(42).s).toEqual(simulate(42).s);
  });
});
