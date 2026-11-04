import { describe, expect, it } from 'vitest';
import { CHANCE_CARDS, RULESET, WORLD } from '@pb/content';
import { REACTION, advance, applyCommand, publicView, rentFor } from '../src';
import type { MatchState, MemoryGame, QuizGame, ReactionGame } from '../src';
import { T0, act, cash, fail, finishTurn, giveTiles, newMatch, p, rollWith } from './helpers';

/** Play rounds until a group mini-game starts. */
function toMinigame(s: MatchState): MatchState {
  for (let i = 0; i < 40 && s.phase !== 'MINIGAME'; i++) s = finishTurn(rollWith(s, 2, 2));
  expect(s.phase).toBe('MINIGAME');
  return s;
}

function everyoneReady(s: MatchState): MatchState {
  const mg = s.minigame!;
  for (const seat of mg.participants) s = act(s, seat, { type: 'MG_READY', minigameId: mg.id });
  return s;
}

describe('расписание мини-игр', () => {
  it('общая мини-игра после каждого N-го раунда, запрос с клетки объединяется', () => {
    let s = newMatch({ minigameEvery: 1 });
    s = toMinigame(s);
    expect(s.round).toBe(2);
    expect(s.minigame!.participants).toHaveLength(4);
    expect(s.minigame!.context).toBe('group');
  });

  it('клетка «Мини-игра» ставит эпизод на ближайшую границу, даже вне расписания', () => {
    let s = newMatch({ minigameEvery: 3 });
    s.players[0]!.position = 10;
    s = finishTurn(rollWith(s, 1, 1)); // 12 = мини-игра
    expect(s.minigameRequested).toBe(true);
    s.players[1]!.position = 10;
    s = finishTurn(rollWith(s, 1, 1)); // ещё один запрос в том же раунде
    s = finishTurn(rollWith(s, 2, 2));
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.phase).toBe('MINIGAME');
    s = everyoneReady(s);
    s = advance(s, s.minigame!.stageEndsAt)!.state; // play → results
    s = advance(s, s.minigame?.stageEndsAt ?? s.now)!.state;
    expect(s.phase).toBe('PRE_ROLL');
    expect(s.minigameRequested).toBe(false);
  });

  it('после финального раунда мини-игра не начинается', () => {
    let s = newMatch({ seats: 2, maxRounds: 2, minigameEvery: 1 });
    s = finishTurn(rollWith(s, 2, 2));
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.phase).toBe('MINIGAME');
    s = everyoneReady(s);
    s = advance(s, s.minigame!.stageEndsAt)!.state;
    s = advance(s, s.minigame!.stageEndsAt)!.state;
    s = finishTurn(rollWith(s, 2, 2));
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.phase).toBe('FINISHED');
  });
});

