// Player figure appearance: DATA assembled from parts, not a picture number.
// Each part is a slot the renderer builds in code today and a Blender model can replace later
// (assets.json → models["body-<shape>"], models["hat-<hat>"]) without changing this format.
// The seat colour (ownership frames, cards) stays separate and is shown as a ring under the figure.

export const BODY_SHAPES = ['meeple', 'pawn', 'bean', 'star'] as const;
export const BODY_MATERIALS = ['jelly', 'matte', 'metal'] as const;
export const HATS = ['none', 'cap', 'crown', 'tophat', 'party', 'beanie', 'halo'] as const;
export const FACES = ['none', 'smile', 'cool', 'wink', 'wow', 'cat'] as const;
export const BODY_COLORS = [
  '#ff5a5f', '#ff8a1f', '#ffc21a', '#58c22c', '#13b5a6', '#2fc4f0',
  '#2f7ff0', '#8b55e6', '#ff4fa8', '#f4f1ea', '#5b6b8c', '#2b2236',
] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type BodyMaterial = (typeof BODY_MATERIALS)[number];
export type Hat = (typeof HATS)[number];
export type Face = (typeof FACES)[number];
export type BodyColor = (typeof BODY_COLORS)[number];

export interface Appearance {
  body: BodyShape;
  color: BodyColor;
  material: BodyMaterial;
  hat: Hat;
  face: Face;
}

export const APPEARANCE_LABELS = {
  body: { meeple: 'Человечек', pawn: 'Пешка', bean: 'Боб', star: 'Звезда' } as Record<BodyShape, string>,
  material: { jelly: 'Мармелад', matte: 'Матовый', metal: 'Металл' } as Record<BodyMaterial, string>,
  hat: { none: 'Без шляпы', cap: 'Кепка', crown: 'Корона', tophat: 'Цилиндр', party: 'Колпак', beanie: 'Шапка', halo: 'Нимб' } as Record<Hat, string>,
  face: { none: 'Без лица', smile: 'Улыбка', cool: 'Очки', wink: 'Подмигивает', wow: 'Удивлён', cat: 'Котик' } as Record<Face, string>,
};

export const DEFAULT_APPEARANCE: Appearance = { body: 'meeple', color: '#ff5a5f', material: 'jelly', hat: 'none', face: 'smile' };

/** Deterministic varied look for seat N (bots and players who never opened the editor). */
export function defaultAppearance(seatIndex: number): Appearance {
  const colors: BodyColor[] = ['#ff5a5f', '#13b5a6', '#ffc21a', '#8b55e6'];
  const hats: Hat[] = ['none', 'cap', 'party', 'beanie'];
  return { ...DEFAULT_APPEARANCE, color: colors[seatIndex % 4]!, hat: hats[seatIndex % 4]! };
}

/** Accepts anything; returns a valid appearance (unknown/invalid parts fall back to defaults). */
export function sanitizeAppearance(x: unknown, fallback: Appearance = DEFAULT_APPEARANCE): Appearance {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
  return {
    body: pick(BODY_SHAPES, o.body, fallback.body),
    color: pick(BODY_COLORS, o.color, fallback.color),
    material: pick(BODY_MATERIALS, o.material, fallback.material),
    hat: pick(HATS, o.hat, fallback.hat),
    face: pick(FACES, o.face, fallback.face),
  };
}
