// Геометрия поля в мировых координатах (плоскость XZ, центр в нуле).
export const CORNER = 2;
export const SIDE = 1.2;
export const BOARD = CORNER * 2 + SIDE * 9;
export const HALF = BOARD / 2;
export const BOARD_THICKNESS = 0.3;

export interface TileRect {
  x: number;
  z: number;
  /** Размер вдоль X и Z. */
  w: number;
  d: number;
  /** 0 — низ, 1 — лево, 2 — верх, 3 — право. */
  side: 0 | 1 | 2 | 3;
  corner: boolean;
}

export function tileRect(i: number): TileRect {
  const c = HALF - CORNER / 2;
  if (i === 0) return { x: c, z: c, w: CORNER, d: CORNER, side: 0, corner: true };
  if (i === 10) return { x: -c, z: c, w: CORNER, d: CORNER, side: 1, corner: true };
  if (i === 20) return { x: -c, z: -c, w: CORNER, d: CORNER, side: 2, corner: true };
  if (i === 30) return { x: c, z: -c, w: CORNER, d: CORNER, side: 3, corner: true };
  if (i < 10) {
    const k = i - 1;
    return { x: HALF - CORNER - SIDE * k - SIDE / 2, z: c, w: SIDE, d: CORNER, side: 0, corner: false };
  }
  if (i < 20) {
    const k = i - 11;
    return { x: -c, z: HALF - CORNER - SIDE * k - SIDE / 2, w: CORNER, d: SIDE, side: 1, corner: false };
  }
  if (i < 30) {
    const k = i - 21;
    return { x: -HALF + CORNER + SIDE * k + SIDE / 2, z: -c, w: SIDE, d: CORNER, side: 2, corner: false };
  }
  const k = i - 31;
  return { x: c, z: -HALF + CORNER + SIDE * k + SIDE / 2, w: CORNER, d: SIDE, side: 3, corner: false };
}

/** Единичный вектор от клетки к центру поля (внутренняя сторона). */
export function inward(side: number): [number, number] {
  return (
    [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const
  )[side] as [number, number];
}

/** Единичный вектор вдоль стороны (для расстановки домов). */
export function along(side: number): [number, number] {
  return (
    [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const
  )[side] as [number, number];
}

/** Поворот текста/объектов клетки вокруг Y так, чтобы «низ» смотрел наружу. */
export function sideAngle(side: number): number {
  return [0, -Math.PI / 2, Math.PI, Math.PI / 2][side]!;
}

/** Ширина цветной полосы собственности (вдоль направления «внутрь»). */
export const BAND = 0.42;