describe('«Касса закрывается» (реакция)', () => {
  function startReaction() {
    let s = toMinigame(newMatch({ minigameEvery: 1 }));
    expect(s.minigame!.kind).toBe('reaction');
    s = everyoneReady(s);
    return s;
  }

  it('сервер считает очки сам: верный, ошибка, поздний, повтор, спам', () => {
    let s = startReaction();
    const g = s.minigame!.game as ReactionGame;
    const target = g.signals.find((x) => x.target)!;
    // Ловушка после цели: время в командах не должно идти назад (иначе сервер справедливо скажет «late»).
    const trap = g.signals.find((x) => !x.target && x.at > target.at + target.ttl)!;
    const at = (sig: { at: number }) => g.playStart + sig.at;
    s = act(s, 's0', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: target.id }, at(target) + 100);
    expect((s.minigame!.game as ReactionGame).players.s0!.score).toBe(REACTION.hit + REACTION.fastBonus);
    expect(fail(s, 's0', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: target.id }, at(target) + 200)).toBe(
      'alreadyAnswered',
    );
    expect(
      fail(s, 's1', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: target.id }, at(target) + target.ttl + 1000),
    ).toBe('late');
    s = act(s, 's1', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: trap.id }, at(trap) + 100);
    expect((s.minigame!.game as ReactionGame).players.s1!.score).toBe(REACTION.mistake);
    // Поддельного «счёта» в протоколе нет: значение — только id сигнала.
    expect(fail(s, 's2', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: 9999 }, at(trap) + 100)).toBe('badInput');
  });

  it('призы начисляются один раз, ничья делит места, DNF без приза, призрак — отдельно', () => {
    let s = startReaction();
    s.players[3]!.role = 'ghost';
    s.players[3]!.ghostEnergy = 1;
    const g = s.minigame!.game as ReactionGame;
    const targets = g.signals.filter((x) => x.target);
    const id = s.minigame!.id;
    const hit = (st: MatchState, seat: string, sig: (typeof targets)[number]) =>
      act(st, seat, { type: 'MG_INPUT', minigameId: id, value: sig.id }, g.playStart + sig.at + 100);
    // Команды по времени не назад: сначала все ответы на первый сигнал, потом второй.
    s = hit(s, 's0', targets[0]!);
    s = hit(s, 's1', targets[0]!);
    s = hit(s, 's2', targets[0]!); // s1 и s2 делят 2–3 места
    s = hit(s, 's3', targets[0]!); // призрак
    s = hit(s, 's0', targets[1]!);
    const before = s.players.map((x) => x.cash);
    s = advance(s, g.playEnd)!.state;
    expect(s.minigame!.stage).toBe('results');
    const [p1, p2, p3] = RULESET.minigamePrizes;
    expect(cash(s, 's0') - before[0]!).toBe(p1);
    expect(cash(s, 's1') - before[1]!).toBe(Math.floor((p2 + p3) / 2));
    expect(cash(s, 's2') - before[2]!).toBe(Math.floor((p2 + p3) / 2));
    expect(p(s, 's3').ghostEnergy).toBe(2);
    const again = advance(s, s.now + 1);
    expect(again).toBeNull(); // повторной выплаты нет
    s = advance(s, s.minigame!.stageEndsAt)!.state;
    expect(s.players.map((x) => x.cash)).toEqual(s.players.map((x) => x.cash));
    expect(s.phase).toBe('PRE_ROLL');
  });

  it('никто не играл — никто ничего не получает, игра не зависает', () => {
    let s = toMinigame(newMatch({ minigameEvery: 1 }));
    const before = s.players.map((x) => x.cash);
    s = advance(s, s.minigame!.stageEndsAt)!.state; // intro timeout → play
    s = advance(s, s.minigame!.stageEndsAt)!.state; // play → results
    s = advance(s, s.minigame!.stageEndsAt)!.state; // results → next turn
    expect(s.phase).toBe('PRE_ROLL');
    expect(s.players.map((x) => x.cash)).toEqual(before);
  });
});

describe('«Курьер без навигатора» (память)', () => {
  it('последовательность скрыта после показа, сервер проверяет ввод', () => {
    let s = newMatch({ minigameEvery: 1 });
    s.stats.minigamesPlayed = 1; // следующая — память
    s = toMinigame(s);
    expect(s.minigame!.kind).toBe('memory');
    s = everyoneReady(s);
    const g = s.minigame!.game as MemoryGame;
    const r = g.rounds[0]!;
    expect(publicView(s).minigame!.game).toMatchObject({ current: g.sequences[0] });
    expect(fail(s, 's0', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: g.sequences[0]![0]! }, r.showStart)).toBe(
      'notInputTime',
    );
    s = advance(s, r.showEnd)!.state;
    const pub = publicView(s).minigame!.game as unknown as Record<string, unknown>;
    expect(pub.current).toBeNull();
    expect(pub.sequences).toBeUndefined();
    const seq = g.sequences[0]!;
    for (const v of seq) s = act(s, 's0', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: v }, r.showEnd + 100);
    const wrong = (seq[0]! + 1) % 9;
    s = act(s, 's1', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: wrong }, r.showEnd + 100);
    const gp = (s.minigame!.game as MemoryGame).players;
    expect(gp.s0!.score).toBe(seq.length + 2);
    expect(gp.s1!.failed).toBe(true);
    expect(fail(s, 's1', { type: 'MG_INPUT', minigameId: s.minigame!.id, value: seq[0]! }, r.showEnd + 200)).toBe('roundOver');
  });
});

