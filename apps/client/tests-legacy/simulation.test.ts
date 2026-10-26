import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getActor } from '../../src/engine';
import type { GameState } from '../../src/engine';
import { chooseBotAction } from '../../src/bots';

function simulate(seed: number, players: number, maxActions = 30000): { state: GameState; actions: number } {
  let s = createGame({
    seed,
    players: Array.from({ length: players }, (_, i) => ({ id: `b${i}`, name: `Бот ${i}`, isBot: true })),
    settings: { maxRounds: 150 },
  });
  let n = 0;
  while (s.phase !== 'gameOver' && n < maxActions) {
    const actor = getActor(s)!;
    const action = chooseBotAction(s, actor);
    if (!action) throw new Error(`Бот ${actor} не выбрал действие в фазе ${s.phase}`);
    const r = applyAction(s, action);
    if (!r.ok) throw new Error(`Бот выбрал недопустимое ${action.type}: ${r.error} (фаза ${s.phase})`);
    s = r.state;
    n++;
    for (const p of s.players) if (p.cash < 0) throw new Error('Отрицательный баланс');
    const houses = s.ownership.reduce((a, o) => a + (o && o.houses < 5 ? o.houses : 0), 0);
    const hotels = s.ownership.filter((o) => o?.houses === 5).length;
    if (houses + s.bank.houses !== 32 || hotels + s.bank.hotels !== 12) throw new Error('Нарушен запас построек');
  }
  return { state: s, actions: n };
}

describe('симуляция партий ботов', () => {
  it('партии завершаются без недопустимых действий', () => {
    let finished = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = simulate(seed, 2 + (seed % 5));
      if (state.phase === 'gameOver') finished++;
    }
    expect(finished).toBe(30);
  }, 60_000);

  it('одинаковый seed — одинаковая партия', () => {
    const a = simulate(123, 4, 3000).state;
    const b = simulate(123, 4, 3000).state;
    expect(a).toEqual(b);
  }, 30_000);
});
