import { describe, expect, it } from 'vitest';
import { RULESET } from '@pb/content';
import { advance, applyCommand, liquidationValue, nextDeadline, publicView, rentFor } from '../src';
import { T0, act, cash, fail, finishTurn, giveTiles, newMatch, p, rollWith } from './helpers';

describe('ход и движение', () => {
  it('бросок двигает фишку, свободный объект предлагается к покупке', () => {
    let s = rollWith(newMatch(), 1, 2); // 3 = Пекарня
    expect(p(s, 's0').position).toBe(3);
    expect(s.phase).toBe('PURCHASE');
    expect(s.deadline).toBe(T0 + RULESET.purchaseMs);
  });

  it('зарплата ровно один раз за пересечение «Старта» и за попадание на него', () => {
    let s = newMatch();
    s.players[0]!.position = 30;
    s = rollWith(s, 1, 1); // 32 → 0 (Старт)
    expect(p(s, 's0').position).toBe(0);
    expect(cash(s, 's0')).toBe(1700);
    expect(s.log.filter((e) => e.t === 'money' && e.reason === 'salary')).toHaveLength(1);
  });

  it('дубль не даёт второго хода', () => {
    let s = rollWith(newMatch(), 2, 2); // 4 = налог
    expect(s.phase).toBe('POST_ROLL');
    s = act(s, 's0', { type: 'END_TURN' });
    expect(s.turn.seat).toBe('s1');
  });

  it('нельзя ходить чужим местом и не в своей фазе', () => {
    const s = newMatch();
    expect(fail(s, 's1', { type: 'ROLL' })).toBe('notYourTurn');
    expect(fail(s, 's0', { type: 'END_TURN' })).toBe('wrongPhase');
  });

  it('таймер хода: авто-бросок, затем авто-отказ от покупки → аукцион, затем авто-конец хода', () => {
    let s = newMatch();
    const d = nextDeadline(s)!;
    s = advance(s, d)!.state;
    expect(s.turn.rolled).toBe(true);
    expect(['PURCHASE', 'POST_ROLL', 'AUCTION', 'DEBT', 'RENT_CHOICE']).toContain(s.phase);
  });

  it('публичная проекция не содержит seed, rng и порядок колоды', () => {
    const v = publicView(newMatch()) as unknown as Record<string, unknown>;
    expect(v.rng).toBeUndefined();
    expect(v.seed).toBeUndefined();
    expect(v.deck).toBeUndefined();
  });
});

describe('покупка и аренда', () => {
  it('покупка списывает деньги, нехватка — отказ', () => {
    let s = rollWith(newMatch(), 1, 2);
    s = act(s, 's0', { type: 'BUY' });
    expect(s.tiles[3]!.owner).toBe('s0');
    expect(cash(s, 's0')).toBe(1380);
    expect(s.phase).toBe('POST_ROLL');
    let poor = rollWith(newMatch(), 1, 2);
    poor.players[0]!.cash = 50;
    expect(fail(poor, 's0', { type: 'BUY' })).toBe('noCash');
  });

  it('аренда, удвоение комплекта, уровни ×3/×6/×10, залог = 0', () => {
    let s = giveTiles(newMatch(), 's1', 1);
    expect(rentFor(s, 1)).toBe(10);
    s = giveTiles(s, 's1', 3);
    expect(rentFor(s, 1)).toBe(20);
    for (const [lvl, mult] of [
      [1, 3],
      [2, 6],
      [3, 10],
    ] as const) {
      s.tiles[1]!.level = lvl;
      expect(rentFor(s, 1)).toBe(10 * mult);
    }
    s.tiles[1]!.level = 0;
    s.tiles[3]!.mortgaged = true;
    expect(rentFor(s, 1)).toBe(10); // группа с залогом не удваивается
    expect(rentFor(s, 3)).toBe(0);
  });

  it('игрок платит аренду владельцу', () => {
    let s = giveTiles(newMatch(), 's1', 3);
    s.players[0]!.items = [];
    s = rollWith(s, 1, 2);
    expect(cash(s, 's0')).toBe(1488);
    expect(cash(s, 's1')).toBe(1512);
  });
});