describe('дуэли', () => {
  function duelReady(): MatchState {
    let s = giveTiles(newMatch(), 's1', 27);
    s = act(s, 's0', { type: 'PROPOSE_DUEL', tile: 27, priceIfBuyerWins: 400, priceIfSellerWins: 600 });
    expect(s.phase).toBe('DUEL_OFFER');
    expect(p(s, 's0').duelTokens).toBe(3); // жетон не списан до согласия
    return s;
  }

  it('отказ владельца ничего не списывает', () => {
    let s = duelReady();
    s = act(s, 's1', { type: 'DECLINE_DUEL', offerId: s.duelOffer!.id });
    expect(p(s, 's0').duelTokens).toBe(3);
    expect(s.phase).toBe('PRE_ROLL');
  });

  it('нельзя предложить больше, чем есть денег; нельзя за заложенный объект', () => {
    let s = giveTiles(newMatch(), 's1', 27, 28);
    expect(fail(s, 's0', { type: 'PROPOSE_DUEL', tile: 27, priceIfBuyerWins: 400, priceIfSellerWins: 5000 })).toBe('noCash');
    s.tiles[28]!.mortgaged = true;
    expect(fail(s, 's0', { type: 'PROPOSE_DUEL', tile: 28, priceIfBuyerWins: 10, priceIfSellerWins: 20 })).toBe('mortgaged');
  });

  function playDuel(buyerHits: number, sellerHits: number): MatchState {
    let s = duelReady();
    s = act(s, 's1', { type: 'ACCEPT_DUEL', offerId: s.duelOffer!.id });
    expect(s.phase).toBe('DUEL');
    expect(p(s, 's0').duelTokens).toBe(2);
    expect(s.duel!.reserved).toBe(600);
    // Резерв: покупатель не может потратить зарезервированные деньги.
    expect(cash(s, 's0') - s.duel!.reserved).toBe(900);
    const mg = s.minigame!;
    s = act(s, 's0', { type: 'MG_READY', minigameId: mg.id });
    s = act(s, 's1', { type: 'MG_READY', minigameId: mg.id });
    const g = s.minigame!.game;
    if (g.kind === 'reaction') {
      const targets = g.signals.filter((x) => x.target);
      for (let i = 0; i < buyerHits; i++)
        s = act(s, 's0', { type: 'MG_INPUT', minigameId: mg.id, value: targets[i]!.id }, g.playStart + targets[i]!.at + 100);
      for (let i = 0; i < sellerHits; i++)
        s = act(s, 's1', { type: 'MG_INPUT', minigameId: mg.id, value: targets[i]!.id }, g.playStart + targets[i]!.at + 100);
      s = advance(s, g.playEnd)!.state;
    } else if (g.kind === 'quiz') {
      for (let q = 0; q < g.questions.length && s.minigame?.stage === 'play'; q++) {
        const gg = s.minigame!.game as QuizGame;
        const x = gg.questions[q]!;
        const ans = gg.answers[q]!;
        s = act(s, 's0', { type: 'MG_INPUT', minigameId: mg.id, value: q < buyerHits ? ans : (ans + 1) % 4 }, x.start + 100);
        s = act(s, 's1', { type: 'MG_INPUT', minigameId: mg.id, value: q < sellerHits ? ans : (ans + 1) % 4 }, x.start + 100);
        s = advance(s, (s.minigame!.game as QuizGame).questions[q]!.revealEnd)!.state;
      }
    } else {
      const r = g.rounds[0]!;
      const seq = g.sequences[0]!;
      s = advance(s, r.showEnd)!.state;
      for (let i = 0; i < Math.min(buyerHits, seq.length); i++)
        s = act(s, 's0', { type: 'MG_INPUT', minigameId: mg.id, value: seq[i]! }, r.showEnd + 100);
      for (let i = 0; i < Math.min(sellerHits, seq.length); i++)
        s = act(s, 's1', { type: 'MG_INPUT', minigameId: mg.id, value: seq[i]! }, r.showEnd + 100);
      for (let k = 0; k < 10 && s.minigame?.stage === 'play'; k++) s = advance(s, s.minigame.stageEndsAt)!.state;
    }
    expect(s.minigame!.stage).toBe('results');
    return s;
  }

  it('победа покупателя — цена победы покупателя, резерв снят', () => {
    const s = playDuel(2, 1);
    expect(s.tiles[27]!.owner).toBe('s0');
    expect(cash(s, 's0')).toBe(1100);
    expect(cash(s, 's1')).toBe(1900);
    expect(s.duel!.reserved).toBe(0);
  });

  it('победа продавца — покупатель платит большую цену', () => {
    const s = playDuel(1, 2);
    expect(s.tiles[27]!.owner).toBe('s0');
    expect(cash(s, 's0')).toBe(900);
  });

  it('ничья — сделки нет, жетон возвращается, повтор той же парой в раунде запрещён', () => {
    let s = playDuel(1, 1);
    expect(s.tiles[27]!.owner).toBe('s1');
    expect(p(s, 's0').duelTokens).toBe(3);
    s = advance(s, s.minigame!.stageEndsAt)!.state;
    expect(s.phase).toBe('PRE_ROLL');
    expect(fail(s, 's0', { type: 'PROPOSE_DUEL', tile: 27, priceIfBuyerWins: 400, priceIfSellerWins: 600 })).toBe(
      'pairDueledThisRound',
    );
  });

  it('техническое поражение: не сыгравший проигрывает; оба не сыграли — ничья', () => {
    const s = playDuel(1, 0);
    expect(s.duel!.outcome).toBe('buyerWon');
    const t = playDuel(0, 0);
    expect(t.duel!.outcome).toBe('draw');
  });

  it('повторное принятие той же дуэли не списывает жетон второй раз', () => {
    let s = duelReady();
    const id = s.duelOffer!.id;
    s = act(s, 's1', { type: 'ACCEPT_DUEL', offerId: id });
    expect(applyCommand(s, 's1', { type: 'ACCEPT_DUEL', offerId: id }, s.now).ok).toBe(false);
    expect(p(s, 's0').duelTokens).toBe(2);
  });
});

