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

describe('титулы в конце партии', () => {
  it('после партии ботов есть счётчики и титулы; каждый титул — у игрока с максимумом', async () => {
    const { matchTitles } = await import('../src');
    const { s } = simulate(3);
    const titles = matchTitles(s);
    expect(titles.length).toBeGreaterThan(3);
    for (const t of titles) {
      const best = Math.max(...s.players.map((p) => s.stats.players?.[p.seat]?.[t.title.key] ?? 0));
      expect(t.value).toBe(best);
    }
    expect(titles.some((t) => t.title.key === 'tilesWalked')).toBe(true);
  });
});

describe('склонение в титулах', () => {
  it('1 сделку, 2 сделки, 5 сделок, 11 сделок, 21 сделку', async () => {
    const { plural } = await import('../src');
    const f = ['сделку', 'сделки', 'сделок'] as const;
    expect([1, 2, 5, 11, 21, 104].map((n) => plural(n, f))).toEqual(['сделку', 'сделки', 'сделок', 'сделок', 'сделку', 'сделки']);
  });
});
