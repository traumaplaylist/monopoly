import { describe, expect, it } from 'vitest';
import { simulate } from '../src';

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