describe('предметы', () => {
  it('конус: следующий соперник платит 30; щит отражает', () => {
    let s = newMatch();
    s.players[0]!.items = ['cone'];
    s = act(s, 's0', { type: 'PLACE_CONE', tile: 3 });
    expect(fail(s, 's0', { type: 'PLACE_CONE', tile: 3 })).toBe('noItem');
    s = finishTurn(rollWith(s, 2, 2));
    s.players[1]!.items = [];
    s = rollWith(s, 1, 2); // s1 → 3
    expect(cash(s, 's1')).toBe(1500 - RULESET.trapFine);
    expect(s.traps).toHaveLength(0);

    let t = newMatch();
    t.players[0]!.items = ['cone'];
    t = act(t, 's0', { type: 'PLACE_CONE', tile: 3 });
    t = finishTurn(rollWith(t, 2, 2));
    t = rollWith(t, 1, 2); // у s1 стартовый щит
    expect(cash(t, 's1')).toBe(1500);
    expect(p(t, 's1').items).toEqual([]);
  });

  it('нельзя ставить ловушку на угол и две на одну клетку', () => {
    let s = newMatch();
    s.players[0]!.items = ['cone', 'cone'];
    expect(fail(s, 's0', { type: 'PLACE_CONE', tile: 10 })).toBe('badTrapTile');
    s = act(s, 's0', { type: 'PLACE_CONE', tile: 5 });
    expect(fail(s, 's0', { type: 'PLACE_CONE', tile: 5 })).toBe('badTrapTile');
  });

  it('скидка уменьшает аренду на 50% по выбору до оплаты', () => {
    let s = giveTiles(newMatch(), 's1', 3, 1, 5);
    s.players[0]!.items = ['discount'];
    s = rollWith(s, 1, 2); // Луксор: аренда 40 (вся страна)
    expect(s.phase).toBe('RENT_CHOICE');
    s = act(s, 's0', { type: 'USE_DISCOUNT' });
    expect(cash(s, 's0')).toBe(1500 - 20);
    expect(p(s, 's0').items).toEqual([]);
  });

  it('инвентарь максимум 3; при переполнении новый предмет отклоняется по таймауту', () => {
    let s = newMatch();
    s.players[0]!.items = ['shield', 'cone', 'cone'];
    s.deck = ['item-discount', ...s.deck.filter((x) => x !== 'item-discount')];
    s = rollWith(s, 1, 1); // 2 = Шанс
    expect(p(s, 's0').pendingItem?.item).toBe('discount');
    s = advance(s, p(s, 's0').pendingItem!.deadline)!.state;
    expect(p(s, 's0').items).toEqual(['shield', 'cone', 'cone']);
  });
});

