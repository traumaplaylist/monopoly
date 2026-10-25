import { describe, expect, it } from 'vitest';
import { applyAction, getActor, rentFor } from '../../src/engine';
import { act, fail, give, newGame, rollWith } from './helpers';

describe('движение и старт', () => {
  it('бросок двигает фишку и предлагает покупку', () => {
    let s = newGame();
    s = rollWith(s, 1, 2);
    expect(s.players[0]!.position).toBe(3);
    expect(s.phase).toBe('buy');
  });

  it('проход через «Старт» даёт бонус', () => {
    let s = newGame();
    s.players[0]!.position = 38;
    s = rollWith(s, 1, 3); // 38 + 4 = 2 (карта «Совет колонии»)
    expect(s.players[0]!.position === 2 || s.players[0]!.cash !== 1500).toBe(true);
    expect(s.log.some((e) => e.t === 'money' && e.reason === 'start')).toBe(true);
  });

  it('дубль даёт ещё один бросок, три дубля — карантин', () => {
    let s = newGame();
    s = rollWith(s, 2, 2); // 4 — налог 200
    expect(s.phase).toBe('roll');
    s = rollWith(s, 3, 3); // 10 — просто посещение
    expect(s.phase).toBe('roll');
    s = rollWith(s, 1, 1);
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.position).toBe(10);
    expect(s.phase).toBe('endTurn');
  });

  it('детерминированность: одинаковый seed — одинаковые броски', () => {
    const a = act(newGame(2, 7), { type: 'ROLL', player: 'p0' });
    const b = act(newGame(2, 7), { type: 'ROLL', player: 'p0' });
    expect(a).toEqual(b);
  });

  it('нельзя ходить за другого', () => {
    expect(fail(newGame(), { type: 'ROLL', player: 'p1' })).toBe('notYourTurn');
  });
});

describe('покупка и аренда', () => {
  it('покупка списывает деньги', () => {
    let s = rollWith(newGame(), 1, 2);
    s = act(s, { type: 'BUY', player: 'p0' });
    expect(s.ownership[3]!.owner).toBe('p0');
    expect(s.players[0]!.cash).toBe(1440);
    expect(s.phase).toBe('endTurn');
  });

  it('аренда удваивается при полной группе без построек', () => {
    let s = give(newGame(), 'p1', 1);
    expect(rentFor(s, 1, 7)).toBe(2);
    s = give(s, 'p1', 3);
    expect(rentFor(s, 1, 7)).toBe(4);
    s.ownership[1]!.mortgaged = true;
    expect(rentFor(s, 1, 7)).toBe(0);
  });

  it('транспорт и коммунальные', () => {
    let s = give(newGame(), 'p1', 5, 15, 12);
    expect(rentFor(s, 5, 7)).toBe(50);
    expect(rentFor(s, 12, 7)).toBe(28);
    s = give(s, 'p1', 28);
    expect(rentFor(s, 12, 7)).toBe(70);
  });

  it('игрок платит аренду владельцу', () => {
    let s = give(newGame(), 'p1', 3);
    s = rollWith(s, 1, 2);
    expect(s.players[0]!.cash).toBe(1496);
    expect(s.players[1]!.cash).toBe(1504);
  });
});

