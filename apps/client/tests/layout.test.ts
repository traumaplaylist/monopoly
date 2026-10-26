import { describe, expect, it } from 'vitest';
import { MEGAPOLIS } from '@pb/content';
import { PROFILES, tileRect } from '../src/render/layout';

describe('раскладки поля', () => {
  for (const p of Object.values(PROFILES)) {
    it(`${p.id}: углы на 0/8/16/24, обход по часовой без пропусков и наложений`, () => {
      const rects = MEGAPOLIS.tiles.map((t) => tileRect(t.index, p));
      expect(rects.filter((r) => r.corner).length).toBe(4);
      expect([0, 8, 16, 24].every((i) => rects[i]!.corner)).toBe(true);
      // Старт — левый верхний угол, 8 — правый верхний, 16 — правый нижний, 24 — левый нижний.
      expect(rects[0]!.x < 0 && rects[0]!.z < 0).toBe(true);
      expect(rects[8]!.x > 0 && rects[8]!.z < 0).toBe(true);
      expect(rects[16]!.x > 0 && rects[16]!.z > 0).toBe(true);
      expect(rects[24]!.x < 0 && rects[24]!.z > 0).toBe(true);
      // Соседние клетки соприкасаются (замкнутый обход), никакие две не перекрываются.
      for (let i = 0; i < 32; i++) {
        const a = rects[i]!;
        const b = rects[(i + 1) % 32]!;
        const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
        const gapZ = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
        expect(Math.max(gapX, gapZ)).toBeCloseTo(0, 5);
      }
      for (let i = 0; i < 32; i++)
        for (let j = i + 1; j < 32; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;
          expect(overlap).toBe(false);
        }
    });
  }

  it('профили отличаются только геометрией: сторона каждой клетки одинакова', () => {
    const sides = (id: keyof typeof PROFILES) => MEGAPOLIS.tiles.map((t) => tileRect(t.index, PROFILES[id]).side);
    expect(sides('landscape')).toEqual(sides('portrait'));
    expect(PROFILES.landscape.width > PROFILES.landscape.height).toBe(true);
    expect(PROFILES.portrait.height > PROFILES.portrait.width).toBe(true);
  });
});