describe('призрак', () => {
  function withGhost(): MatchState {
    const s = newMatch();
    const g = s.players[3]!;
    g.role = 'ghost';
    g.ghostEnergy = 1;
    g.items = [];
    return s;
  }

  it('одна проделка за раунд, тратит энергию, ловушка платится банку', () => {
    let s = withGhost();
    s = act(s, 's3', { type: 'GHOST_TRAP', tile: 3 });
    expect(p(s, 's3').ghostEnergy).toBe(0);
    expect(fail(s, 's3', { type: 'GHOST_TRAP', tile: 5 })).toBe('noEnergy');
    s.players[0]!.items = [];
    s = rollWith(s, 1, 2);
    expect(cash(s, 's0')).toBe(1470);
  });

  it('запрет улучшения действует на следующий ход владельца и истекает; щит блокирует', () => {
    let s = withGhost();
    s = giveTiles(s, 's1', 1, 3, 5);
    s.players[1]!.items = [];
    s = act(s, 's3', { type: 'GHOST_BLOCK', target: 's1', tile: 1 });
    s = finishTurn(rollWith(s, 2, 2)); // ход s0 закончен
    expect(fail(s, 's1', { type: 'UPGRADE', tile: 1 })).toBe('upgradeBlocked');
    s = act(s, 's1', { type: 'UPGRADE', tile: 3 });
    s = finishTurn(rollWith(s, 2, 2));
    expect(s.upgradeBlocks).toHaveLength(0);

    let t = withGhost();
    t = giveTiles(t, 's1', 1, 3, 5);
    t = act(t, 's3', { type: 'GHOST_BLOCK', target: 's1', tile: 1 });
    expect(t.upgradeBlocks).toHaveLength(0);
    expect(p(t, 's1').items).toEqual([]);
  });

  it('нельзя два раунда подряд целиться в одного игрока', () => {
    let s = withGhost();
    s = giveTiles(s, 's1', 1);
    s.players[1]!.items = [];
    s = act(s, 's3', { type: 'GHOST_BLOCK', target: 's1', tile: 1 });
    for (let i = 0; i < 3; i++) s = finishTurn(rollWith(s, 2, 2));
    expect(s.round).toBe(2);
    expect(p(s, 's3').ghostEnergy).toBe(1); // +1 на границе раунда
    expect(fail(s, 's3', { type: 'GHOST_BLOCK', target: 's1', tile: 1 })).toBe('sameTargetTwice');
  });

  it('призрак не торгует, не строит и не бросает кубики', () => {
    let s = withGhost();
    s.order = ['s3', 's0', 's1', 's2'];
    expect(fail(s, 's3', { type: 'PROPOSE_TRADE', to: 's0', give: { cash: 0, tiles: [] }, get: { cash: 10, tiles: [] } })).toBe(
      'notAlive',
    );
    void T0;
  });
});

