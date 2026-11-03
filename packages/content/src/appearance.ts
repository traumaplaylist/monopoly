// Player character (wardrobe, GeoGuessr-style): DATA, not a picture number.
// A character is assembled from four slots (head with hair/hat, body, legs, feet), each taken from
// one of the CC0 Quaternius outfits (characterCatalog.ts), plus colours applied by material name.
// The seat colour (ownership frames, cards) stays separate: a ring under the figure on the board.
import { OUTFITS } from './characterCatalog';

export const PACKS = ['male', 'female'] as const;
export const SLOTS = ['head', 'body', 'legs', 'feet'] as const;
export const OUTFIT_IDS = OUTFITS.map((o) => o.id) as unknown as readonly [string, ...string[]];

export const SKIN_TONES = ['#ffdbc4', '#f6c7a4', '#e8b088', '#d39b6f', '#b47c55', '#8d5a3b', '#6b4329', '#4a2e1c'] as const;
export const HAIR_COLORS = ['#1f1a17', '#4a2f1c', '#7a4a26', '#b8742e', '#e3b65c', '#f2e2b8', '#c9c9c9', '#c0392b', '#ff4fa8', '#2f7ff0', '#58c22c', '#8b55e6'] as const;
/** Cloth colours; 'orig' keeps the outfit's own colour. */
export const CLOTH_COLORS = ['orig', '#ff5a5f', '#ff8a1f', '#ffc21a', '#58c22c', '#13b5a6', '#2fc4f0', '#2f7ff0', '#8b55e6', '#ff4fa8', '#f4f1ea', '#5b6b8c', '#2b2236'] as const;

export type Pack = (typeof PACKS)[number];
export type Slot = (typeof SLOTS)[number];
export type SkinTone = (typeof SKIN_TONES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type ClothColor = (typeof CLOTH_COLORS)[number];

export interface Appearance {
  /** Figure type; all four parts must come from outfits of this pack (proportions match). */
  pack: Pack;
  head: string;
  body: string;
  legs: string;
  feet: string;
  skin: SkinTone;
  hair: HairColor;
  shirt: ClothColor;
  pants: ClothColor;
  backpack: boolean;
}

export const PACK_LABELS: Record<Pack, string> = { male: 'Парень', female: 'Девушка' };
export const SLOT_LABELS: Record<Slot, string> = { head: 'Голова и причёска', body: 'Верх', legs: 'Низ', feet: 'Обувь' };

export function outfitsOf(pack: Pack) {
  return OUTFITS.filter((o) => o.pack === pack);
}

const look = (pack: Pack, outfit: string, skin: SkinTone, hair: HairColor, shirt: ClothColor = 'orig'): Appearance => {
  const id = `${pack}-${outfit}`;
  return { pack, head: id, body: id, legs: id, feet: id, skin, hair, shirt, pants: 'orig', backpack: false };
};

export const DEFAULT_APPEARANCE: Appearance = look('male', 'casual-hoodie', '#f6c7a4', '#4a2f1c');

/** Deterministic varied look for seat N (bots and players who never opened the wardrobe). */
export function defaultAppearance(seatIndex: number): Appearance {
  const looks = [
    look('male', 'casual-hoodie', '#f6c7a4', '#4a2f1c', '#ff5a5f'),
    look('female', 'casual', '#e8b088', '#1f1a17', '#13b5a6'),
    look('male', 'beach', '#b47c55', '#1f1a17', '#ffc21a'),
    look('female', 'adventurer', '#ffdbc4', '#b8742e', '#8b55e6'),
  ];
  return looks[seatIndex % looks.length]!;
}

const idSet = new Set<string>(OUTFIT_IDS);
const packOf = (id: string) => OUTFITS.find((o) => o.id === id)?.pack;

/** Accepts anything; returns a valid appearance (unknown parts, colours or mixed packs fall back). */
export function sanitizeAppearance(x: unknown, fallback: Appearance = DEFAULT_APPEARANCE): Appearance {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
  const pack = pick(PACKS, o.pack, fallback.pack);
  const base = fallback.pack === pack ? fallback : look(pack, pack === 'male' ? 'casual-hoodie' : 'casual', fallback.skin, fallback.hair);
  const part = (slot: Slot) => {
    const v = o[slot];
    return typeof v === 'string' && idSet.has(v) && packOf(v) === pack ? v : base[slot];
  };
  return {
    pack,
    head: part('head'),
    body: part('body'),
    legs: part('legs'),
    feet: part('feet'),
    skin: pick(SKIN_TONES, o.skin, base.skin),
    hair: pick(HAIR_COLORS, o.hair, base.hair),
    shirt: pick(CLOTH_COLORS, o.shirt, base.shirt),
    pants: pick(CLOTH_COLORS, o.pants, base.pants),
    backpack: typeof o.backpack === 'boolean' ? o.backpack : base.backpack,
  };
}

/** Random valid look (the «Случайно» button). `r` returns [0, 1). */
export function randomAppearance(r: () => number): Appearance {
  const any = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  const pack = any(PACKS);
  const ids = outfitsOf(pack).map((x) => x.id);
  return {
    pack,
    head: any(ids),
    body: any(ids),
    legs: any(ids),
    feet: any(ids),
    skin: any(SKIN_TONES),
    hair: any(HAIR_COLORS),
    shirt: any(CLOTH_COLORS),
    pants: any(CLOTH_COLORS),
    backpack: r() < 0.2,
  };
}