describe('улучшения и залог', () => {
  it('равномерная стройка и продажа, запрет без полного комплекта', () => {
    let s = giveTiles(newMatch(), 's0', 1);
    expect(fail(s, 's0', { type: 'UPGRADE', tile: 1 })).toBe('needFullGroup');
    s = giveTiles(s, 's0', 3);
    s = act(s, 's0', { type: 'UPGRADE', tile: 1 });
    expect(fail(s, 's0', { type: 'UPGRADE', tile: 1 })).toBe('buildEvenly');
    s = act(s, 's0', { type: 'UPGRADE', tile: 3 });
    s = act(s, 's0', { type: 'UPGRADE', tile: 1 });
    expect(fail(s, 's0', { type: 'SELL_UPGRADE', tile: 3 })).toBe('sellEvenly');
    s = act(s, 's0', { type: 'SELL_UPGRADE', tile: 1 });
    expect(cash(s, 's0')).toBe(1500 - 150 + 25);
    expect(fail(s, 's0', { type: 'MORTGAGE', tile: 1 })).toBe('sellUpgradesFirst');
  });

  it('максимум 3 уровня', () => {
    let s = giveTiles(newMatch(), 's0', 1, 3);
    for (let i = 0; i < 3; i++) {
      s = act(s, 's0', { type: 'UPGRADE', tile: 1 });
      s = act(s, 's0', { type: 'UPGRADE', tile: 3 });
    }
    expect(fail(s, 's0', { type: 'UPGRADE', tile: 1 })).toBe('maxLevel');
  });

  it('залог 50%, выкуп 55%; круг залог/выкуп не увеличивает итоговую оценку', () => {
    let s = giveTiles(newMatch(), 's0', 27); // цена 300
    const before = liquidationValue(s, 's0');
    s = act(s, 's0', { type: 'MORTGAGE', tile: 27 });
    expect(cash(s, 's0')).toBe(1650);
    expect(liquidationValue(s, 's0')).toBe(before);
    s = act(s, 's0', { type: 'UNMORTGAGE', tile: 27 });
    expect(cash(s, 's0')).toBe(1650 - 165);
    expect(liquidationValue(s, 's0')).toBeLessThan(before);
  });

  it('продажа улучшения по кругу не даёт прироста оценки', () => {
    let s = giveTiles(newMatch(), 's0', 1, 3);
    s = act(s, 's0', { type: 'UPGRADE', tile: 1 });
    const v1 = liquidationValue(s, 's0');
    s = act(s, 's0', { type: 'SELL_UPGRADE', tile: 1 });
    expect(liquidationValue(s, 's0')).toBe(v1);
  });
});

describe('аукцион', () => {
  it('ставки, резерв лидера, продление и победитель', () => {
    let s = rollWith(newMatch(), 1, 2);
    s = act(s, 's0', { type: 'DECLINE_BUY' });
    expect(s.phase).toBe('AUCTION');
    expect(fail(s, 's1', { type: 'BID', amount: 5 })).toBe('bidTooLow');
    s = act(s, 's1', { type: 'BID', amount: 50 });
    // Одновременная вторая ставка той же суммы проверяется против уже новой ставки.
    expect(fail(s, 's2', { type: 'BID', amount: 50 })).toBe('bidTooLow');
    s = act(s, 's2', { type: 'BID', amount: 60 }, T0 + 11_000);
    expect(s.auction!.deadline).toBe(T0 + 13_000); // продлено до 2 секунд
    s = act(s, 's1', { type: 'BID', amount: 1500 }, T0 + 12_500);
    // Резерв: лидер не может потратить зарезервированное.
    expect(s.auction!.leader).toBe('s1');
    const end = advance(s, s.auction!.deadline)!.state;
    expect(end.tiles[3]!.owner).toBe('s1');
    expect(cash(end, 's1')).toBe(0);
    expect(end.phase).toBe('POST_ROLL');
  });

  it('продление ограничено 25 секундами', () => {
    let s = rollWith(newMatch(), 1, 2);
    s = act(s, 's0', { type: 'DECLINE_BUY' });
    let bid = 10;
    for (let t = 11_000; t < 30_000; t += 1_500) {
      const seat = bid % 20 === 0 ? 's1' : 's2';
      const r = applyCommand(s, seat, { type: 'BID', amount: bid }, T0 + t);
      if (!r.ok) break;
      s = r.state;
      bid += 10;
    }
    expect(s.auction?.deadline ?? T0 + 25_000).toBeLessThanOrEqual(T0 + 25_000);
  });

  it('без ставок объект остаётся у банка; все спасовали — конец раньше', () => {
    let s = rollWith(newMatch(), 1, 2);
    s = act(s, 's0', { type: 'DECLINE_BUY' });
    for (const seat of ['s0', 's1', 's2']) s = act(s, seat, { type: 'PASS_AUCTION' });
    expect(s.phase).toBe('AUCTION');
    s = act(s, 's3', { type: 'PASS_AUCTION' });
    expect(s.phase).toBe('POST_ROLL');
    expect(s.tiles[3]!.owner).toBeNull();
  });

  it('угол «Аукцион» запускает торги за свободный объект', () => {
    let s = newMatch();
    s.players[0]!.position = 5;
    s = rollWith(s, 1, 2);
    expect(s.phase).toBe('AUCTION');
    expect(s.tiles[s.auction!.tile]!.owner).toBeNull();
  });
});