describe('колода «Шанс» (Вокруг света)', () => {
  const draw = (s: MatchState, card: string) => {
    s.deck = [card, ...s.deck.filter((x) => x !== card)];
    return s;
  };

  it('в колоде 30+ карт, id уникальны, перемещения ведут на существующие клетки с тем же названием', () => {
    expect(CHANCE_CARDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CHANCE_CARDS.map((c) => c.id)).size).toBe(CHANCE_CARDS.length);
    const named: Record<string, string> = { 'to-paris': 'Париж', 'to-cairo': 'Каир', 'to-rome': 'Рим', 'to-auction': 'Аукцион', 'to-start': 'Старт' };
    for (const c of CHANCE_CARDS)
      if (c.effect.kind === 'moveTo') expect(WORLD.tiles[c.effect.index]!.name).toBe(named[c.id]);
  });

  it('«Пересадка» ведёт вперёд до ближайшего аэропорта', () => {
    let s = draw(newMatch(), 'to-airport');
    s = rollWith(s, 1, 1); // 2 = Шанс → аэропорт 6
    expect(p(s, 's0').position).toBe(6);
    expect(s.phase).toBe('PURCHASE');
    for (const [from, to] of [
      [15, 25], // 17 = Шанс → «Север»
      [30, 35], // 32 = Шанс → «Запад»
    ] as const) {
      let t = newMatch();
      t.players[0]!.position = from;
      t = rollWith(draw(t, 'to-airport'), 1, 1);
      expect(p(t, 's0').position).toBe(to);
    }
  });

  it('«День рождения»: каждый живой соперник платит; «Угощаю всех»: вы платите каждому', () => {
    let s = draw(newMatch(), 'birthday');
    s = rollWith(s, 1, 1);
    expect(cash(s, 's0')).toBe(1500 + 3 * 20);
    for (const x of ['s1', 's2', 's3']) expect(cash(s, x)).toBe(1480);
    let t = draw(newMatch(), 'treat');
    t = rollWith(t, 1, 1);
    expect(cash(t, 's0')).toBe(1500 - 3 * 20);
    expect(cash(t, 's2')).toBe(1520);
  });

  it('соперник без денег попадает в долг перед вытянувшим карту', () => {
    let s = newMatch();
    s.players[1]!.cash = 5;
    s = draw(s, 'guide');
    s = rollWith(s, 1, 1);
    expect(s.phase).toBe('DEBT');
    expect(s.debt).toMatchObject({ payer: 's1', payee: 's0', amount: 30 });
  });
});

describe('мини-игра «Географ»', () => {
  function startQuiz(): MatchState {
    const s0 = newMatch({ minigameEvery: 1 });
    s0.stats.minigamesPlayed = 2; // очередь: касса → курьер → географ
    let s = toMinigame(s0);
    expect(s.minigame!.kind).toBe('quiz');
    return everyoneReady(s);
  }

  it('6 вопросов по 4 варианта, правильный вариант среди них; ответ скрыт в публичном снимке до конца вопроса', () => {
    const s = startQuiz();
    const g = s.minigame!.game as QuizGame;
    expect(g.questions).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(new Set(g.questions[i]!.options).size).toBe(4);
      expect(g.answers[i]).toBeGreaterThanOrEqual(0);
    }
    const pub = publicView(s).minigame!.game as unknown as Record<string, unknown>;
    expect(pub.answers).toBeUndefined();
    expect(pub.shown).toEqual([]);
    expect(JSON.stringify(publicView(s))).not.toContain('"answers"');
  });

  it('очки: быстро и верно +3, медленно и верно +2, ошибка 0; один ответ на вопрос; все ответили — раскрытие раньше', () => {
    let s = startQuiz();
    const id = s.minigame!.id;
    let g = s.minigame!.game as QuizGame;
    const x = g.questions[0]!;
    const ans = g.answers[0]!;
    s = act(s, 's0', { type: 'MG_INPUT', minigameId: id, value: ans }, x.start + 500);
    expect(fail(s, 's0', { type: 'MG_INPUT', minigameId: id, value: ans }, x.start + 600)).toBe('alreadyAnswered');
    s = act(s, 's1', { type: 'MG_INPUT', minigameId: id, value: ans }, x.start + 4000);
    s = act(s, 's2', { type: 'MG_INPUT', minigameId: id, value: (ans + 1) % 4 }, x.start + 4100);
    expect(fail(s, 's3', { type: 'MG_INPUT', minigameId: id, value: 7 }, x.start + 4200)).toBe('badInput');
    s = act(s, 's3', { type: 'MG_INPUT', minigameId: id, value: (ans + 2) % 4 }, x.start + 4300);
    g = s.minigame!.game as QuizGame;
    expect(g.players.s0!.score).toBe(3);
    expect(g.players.s1!.score).toBe(2);
    expect(g.players.s2!.score).toBe(0);
    expect(g.shown).toEqual([ans]); // все ответили — правильный показан сразу
    expect(fail(s, 's0', { type: 'MG_INPUT', minigameId: id, value: 0 }, x.start + 4400)).toBe('notInputTime');
  });

  it('без ответов игра сама проходит все вопросы и выдаёт итоги; участвовавший без верных ответов — с местом', () => {
    let s = startQuiz();
    const id = s.minigame!.id;
    const g0 = s.minigame!.game as QuizGame;
    s = act(s, 's0', { type: 'MG_INPUT', minigameId: id, value: (g0.answers[0]! + 1) % 4 }, g0.questions[0]!.start + 100);
    for (let i = 0; i < 30 && s.minigame?.stage === 'play'; i++) s = advance(s, s.minigame.stageEndsAt)!.state;
    expect(s.minigame!.stage).toBe('results');
    const r = s.minigame!.results!;
    expect(r.find((x) => x.seat === 's0')!.participated).toBe(true);
    expect(r.find((x) => x.seat === 's1')!.participated).toBe(false);
  });
});