describe('строительство и залог', () => {
  it('строить можно только при полной группе и равномерно', () => {
    let s = give(newGame(), 'p0', 1);
    expect(fail(s, { type: 'BUILD', player: 'p0', tile: 1 })).toBe('needFullGroup');
    s = give(s, 'p0', 3);
    s = act(s, { type: 'BUILD', player: 'p0', tile: 1 });
    expect(s.ownership[1]!.houses).toBe(1);
    expect(fail(s, { type: 'BUILD', player: 'p0', tile: 1 })).toBe('buildEvenly');
    s = act(s, { type: 'BUILD', player: 'p0', tile: 3 });
    expect(s.bank.houses).toBe(30);
  });

  it('отель: 4 дома возвращаются в банк', () => {
    let s = give(newGame(), 'p0', 1, 3);
    for (let i = 0; i < 4; i++) {
      s = act(s, { type: 'BUILD', player: 'p0', tile: 1 });
      s = act(s, { type: 'BUILD', player: 'p0', tile: 3 });
    }
    expect(s.bank.houses).toBe(24);
    s = act(s, { type: 'BUILD', player: 'p0', tile: 1 });
    expect(s.ownership[1]!.houses).toBe(5);
    expect(s.bank.houses).toBe(28);
    expect(s.bank.hotels).toBe(11);
    expect(rentFor(s, 1, 7)).toBe(250);
    s = act(s, { type: 'SELL_BUILDING', player: 'p0', tile: 1 });
    expect(s.ownership[1]!.houses).toBe(4);
    expect(s.bank.hotels).toBe(12);
  });

  it('залог запрещён при постройках в группе; выкуп +10%', () => {
    let s = give(newGame(), 'p0', 1, 3);
    s = act(s, { type: 'BUILD', player: 'p0', tile: 1 });
    expect(fail(s, { type: 'MORTGAGE', player: 'p0', tile: 3 })).toBe('sellBuildingsFirst');
    s = act(s, { type: 'SELL_BUILDING', player: 'p0', tile: 1 });
    s = act(s, { type: 'MORTGAGE', player: 'p0', tile: 3 });
    expect(s.players[0]!.cash).toBe(1500 - 50 + 25 + 30);
    expect(fail(s, { type: 'BUILD', player: 'p0', tile: 1 })).toBe('groupMortgaged');
    s = act(s, { type: 'UNMORTGAGE', player: 'p0', tile: 3 });
    expect(s.players[0]!.cash).toBe(1500 - 50 + 25 + 30 - 33);
  });
});

describe('карантин', () => {
  it('выход дублем без дополнительного броска', () => {
    let s = newGame();
    s.players[0]!.inJail = true;
    s.players[0]!.position = 10;
    s = rollWith(s, 4, 4);
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.position).toBe(18);
    expect(s.phase).toBe('buy');
    s = act(s, { type: 'DECLINE_BUY', player: 'p0' });
    s = act(s, { type: 'PASS_AUCTION', player: 'p0' });
    s = act(s, { type: 'PASS_AUCTION', player: 'p1' });
    expect(s.phase).toBe('endTurn');
  });

  it('после третьей неудачи — штраф и ход', () => {
    let s = newGame();
    s.players[0]!.inJail = true;
    s.players[0]!.position = 10;
    s.players[0]!.jailTurns = 2;
    s = rollWith(s, 1, 2);
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.position).toBe(13);
    expect(s.players[0]!.cash).toBe(1450);
  });

  it('штраф или карта до броска', () => {
    let s = newGame();
    s.players[0]!.inJail = true;
    s.players[0]!.position = 10;
    expect(fail(s, { type: 'USE_JAIL_CARD', player: 'p0' })).toBe('noJailCard');
    s.players[0]!.jailCards = ['signal'];
    s.decks.signal = s.decks.signal.filter((c) => c !== 7);
    s = act(s, { type: 'USE_JAIL_CARD', player: 'p0' });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.decks.signal).toContain(7);
    expect(s.phase).toBe('roll');
  });

  it('клетка «Санконтроль» отправляет в карантин', () => {
    let s = newGame();
    s.players[0]!.position = 25;
    s = rollWith(s, 2, 3);
    expect(s.players[0]!.position).toBe(10);
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.phase).toBe('endTurn');
  });
});

describe('аукцион', () => {
  it('ставки по кругу, побеждает последний', () => {
    let s = rollWith(newGame(3), 1, 2);
    s = act(s, { type: 'DECLINE_BUY', player: 'p0' });
    expect(getActor(s)).toBe('p0');
    s = act(s, { type: 'BID', player: 'p0', amount: 10 });
    expect(getActor(s)).toBe('p1');
    expect(fail(s, { type: 'BID', player: 'p1', amount: 10 })).toBe('bidTooLow');
    s = act(s, { type: 'BID', player: 'p1', amount: 30 });
    s = act(s, { type: 'PASS_AUCTION', player: 'p2' });
    expect(getActor(s)).toBe('p0');
    s = act(s, { type: 'PASS_AUCTION', player: 'p0' });
    expect(s.ownership[3]!.owner).toBe('p1');
    expect(s.players[1]!.cash).toBe(1470);
    expect(s.phase).toBe('endTurn');
  });

  it('никто не поставил — клетка остаётся у банка', () => {
    let s = rollWith(newGame(2), 1, 2);
    s = act(s, { type: 'DECLINE_BUY', player: 'p0' });
    s = act(s, { type: 'PASS_AUCTION', player: 'p0' });
    s = act(s, { type: 'PASS_AUCTION', player: 'p1' });
    expect(s.ownership[3]!.owner).toBeNull();
  });
});

