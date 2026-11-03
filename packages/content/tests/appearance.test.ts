import { describe, expect, it } from 'vitest';
import { BODY_COLORS, BODY_SHAPES, DEFAULT_APPEARANCE, FACES, HATS, defaultAppearance, sanitizeAppearance } from '../src';

describe('внешность фишки', () => {
  it('мусор и неизвестные части заменяются значениями по умолчанию', () => {
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeAppearance({ hat: 'bomb', color: '#123456', body: 'star' })).toEqual({ ...DEFAULT_APPEARANCE, body: 'star' });
    const ok = { body: 'bean', color: BODY_COLORS[3], material: 'matte', hat: 'tophat', face: 'cat' };
    expect(sanitizeAppearance(ok)).toEqual(ok);
  });

  it('вид по месту различается у четырёх мест и валиден', () => {
    const looks = [0, 1, 2, 3].map(defaultAppearance);
    expect(new Set(looks.map((a) => a.color)).size).toBe(4);
    for (const a of looks) expect(sanitizeAppearance(a)).toEqual(a);
    expect(BODY_SHAPES.length * HATS.length * FACES.length * BODY_COLORS.length).toBeGreaterThan(1000);
  });
});
