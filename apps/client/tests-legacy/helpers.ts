import { applyAction, createGame } from '../../src/engine';
import type { Action, GameState } from '../../src/engine';
import { __test } from '../../src/engine/reducer';

export function newGame(n = 2, seed = 42): GameState {
  return createGame({
    seed,
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: i > 0 })),
  });
}

export function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`Действие ${a.type} отклонено: ${r.error}`);
  return r.state;
}

export function fail(s: GameState, a: Action): string {
  const r = applyAction(s, a);
  if (r.ok) throw new Error(`Ожидалась ошибка для ${a.type}`);
  return r.error;
}

export const rollWith = __test.rollWith;

export function give(s: GameState, owner: string, ...tiles: number[]): GameState {
  const c = structuredClone(s);
  for (const t of tiles) c.ownership[t] = { owner, houses: 0, mortgaged: false };
  return c;
}