describe('сделки', () => {
  it('атомарный обмен и повторная проверка при принятии', () => {
    let s = giveTiles(newMatch(), 's0', 1);
    s = giveTiles(s, 's1', 3);
    s = act(s, 's0', { type: 'PROPOSE_TRADE', to: 's1', give: { cash: 100, tiles: [1] }, get: { cash: 0, tiles: [3] } });
    expect(s.phase).toBe('TRADE');
    expect(fail(s, 's2', { type: 'ACCEPT_TRADE', offerId: s.trade!.id })).toBe('noOffer');
    s = act(s, 's1', { type: 'ACCEPT_TRADE', offerId: s.trade!.id });
    expect(s.tiles[1]!.owner).toBe('s1');
    expect(s.tiles[3]!.owner).toBe('s0');
    expect(cash(s, 's1')).toBe(1600);
    expect(s.phase).toBe('PRE_ROLL');
  });

  it('устаревшее предложение (нет денег к моменту принятия) отклоняется без списаний', () => {
    let s = giveTiles(newMatch(), 's1', 3);
    s = act(s, 's0', { type: 'PROPOSE_TRADE', to: 's1', give: { cash: 1000, tiles: [] }, get: { cash: 0, tiles: [3] } });
    s.players[0]!.cash = 10; // деньги ушли (симуляция внешнего изменения)
    s = act(s, 's1', { type: 'ACCEPT_TRADE', offerId: s.trade!.id });
    expect(s.tiles[3]!.owner).toBe('s1');
    expect(cash(s, 's1')).toBe(1500);
    expect(s.log.some((e) => e.t === 'trade' && e.result === 'invalid')).toBe(true);
  });

  it('не больше двух предложений за ход; таймаут закрывает предложение', () => {
    let s = giveTiles(newMatch(), 's1', 3);
    const offer = { type: 'PROPOSE_TRADE', to: 's1', give: { cash: 10, tiles: [] }, get: { cash: 0, tiles: [3] } } as const;
    s = act(s, 's0', offer);
    s = advance(s, s.deadline!)!.state;
    expect(s.phase).toBe('PRE_ROLL');
    s = act(s, 's0', offer);
    s = act(s, 's0', { type: 'CANCEL_TRADE' });
    expect(fail(s, 's0', offer)).toBe('tooManyOffers');
  });
});

