import { describe, expect, it } from 'vitest';
import { WORLD } from '@pb/content';
import { PROFILES, tileRect } from '../src/render/layout';

describe('раскладки поля', () => {
  for (const p of Object.values(PROFILES)) {
    it(`${p.id}: углы на 0/10/20/30, обход по часовой без пропусков и наложений`, () => {
      const N = WORLD.tiles.length;
      expect(N).toBe(40);
      const rects = WORLD.tiles.map((t) => tileRect(t.index, p));
      expect(rects.filter((r) => r.corner).length).toBe(4);
      expect([0, 10, 20, 30].every((i) => rects[i]!.corner)).toBe(true);
      // Старт — левый верхний угол, 10 — правый верхний, 20 — правый нижний, 30 — левый нижний.
      expect(rects[0]!.x < 0 && rects[0]!.z < 0).toBe(true);
      expect(rects[10]!.x > 0 && rects[10]!.z < 0).toBe(true);
      expect(rects[20]!.x > 0 && rects[20]!.z > 0).toBe(true);
      expect(rects[30]!.x < 0 && rects[30]!.z > 0).toBe(true);
      // Соседние клетки соприкасаются (замкнутый обход), никакие две не перекрываются.
      for (let i = 0; i < N; i++) {
        const a = rects[i]!;
        const b = rects[(i + 1) % N]!;
        const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
        const gapZ = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
        expect(Math.max(gapX, gapZ)).toBeCloseTo(0, 5);
      }
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;
          expect(overlap).toBe(false);
        }
    });
  }

  it('профили отличаются только геометрией: сторона каждой клетки одинакова', () => {
    const sides = (id: keyof typeof PROFILES) => WORLD.tiles.map((t) => tileRect(t.index, PROFILES[id]).side);
    expect(sides('landscape')).toEqual(sides('portrait'));
    expect(PROFILES.landscape.width > PROFILES.landscape.height).toBe(true);
    expect(PROFILES.portrait.height > PROFILES.portrait.width).toBe(true);
  });
});
