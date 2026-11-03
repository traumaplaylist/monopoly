import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, OUTFITS, defaultAppearance, outfitsOf, randomAppearance, sanitizeAppearance } from '../src';

describe('персонаж (гардероб)', () => {
  it('каталог: 19 нарядов, у каждого 4 части и файл модели', () => {
    expect(OUTFITS.length).toBe(19);
    for (const o of OUTFITS) {
      expect(Object.keys(o.slots).sort()).toEqual(['body', 'feet', 'head', 'legs']);
      expect(o.file).toMatch(/^models\/characters\/.+\.glb$/);
    }
    expect(outfitsOf('male').length + outfitsOf('female').length).toBe(19);
  });

  it('мусор, чужие части и смешение типов фигуры заменяются допустимыми', () => {
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    const a = sanitizeAppearance({ ...DEFAULT_APPEARANCE, head: 'female-witch', skin: '#000001', shirt: '#ff5a5f' });
    expect(a.head).toBe(DEFAULT_APPEARANCE.head); // женская голова к мужской фигуре не цепляется
    expect(a.skin).toBe(DEFAULT_APPEARANCE.skin);
    expect(a.shirt).toBe('#ff5a5f');
    const f = sanitizeAppearance({ pack: 'female', head: 'female-witch' });
    expect(f.pack).toBe('female');
    expect(f.head).toBe('female-witch');
    expect([f.body, f.legs, f.feet].every((id) => id.startsWith('female-'))).toBe(true);
  });

  it('виды по месту различаются и валидны; случайный вид всегда валиден', () => {
    const looks = [0, 1, 2, 3].map(defaultAppearance);
    expect(new Set(looks.map((x) => x.body)).size).toBe(4);
    for (const x of looks) expect(sanitizeAppearance(x)).toEqual(x);
    let seed = 1;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const x = randomAppearance(r);
      expect(sanitizeAppearance(x)).toEqual(x);
    }
  });
});
