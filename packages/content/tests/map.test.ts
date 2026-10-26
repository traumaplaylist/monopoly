import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, MEGAPOLIS, groupTiles, validateMap } from '../src';

describe('карта «Мегаполис»', () => {
  it('проходит валидатор: 32 клетки, углы 0/8/16/24, группы 2-2-3-3-3-3-2-2', () => {
    expect(validateMap(MEGAPOLIS)).toEqual([]);
    expect(GROUP_ORDER.map((g) => groupTiles(MEGAPOLIS, g).length)).toEqual([2, 2, 3, 3, 3, 3, 2, 2]);
  });

  it('по 7 клеток между углами, цены и аренда в заданных диапазонах', () => {
    for (const [a, b] of [
      [0, 8],
      [8, 16],
      [16, 24],
      [24, 32],
    ] as const)
      expect(b - a - 1).toBe(7);
    for (const t of MEGAPOLIS.tiles.filter((x) => x.kind === 'property')) {
      expect(t.price).toBeGreaterThanOrEqual(100);
      expect(t.price).toBeLessThanOrEqual(320);
      expect(t.baseRent).toBeGreaterThanOrEqual(10);
      expect(t.baseRent).toBeLessThanOrEqual(48);
    }
  });

  it('валидатор ловит ошибки', () => {
    const broken = { ...MEGAPOLIS, tiles: MEGAPOLIS.tiles.slice(0, 31) };
    expect(validateMap(broken).length).toBeGreaterThan(0);
  });
});