describe('долг и банкротство', () => {
  it('нехватка денег → фаза долга, покрытие залогом', () => {
    let s = giveTiles(newMatch(), 's0', 27);
    s.players[0]!.cash = 50;
    s = rollWith(s, 2, 2); // налог 100
    expect(s.phase).toBe('DEBT');
    expect(fail(s, 's0', { type: 'PAY_DEBT' })).toBe('noCash');
    s = act(s, 's0', { type: 'MORTGAGE', tile: 27 });
    s = act(s, 's0', { type: 'PAY_DEBT' });
    expect(cash(s, 's0')).toBe(50 + 150 - 100);
    expect(s.phase).toBe('POST_ROLL');
  });

  it('истечение таймера долга → детерминированная авто-ликвидация', () => {
    let s = giveTiles(newMatch(), 's0', 1, 3, 27);
    s.tiles[1]!.level = 1;
    s.tiles[3]!.level = 1;
    s.players[0]!.cash = 20;
    s = rollWith(s, 2, 2); // налог 100
    s = advance(s, s.deadline!)!.state;
    // Сначала продаются улучшения (по 25), затем залог по возрастанию индекса: клетка 1 (+50).
    expect(s.tiles[1]!.level).toBe(0);
    expect(s.tiles[3]!.level).toBe(0);
    expect(s.tiles[1]!.mortgaged).toBe(true);
    expect(s.tiles[27]!.mortgaged).toBe(false);
    expect(cash(s, 's0')).toBe(20 + 50 + 50 - 100);
    expect(s.phase).toBe('POST_ROLL');
  });

  it('банкротство: деньги кредитору, имущество банку, роль призрака, ход дальше без пропуска', () => {
    let s = giveTiles(newMatch(), 's1', 31);
    s.tiles[31]!.level = 3; // аренда 480
    s = giveTiles(s, 's1', 30);
    s = giveTiles(s, 's0', 1);
    s.players[0]!.cash = 100;
    s.players[0]!.items = ['cone'];
    s.players[0]!.position = 28;
    s = rollWith(s, 1, 2);
    expect(s.phase).toBe('DEBT');
    s = act(s, 's0', { type: 'DECLARE_BANKRUPTCY' });
    const g = p(s, 's0');
    expect(g.role).toBe('ghost');
    expect(g.cash).toBe(0);
    expect(g.items).toEqual([]);
    expect(s.tiles[1]).toEqual({ owner: null, level: 0, mortgaged: false });
    expect(cash(s, 's1')).toBe(1500 + 100 + 50);
    expect(s.turn.seat).toBe('s1');
    // Призрак больше не получает ход.
    s = finishTurn(rollWith(s, 1, 2));
    s = finishTurn(rollWith(s, 1, 2));
    s = finishTurn(rollWith(s, 1, 2));
    expect(s.turn.seat).toBe('s1');
    expect(s.round).toBe(2);
  });

  it('последний живой побеждает сразу', () => {
    let s = newMatch({ seats: 2 });
    s = giveTiles(s, 's1', 31);
    s.tiles[31]!.level = 3;
    s = giveTiles(s, 's1', 30);
    s.players[0]!.cash = 10;
    s.players[0]!.position = 28;
    s = rollWith(s, 1, 2);
    s = act(s, 's0', { type: 'DECLARE_BANKRUPTCY' });
    expect(s.phase).toBe('FINISHED');
    expect(s.standings!.find((x) => x.winner)!.seat).toBe('s1');
  });
});

describe('раунды и финал', () => {
  it('после 12 раундов — финал по ликвидационной стоимости; равенство — совместная победа', () => {
    let s = newMatch({ seats: 2, maxRounds: 1, minigameEvery: 3 });
    s = finishTurn(rollWith(s, 2, 2));
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.phase).toBe('FINISHED');
    expect(
      s
        .standings!.filter((x) => x.winner)
        .map((x) => x.seat)
        .sort(),
    ).toEqual(['s0', 's1']);
  });

  it('выход игрока убирает его из очереди без двойного хода', () => {
    let s = newMatch();
    s = act(s, 's1', { type: 'LEAVE' });
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.turn.seat).toBe('s2');
    expect(p(s, 's1').role).toBe('left');
  });

  it('выход текущего игрока передаёт ход', () => {
    let s = rollWith(newMatch(), 1, 2);
    s = act(s, 's0', { type: 'LEAVE' });
    expect(s.turn.seat).toBe('s1');
    expect(s.phase).toBe('PRE_ROLL');
  });
});
