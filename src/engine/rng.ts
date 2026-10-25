// Детерминированный ГСЧ mulberry32. Состояние — одно 32-битное число,
// которое хранится в GameState, поэтому (состояние, действие) → состояние остаётся чистой функцией.

export function seedToState(seed: number): number {
  // Перемешиваем seed, чтобы соседние seed давали разные последовательности.
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Возвращает [число в [0,1), новое состояние]. */
export function nextFloat(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, s];
}

/** Мутабельная обёртка для использования внутри одного шага редьюсера. */
export class Rng {
  constructor(public state: number) {}

  float(): number {
    const [v, s] = nextFloat(this.state);
    this.state = s;
    return v;
  }

  /** Целое в [min, max] включительно. */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }
}
