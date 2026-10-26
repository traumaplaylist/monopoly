// Геометрия прямоугольного поля (плоскость XZ, центр в нуле, +Z — к зрителю).
// Старт — левый верхний угол, движение по часовой стрелке:
// 0 угол, 1–9 верх, 10 угол, 11–19 право, 20 угол, 21–29 низ, 30 угол, 31–39 лево.

/** Клетки верхнего и нижнего ряда: ширина (X) и глубина (Z). */
export const TOP_W = 1.3;
export const TOP_D = 1.55;
/** Клетки боковых столбцов: ширина (X) и высота (Z). */
export const SIDE_W = 2.0;
export const SIDE_H = 0.78;

export const BOARD_W = SIDE_W * 2 + TOP_W * 9;
export const BOARD_H = TOP_D * 2 + SIDE_H * 9;
export const TILE_HEIGHT = 0.22;
/** Зазор между блоками клеток. */
export const GAP = 0.06;
/** Толщина цветной полосы группы у внешнего края клетки. */
export const STRIP = 0.26;

export type Side = 0 | 1 | 2 | 3; // верх, право, низ, лево

export interface TileRect {
  x: number;
  z: number;
  /** Размер вдоль X и Z. */
  w: number;
  d: number;
  side: Side;
  corner: boolean;
}

const L = -BOARD_W / 2;
const R = BOARD_W / 2;
const T = -BOARD_H / 2;
const B = BOARD_H / 2;

export function tileRect(i: number): TileRect {
  const cx = (left: boolean) => (left ? L + SIDE_W / 2 : R - SIDE_W / 2);
  const cz = (top: boolean) => (top ? T + TOP_D / 2 : B - TOP_D / 2);
  if (i === 0) return { x: cx(true), z: cz(true), w: SIDE_W, d: TOP_D, side: 0, corner: true };
  if (i === 10) return { x: cx(false), z: cz(true), w: SIDE_W, d: TOP_D, side: 1, corner: true };
  if (i === 20) return { x: cx(false), z: cz(false), w: SIDE_W, d: TOP_D, side: 2, corner: true };
  if (i === 30) return { x: cx(true), z: cz(false), w: SIDE_W, d: TOP_D, side: 3, corner: true };
  if (i < 10) return { x: L + SIDE_W + TOP_W * (i - 1) + TOP_W / 2, z: cz(true), w: TOP_W, d: TOP_D, side: 0, corner: false };
  if (i < 20)
    return { x: cx(false), z: T + TOP_D + SIDE_H * (i - 11) + SIDE_H / 2, w: SIDE_W, d: SIDE_H, side: 1, corner: false };
  if (i < 30) return { x: R - SIDE_W - TOP_W * (i - 21) - TOP_W / 2, z: cz(false), w: TOP_W, d: TOP_D, side: 2, corner: false };
  return { x: cx(true), z: B - TOP_D - SIDE_H * (i - 31) - SIDE_H / 2, w: SIDE_W, d: SIDE_H, side: 3, corner: false };
}

/** Единичный вектор от клетки наружу поля. */
export function outward(side: Side): [number, number] {
  return (
    [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const
  )[side] as [number, number];
}

/** Центр цветной полосы клетки (у внешнего края) и её ориентация. */
export function stripCenter(i: number): { x: number; z: number; horizontal: boolean } {
  const r = tileRect(i);
  const [ox, oz] = outward(r.side);
  const half = (r.side % 2 === 0 ? r.d : r.w) / 2 - STRIP / 2 - GAP / 2;
  return { x: r.x + ox * half, z: r.z + oz * half, horizontal: r.side % 2 === 0 };
}