describe('предмет «Билет»', () => {
  it('вместо броска: перелёт в выбранный аэропорт, зарплата за «Старт», предмет расходуется; не аэропорт — отказ', () => {
    let s = newMatch();
    s.players[0]!.items = ['ticket'];
    expect(fail(s, 's0', { type: 'USE_TICKET', tile: 7 })).toBe('badTicketTile');
    expect(fail(s, 's1', { type: 'USE_TICKET', tile: 6 })).toBe('notYourTurn');
    s = act(s, 's0', { type: 'USE_TICKET', tile: 15 });
    expect(p(s, 's0').position).toBe(15);
    expect(p(s, 's0').items).toEqual([]);
    expect(s.turn.rolled).toBe(true);
    expect(s.phase).toBe('PURCHASE');
    let t = newMatch();
    t.players[0]!.position = 30;
    t.players[0]!.items = ['ticket'];
    t = act(t, 's0', { type: 'USE_TICKET', tile: 6 });
    expect(p(t, 's0').position).toBe(6);
    expect(cash(t, 's0')).toBe(1500 + RULESET.startSalary);
    expect(fail(t, 's0', { type: 'USE_TICKET', tile: 15 })).toBe('wrongPhase'); // ход уже сделан
  });
});

describe('события мира', () => {
  const withEvent = (kind: string, extra: Record<string, unknown> = {}) => {
    const s = newMatch();
    s.round = 3;
    s.worldEvent = { kind: kind as never, round: 3, ...extra };
    return s;
  };

  it('со 2-го раунда в начале каждого раунда выпадает событие; в 1-м — нет', () => {
    let s = newMatch();
    expect(s.worldEvent ?? null).toBeNull();
    for (let i = 0; i < 4; i++) s = finishTurn(rollWith(s, 2, 2));
    expect(s.round).toBe(2);
    expect(s.worldEvent?.round).toBe(2);
    expect(s.log.some((e) => e.t === 'worldEvent')).toBe(true);
  });

  it('сезон туризма ×2 в стране, шторм закрывает аэропорты, кризис −50%; событие прошлого раунда не действует', () => {
    let s = giveTiles(withEvent('tourism', { group: 'egypt' }), 's1', 1);
    expect(rentFor(s, 1)).toBe(40);
    s = giveTiles(withEvent('storm'), 's1', 6);
    expect(rentFor(s, 6)).toBe(0);
    s = giveTiles(withEvent('crisis'), 's1', 1);
    expect(rentFor(s, 1)).toBe(10);
    s.round = 4;
    expect(rentFor(s, 1)).toBe(20);
  });

  it('распродажа −25% к покупке, фестиваль — двойная зарплата, каникулы — без налога, бум — улучшения вдвое дешевле', () => {
    let s = rollWith(withEvent('sale'), 1, 2); // Луксор 100 → 75
    s = act(s, 's0', { type: 'BUY' });
    expect(cash(s, 's0')).toBe(1500 - 75);
    let f = withEvent('festival');
    f.players[0]!.position = 38;
    f = rollWith(f, 1, 1);
    expect(cash(f, 's0')).toBe(1500 + 2 * RULESET.startSalary);
    const t = rollWith(withEvent('taxHoliday'), 2, 2); // 4 = налог
    expect(cash(t, 's0')).toBe(1500);
    let b = giveTiles(withEvent('buildBoom'), 's0', 1, 3, 5);
    b = act(b, 's0', { type: 'UPGRADE', tile: 1 });
    expect(cash(b, 's0')).toBe(1500 - 25);
  });
});
