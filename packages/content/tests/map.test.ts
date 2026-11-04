import { describe, expect, it } from 'vitest';
import { CHANCE_CARDS, GROUP_ORDER, GROUPS, MAPS, WORLD, getMap, groupTiles, mapText, validateMap } from '../src';

describe('карта «Вокруг света»', () => {
  it('проходит валидатор: 40 клеток, углы 0/10/20/30, 8 стран по 3 города + 4 аэропорта', () => {
    expect(validateMap(WORLD)).toEqual([]);
    expect(WORLD.tiles.length).toBe(40);
    expect(GROUP_ORDER.map((g) => groupTiles(WORLD, g).length)).toEqual([3, 3, 3, 3, 4, 3, 3, 3, 3]);
  });

  it('по 9 клеток между углами, на каждой стороне один аэропорт и по две спецклетки', () => {
    const corners = [...WORLD.corners, 40];
    for (let k = 0; k < 4; k++) {
      const side = WORLD.tiles.slice(corners[k]! + 1, corners[k + 1]);
      expect(side.length).toBe(9);
      expect(side.filter((t) => t.group === 'air').length).toBe(1);
      expect(side.filter((t) => t.kind !== 'property').length).toBe(2);
    }
  });

  it('страны не переходят через угол, цены растут по ходу, аренда в диапазоне', () => {
    for (const g of GROUP_ORDER.filter((x) => x !== 'air')) {
      const idx = groupTiles(WORLD, g);
      expect(Math.floor(idx[0]! / 10)).toBe(Math.floor(idx[idx.length - 1]! / 10));
    }
    const countries = WORLD.tiles.filter((t) => t.kind === 'property' && t.group !== 'air');
    for (let i = 1; i < countries.length; i++) expect(countries[i]!.price!).toBeGreaterThanOrEqual(countries[i - 1]!.price!);
    for (const t of WORLD.tiles.filter((x) => x.kind === 'property')) {
      expect(t.price).toBeGreaterThanOrEqual(100);
      expect(t.price).toBeLessThanOrEqual(400);
      expect(t.baseRent).toBeGreaterThanOrEqual(10);
      expect(t.baseRent).toBeLessThanOrEqual(80);
      expect(t.shortLabel.length).toBeLessThanOrEqual(10);
    }
    expect(new Set(GROUP_ORDER.map((g) => GROUPS[g].color)).size).toBe(GROUP_ORDER.length);
  });

  it('валидатор ловит ошибки', () => {
    const broken = { ...WORLD, tiles: WORLD.tiles.slice(0, 39) };
    expect(validateMap(broken).length).toBeGreaterThan(0);
  });
});

describe('дополнительные карты', () => {
  it('каждая карта проходит валидатор и экономически совпадает с «Вокруг света»', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['world', 'russia', 'space']);
    for (const m of MAPS) {
      expect(validateMap(m), m.id).toEqual([]);
      m.tiles.forEach((t, i) => {
        const w = WORLD.tiles[i]!;
        expect([t.kind, t.group, t.price, t.baseRent, t.tax], `${m.id} #${i}`).toEqual([w.kind, w.group, w.price, w.baseRent, w.tax]);
        expect(t.name.length).toBeGreaterThan(0);
      });
      expect(new Set(GROUP_ORDER.map((g) => m.groups[g].name)).size).toBe(GROUP_ORDER.length);
    }
  });

  it('id клеток уникальны между картами (кроме общих спецклеток), неизвестная карта → «Вокруг света»', () => {
    const props = MAPS.flatMap((m) => m.tiles.filter((t) => t.kind === 'property').map((t) => t.id));
    expect(new Set(props).size).toBe(props.length);
    expect(getMap('nope').id).toBe('world');
    expect(getMap(undefined).id).toBe('world');
  });

  it('тексты карточек подставляют слова карты, без «аэропорт» на других картах', () => {
    for (const m of MAPS) {
      for (const c of CHANCE_CARDS) {
        const t = mapText(m.cards?.[c.id]?.[1] ?? c.text, m);
        expect(t).not.toMatch(/\{|\}/);
        if (m.id !== 'world') expect(t).not.toMatch(/аэропорт|Париж/i);
      }
    }
  });
});
