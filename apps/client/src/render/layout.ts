// Board geometry profiles. Canonical tile indices are identical everywhere; a profile only
// changes coordinates and tile proportions. Start = top-left, clockwise; corners at 0/8/16/24.
export type ProfileId = 'landscape' | 'portrait';

export interface Profile {
  id: ProfileId;
  /** Corner tile size: width (X) and depth (Z). */
  cw: number;
  cd: number;
  /** Top/bottom row tile width (X); depth equals cd. */
  tw: number;
  /** Left/right column tile height (Z); width equals cw. */
  sh: number;
  width: number;
  height: number;
}

function profile(id: ProfileId, cw: number, cd: number, tw: number, sh: number): Profile {
  return { id, cw, cd, tw, sh, width: cw * 2 + tw * 7, height: cd * 2 + sh * 7 };
}

export const PROFILES: Record<ProfileId, Profile> = {
  landscape: profile('landscape', 1.9, 1.6, 1.3, 0.92),
  portrait: profile('portrait', 1.45, 1.25, 0.9, 1.75),
};

export const SIDE_TILES = 7;
export const TILE_HEIGHT = 0.2;
export const GAP = 0.06;
export const STRIP = 0.24;

export type Side = 0 | 1 | 2 | 3; // top, right, bottom, left

export interface TileRect {
  x: number;
  z: number;
  w: number;
  d: number;
  side: Side;
  corner: boolean;
}

export function tileRect(i: number, p: Profile): TileRect {
  const L = -p.width / 2;
  const R = p.width / 2;
  const T = -p.height / 2;
  const B = p.height / 2;
  const cx = (left: boolean) => (left ? L + p.cw / 2 : R - p.cw / 2);
  const cz = (top: boolean) => (top ? T + p.cd / 2 : B - p.cd / 2);
  if (i === 0) return { x: cx(true), z: cz(true), w: p.cw, d: p.cd, side: 0, corner: true };
  if (i === 8) return { x: cx(false), z: cz(true), w: p.cw, d: p.cd, side: 1, corner: true };
  if (i === 16) return { x: cx(false), z: cz(false), w: p.cw, d: p.cd, side: 2, corner: true };
  if (i === 24) return { x: cx(true), z: cz(false), w: p.cw, d: p.cd, side: 3, corner: true };
  if (i < 8) return { x: L + p.cw + p.tw * (i - 1) + p.tw / 2, z: cz(true), w: p.tw, d: p.cd, side: 0, corner: false };
  if (i < 16) return { x: cx(false), z: T + p.cd + p.sh * (i - 9) + p.sh / 2, w: p.cw, d: p.sh, side: 1, corner: false };
  if (i < 24) return { x: R - p.cw - p.tw * (i - 17) - p.tw / 2, z: cz(false), w: p.tw, d: p.cd, side: 2, corner: false };
  return { x: cx(true), z: B - p.cd - p.sh * (i - 25) - p.sh / 2, w: p.cw, d: p.sh, side: 3, corner: false };
}

export function outward(side: Side): [number, number] {
  return ([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const)[side] as [number, number];
}

/** Centre of the group-colour strip (outer edge) where upgrades stand. */
export function stripCenter(i: number, p: Profile): { x: number; z: number; horizontal: boolean } {
  const r = tileRect(i, p);
  const [ox, oz] = outward(r.side);
  const half = (r.side % 2 === 0 ? r.d : r.w) / 2 - STRIP / 2 - GAP / 2;
  return { x: r.x + ox * half, z: r.z + oz * half, horizontal: r.side % 2 === 0 };
}

/** Inner (calm) area of the board. */
export function innerArea(p: Profile) {
  return { w: p.width - p.cw * 2, h: p.height - p.cd * 2 };
}

/** World positions of central elements per profile. */
export function centerLayout(p: Profile) {
  const inner = innerArea(p);
  if (p.id === 'portrait') {
    return {
      banner: -inner.h / 2 + 0.9,
      dice: { x: 0, z: -inner.h / 2 + 2.7 },
      decks: [
        { x: 0, z: 1.0, w: 2.6, d: 1.6 },
        { x: 0, z: 3.3, w: 2.6, d: 1.6 },
      ],
      prompt: 0.2,
    };
  }
  return {
    banner: -inner.h / 2 + 0.8,
    dice: { x: 0, z: -0.65 },
    decks: [
      { x: -1.6, z: 1.45, w: 2.3, d: 1.45 },
      { x: 1.6, z: 1.45, w: 2.3, d: 1.45 },
    ],
    prompt: 0.15,
  };
}

export function pickProfile(width: number, height: number): ProfileId {
  return width / Math.max(1, height) < 0.95 ? 'portrait' : 'landscape';
}