describe('сделки', () => {
  it('обмен клетками и деньгами', () => {
    let s = give(newGame(), 'p0', 1);
    s = give(s, 'p1', 3);
    s = act(s, {
      type: 'PROPOSE_TRADE',
      player: 'p0',
      to: 'p1',
      give: { cash: 100, tiles: [1], jailCards: 0 },
      get: { cash: 0, tiles: [3], jailCards: 0 },
    });
    expect(getActor(s)).toBe('p1');
    expect(fail(s, { type: 'ROLL', player: 'p0' })).toBe('tradePending');
    s = act(s, { type: 'ACCEPT_TRADE', player: 'p1' });
    expect(s.ownership[1]!.owner).toBe('p1');
    expect(s.ownership[3]!.owner).toBe('p0');
    expect(s.players[1]!.cash).toBe(1600);
  });

  it('нельзя торговать чужим или застроенной группой', () => {
    let s = give(newGame(), 'p0', 1, 3);
    s = act(s, { type: 'BUILD', player: 'p0', tile: 1 });
    expect(
      fail(s, {
        type: 'PROPOSE_TRADE',
        player: 'p0',
        to: 'p1',
        give: { cash: 0, tiles: [3], jailCards: 0 },
        get: { cash: 0, tiles: [], jailCards: 0 },
      }),
    ).toBe('tradeTiles');
    expect(
      fail(s, {
        type: 'PROPOSE_TRADE',
        player: 'p0',
        to: 'p1',
        give: { cash: 0, tiles: [], jailCards: 0 },
        get: { cash: 5000, tiles: [], jailCards: 0 },
      }),
    ).toBe('tradeCash');
  });
});

describe('долги и банкротство', () => {
  it('нехватка денег создаёт долг; оплата после залога', () => {
    let s = give(newGame(), 'p1', 39);
    s.ownership[39]!.houses = 5;
    s = give(s, 'p0', 1);
    s.players[0]!.cash = 100;
    s.players[0]!.position = 35;
    s = rollWith(s, 1, 3);
    expect(s.phase).toBe('debt');
    expect(getActor(s)).toBe('p0');
    expect(fail(s, { type: 'PAY_DEBT', player: 'p0' })).toBe('noCash');
    s = act(s, { type: 'DECLARE_BANKRUPTCY', player: 'p0' });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p1');
    expect(s.ownership[1]!.owner).toBe('p1');
  });

  it('банкротство перед банком возвращает клетки банку, ход переходит дальше', () => {
    let s = give(newGame(3), 'p0', 1);
    s.players[0]!.cash = 10;
    s.players[0]!.position = 1;
    s = rollWith(s, 1, 2); // 4 — налог 200
    expect(s.phase).toBe('debt');
    s = act(s, { type: 'MORTGAGE', player: 'p0', tile: 1 });
    s = act(s, { type: 'DECLARE_BANKRUPTCY', player: 'p0' });
    expect(s.ownership[1]).toEqual({ owner: null, houses: 0, mortgaged: false });
    expect(s.players[s.current]!.id).toBe('p1');
    expect(s.phase).toBe('roll');
  });

  it('оплата долга возвращает в нужную фазу', () => {
    let s = give(newGame(), 'p0', 1);
    s.players[0]!.cash = 180;
    s = rollWith(s, 2, 2); // налог 200, дубль
    expect(s.phase).toBe('debt');
    s = act(s, { type: 'MORTGAGE', player: 'p0', tile: 1 });
    s = act(s, { type: 'PAY_DEBT', player: 'p0' });
    expect(s.phase).toBe('roll');
    expect(s.players[0]!.cash).toBe(180 + 30 - 200);
  });
});

it('applyAction не мутирует исходное состояние', () => {
  const s = newGame();
  const copy = structuredClone(s);
  applyAction(s, { type: 'ROLL', player: 'p0' });
  expect(s).toEqual(copy);
});
