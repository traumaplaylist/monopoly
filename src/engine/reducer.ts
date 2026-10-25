// Редьюсер: (состояние, действие) → новое состояние + события. Вся валидация — здесь.
import { BOARD_SIZE, JAIL_INDEX, TILES, mortgageValue, tile, unmortgageCost } from './board';
import { CARDS, card } from './cards';
import { Rng } from './rng';
import {
  HOTEL,
  MAX_HOUSES,
  RuleError,
  activePlayers,
  checkBuild,
  checkMortgage,
  checkSellBuilding,
  checkUnmortgage,
  currentPlayer,
  ensure,
  findPlayer,
  getPlayer,
  isTradeableTile,
  netWorth,
  own,
  ownedTiles,
  rentFor,
} from './rules';
import type {
  Action,
  ActionResult,
  DeckId,
  GameEvent,
  GameState,
  MoneyReason,
  Phase,
  Player,
  PlayerId,
  TradeSide,
} from './types';

export const LOG_LIMIT = 120;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EventInput = DistributiveOmit<GameEvent, 'seq'>;

interface Ctx {
  s: GameState;
  rng: Rng;
  events: GameEvent[];
  /** Игрок встал на свободную клетку — после разрешения событий предложить покупку. */
  pendingBuy: boolean;
}

function emit(ctx: Ctx, e: EventInput): void {
  ctx.s.eventSeq += 1;
  ctx.events.push({ ...e, seq: ctx.s.eventSeq } as GameEvent);
}

export function applyAction(state: GameState, action: Action): ActionResult {
  const s = structuredClone(state);
  const ctx: Ctx = { s, rng: new Rng(s.rng), events: [], pendingBuy: false };
  try {
    ensure(s.phase !== 'gameOver', 'gameOver');
    const actor = findPlayer(s, action.player);
    ensure(actor && !actor.bankrupt, 'unknownPlayer');
    handle(ctx, action);
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.code };
    throw e;
  }
  s.rng = ctx.rng.state;
  s.log = [...s.log, ...ctx.events].slice(-LOG_LIMIT);
  return { ok: true, state: s, events: ctx.events };
}

/** Проверка без изменения состояния: null — действие допустимо, иначе код ошибки. */
export function validate(state: GameState, action: Action): string | null {
  const r = applyAction(state, action);
  return r.ok ? null : r.error;
}

function handle(ctx: Ctx, a: Action): void {
  const { s } = ctx;
  switch (a.type) {
    case 'ROLL': {
      requireTurn(s, a.player, 'roll');
      return roll(ctx);
    }
    case 'BUY': {
      requireTurn(s, a.player, 'buy');
      const p = getPlayer(s, a.player);
      const t = tile(p.position);
      ensure(p.cash >= t.price!, 'noCash');
      transfer(ctx, p.id, null, t.price!, 'purchase', t.index);
      own(s, t.index).owner = p.id;
      emit(ctx, { t: 'bought', player: p.id, tile: t.index, price: t.price! });
      return continueTurn(ctx);
    }
    case 'DECLINE_BUY': {
      requireTurn(s, a.player, 'buy');
      const p = getPlayer(s, a.player);
      const participants = seatOrderFrom(s, s.current).map((x) => x.id);
      s.auction = { tile: p.position, highBid: 0, highBidder: null, participants, turn: participants[0]! };
      s.phase = 'auction';
      emit(ctx, { t: 'auctionStart', tile: p.position });
      return;
    }
    case 'BID': {
      const au = requireAuctionTurn(s, a.player);
      const p = getPlayer(s, a.player);
      ensure(Number.isInteger(a.amount) && a.amount > au.highBid && a.amount >= 1, 'bidTooLow');
      ensure(a.amount <= p.cash, 'noCash');
      au.highBid = a.amount;
      au.highBidder = p.id;
      emit(ctx, { t: 'bid', player: p.id, amount: a.amount });
      return advanceAuction(ctx, p.id);
    }
    case 'PASS_AUCTION': {
      const au = requireAuctionTurn(s, a.player);
      au.participants = au.participants.filter((id) => id !== a.player);
      emit(ctx, { t: 'auctionPass', player: a.player });
      return advanceAuction(ctx, a.player);
    }
    case 'BUILD': {
      checkBuild(s, a.player, a.tile);
      const o = own(s, a.tile);
      const t = tile(a.tile);
      if (o.houses === MAX_HOUSES) {
        s.bank.hotels -= 1;
        s.bank.houses += MAX_HOUSES;
      } else {
        s.bank.houses -= 1;
      }
      o.houses += 1;
      transfer(ctx, a.player, null, t.houseCost!, 'build', a.tile);
      emit(ctx, { t: 'built', player: a.player, tile: a.tile, houses: o.houses });
      return;
    }
    case 'SELL_BUILDING': {
      checkSellBuilding(s, a.player, a.tile);
      const o = own(s, a.tile);
      const t = tile(a.tile);
      let removedLevels = 1;
      if (o.houses === HOTEL) {
        // Отель меняется на 4 дома; если домов в банке не хватает — на сколько есть.
        const housesBack = Math.min(MAX_HOUSES, s.bank.houses);
        s.bank.hotels += 1;
        s.bank.houses -= housesBack;
        removedLevels = HOTEL - housesBack;
        o.houses = housesBack;
      } else {
        s.bank.houses += 1;
        o.houses -= 1;
      }
      receive(ctx, a.player, Math.floor((t.houseCost! * removedLevels) / 2), 'sellBuilding', a.tile);
      emit(ctx, { t: 'soldBuilding', player: a.player, tile: a.tile, houses: o.houses });
      return;
    }
    case 'MORTGAGE': {
      checkMortgage(s, a.player, a.tile);
      own(s, a.tile).mortgaged = true;
      receive(ctx, a.player, mortgageValue(a.tile), 'mortgage', a.tile);
      emit(ctx, { t: 'mortgaged', player: a.player, tile: a.tile });
      return;
    }
    case 'UNMORTGAGE': {
      checkUnmortgage(s, a.player, a.tile);
      own(s, a.tile).mortgaged = false;
      transfer(ctx, a.player, null, unmortgageCost(a.tile), 'unmortgage', a.tile);
      emit(ctx, { t: 'unmortgaged', player: a.player, tile: a.tile });
      return;
    }
    case 'PAY_JAIL_FINE': {
      requireTurn(s, a.player, 'roll');
      const p = getPlayer(s, a.player);
      ensure(p.inJail, 'notInJail');
      ensure(p.cash >= s.settings.jailFine, 'noCash');
      transfer(ctx, p.id, null, s.settings.jailFine, 'jailFine');
      releaseFromJail(ctx, p, 'fine');
      return;
    }
    case 'USE_JAIL_CARD': {
      requireTurn(s, a.player, 'roll');
      const p = getPlayer(s, a.player);
      ensure(p.inJail, 'notInJail');
      const deck = p.jailCards.shift();
      ensure(deck, 'noJailCard');
      s.decks[deck].push(jailCardId(deck));
      releaseFromJail(ctx, p, 'card');
      return;
    }
    case 'PROPOSE_TRADE': {
      requireTurn(s, a.player, s.phase === 'endTurn' ? 'endTurn' : 'roll');
      ensure(s.tradesThisTurn < s.settings.maxTradesPerTurn, 'tooManyTrades');
      const to = findPlayer(s, a.to);
      ensure(to && !to.bankrupt && to.id !== a.player, 'badTradePartner');
      validateTradeSide(s, a.player, a.give);
      validateTradeSide(s, a.to, a.get);
      ensure(!isEmptySide(a.give) || !isEmptySide(a.get), 'emptyTrade');
      s.tradesThisTurn += 1;
      s.trade = { id: s.nextTradeId++, from: a.player, to: a.to, give: cloneSide(a.give), get: cloneSide(a.get) };
      emit(ctx, { t: 'tradeProposed', offer: structuredClone(s.trade) });
      return;
    }
    case 'ACCEPT_TRADE': {
      const tr = s.trade;
      ensure(tr && tr.to === a.player, 'noTrade');
      validateTradeSide(s, tr.from, tr.give);
      validateTradeSide(s, tr.to, tr.get);
      executeTradeSide(ctx, tr.from, tr.to, tr.give);
      executeTradeSide(ctx, tr.to, tr.from, tr.get);
      s.trade = null;
      emit(ctx, { t: 'tradeResolved', offer: tr, result: 'accepted' });
      return;
    }
    case 'REJECT_TRADE': {
      const tr = s.trade;
      ensure(tr && tr.to === a.player, 'noTrade');
      s.trade = null;
      emit(ctx, { t: 'tradeResolved', offer: tr, result: 'rejected' });
      return;
    }
    case 'CANCEL_TRADE': {
      const tr = s.trade;
      ensure(tr && tr.from === a.player, 'noTrade');
      s.trade = null;
      emit(ctx, { t: 'tradeResolved', offer: tr, result: 'cancelled' });
      return;
    }
    case 'PAY_DEBT': {
      ensure(s.phase === 'debt', 'notNow');
      const d = s.debts[0];
      ensure(d && d.debtor === a.player, 'notYourDebt');
      ensure(getPlayer(s, a.player).cash >= d.amount, 'noCash');
      s.debts.shift();
      transfer(ctx, d.debtor, d.creditor, d.amount, d.reason);
      return afterDebtStep(ctx);
    }
    case 'DECLARE_BANKRUPTCY': {
      ensure(s.phase === 'debt', 'notNow');
      const d = s.debts[0];
      ensure(d && d.debtor === a.player, 'notYourDebt');
      bankrupt(ctx, a.player, d.creditor);
      if ((s.phase as Phase) === 'gameOver') return;
      return afterDebtStep(ctx);
    }
    case 'END_TURN': {
      requireTurn(s, a.player, 'endTurn');
      return nextTurn(ctx);
    }
    default: {
      const never: never = a;
      throw new RuleError(`unknownAction:${(never as Action).type}`);
    }
  }
}

// ---------- проверки ----------

function requireTurn(s: GameState, player: PlayerId, phase: Phase): void {
  ensure(s.phase === phase, 'wrongPhase');
  ensure(!s.trade, 'tradePending');
  ensure(currentPlayer(s).id === player, 'notYourTurn');
}

function requireAuctionTurn(s: GameState, player: PlayerId) {
  ensure(s.phase === 'auction' && s.auction, 'noAuction');
  ensure(s.auction.turn === player, 'notYourTurn');
  return s.auction;
}

function isEmptySide(side: TradeSide): boolean {
  return side.cash === 0 && side.tiles.length === 0 && side.jailCards === 0;
}

function cloneSide(side: TradeSide): TradeSide {
  return { cash: side.cash, tiles: [...side.tiles], jailCards: side.jailCards };
}

function validateTradeSide(s: GameState, owner: PlayerId, side: TradeSide): void {
  const p = getPlayer(s, owner);
  ensure(Number.isInteger(side.cash) && side.cash >= 0 && side.cash <= p.cash, 'tradeCash');
  ensure(Number.isInteger(side.jailCards) && side.jailCards >= 0 && side.jailCards <= p.jailCards.length, 'tradeJailCards');
  ensure(new Set(side.tiles).size === side.tiles.length, 'tradeTiles');
  for (const t of side.tiles)
    ensure(Number.isInteger(t) && t >= 0 && t < BOARD_SIZE && isTradeableTile(s, owner, t), 'tradeTiles');
}

function executeTradeSide(ctx: Ctx, from: PlayerId, to: PlayerId, side: TradeSide): void {
  const { s } = ctx;
  if (side.cash > 0) transfer(ctx, from, to, side.cash, 'trade');
  for (const t of side.tiles) own(s, t).owner = to;
  const pf = getPlayer(s, from);
  const pt = getPlayer(s, to);
  for (let i = 0; i < side.jailCards; i++) pt.jailCards.push(pf.jailCards.shift()!);
}

// ---------- деньги ----------

function transfer(
  ctx: Ctx,
  from: PlayerId | null,
  to: PlayerId | null,
  amount: number,
  reason: MoneyReason,
  tileIdx?: number,
): void {
  if (amount <= 0) return;
  if (from) {
    const p = getPlayer(ctx.s, from);
    if (p.cash < amount) throw new Error(`Внутренняя ошибка: недостаточно средств у ${from}`);
    p.cash -= amount;
  }
  if (to) getPlayer(ctx.s, to).cash += amount;
  emit(ctx, { t: 'money', from, to, amount, reason, ...(tileIdx !== undefined ? { tile: tileIdx } : {}) });
}

function receive(ctx: Ctx, player: PlayerId, amount: number, reason: MoneyReason, tileIdx?: number): void {
  transfer(ctx, null, player, amount, reason, tileIdx);
}

/** Списать деньги: сразу, если хватает, иначе — долг, который игрок должен погасить. */
function charge(
  ctx: Ctx,
  debtor: PlayerId,
  creditor: PlayerId | null,
  amount: number,
  reason: MoneyReason,
  tileIdx?: number,
): void {
  if (amount <= 0) return;
  const p = getPlayer(ctx.s, debtor);
  const hasQueued = ctx.s.debts.some((d) => d.debtor === debtor);
  if (!hasQueued && p.cash >= amount) {
    transfer(ctx, debtor, creditor, amount, reason, tileIdx);
    return;
  }
  ctx.s.debts.push({ debtor, creditor, amount, reason });
  emit(ctx, { t: 'debt', debtor, creditor, amount });
}

// ---------- ход ----------

function seatOrderFrom(s: GameState, startIndex: number): Player[] {
  const res: Player[] = [];
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[(startIndex + k) % s.players.length]!;
    if (!p.bankrupt) res.push(p);
  }
  return res;
}

function roll(ctx: Ctx): void {
  const d1 = ctx.rng.int(1, 6);
  const d2 = ctx.rng.int(1, 6);
  resolveRoll(ctx, d1, d2);
}

/** Разрешение броска с заданными кубиками (вынесено для тестов). */
export function resolveRoll(ctx: Ctx, d1: number, d2: number): void {
  const { s } = ctx;
  const p = currentPlayer(s);
  const doubles = d1 === d2;
  s.dice = [d1, d2];
  emit(ctx, { t: 'rolled', player: p.id, dice: [d1, d2], doubles });

  if (p.inJail) {
    s.extraRoll = false;
    if (doubles) {
      releaseFromJail(ctx, p, 'doubles');
      moveBy(ctx, p, d1 + d2);
    } else {
      p.jailTurns += 1;
      if (p.jailTurns >= 3) {
        charge(ctx, p.id, null, s.settings.jailFine, 'jailFine');
        releaseFromJail(ctx, p, 'forcedFine');
        moveBy(ctx, p, d1 + d2);
      } else {
        emit(ctx, { t: 'jailStay', player: p.id, attempt: p.jailTurns });
      }
    }
    return continueTurn(ctx);
  }

  s.doublesCount = doubles ? s.doublesCount + 1 : 0;
  if (s.doublesCount >= 3) {
    sendToJail(ctx, p, 'doubles');
    return continueTurn(ctx);
  }
  s.extraRoll = doubles;
  moveBy(ctx, p, d1 + d2);
  continueTurn(ctx);
}

function releaseFromJail(ctx: Ctx, p: Player, how: 'doubles' | 'fine' | 'card' | 'forcedFine'): void {
  p.inJail = false;
  p.jailTurns = 0;
  emit(ctx, { t: 'leftJail', player: p.id, how });
}

function sendToJail(ctx: Ctx, p: Player, reason: 'card' | 'tile' | 'doubles'): void {
  const from = p.position;
  p.position = JAIL_INDEX;
  p.inJail = true;
  p.jailTurns = 0;
  ctx.s.doublesCount = 0;
  ctx.s.extraRoll = false;
  emit(ctx, { t: 'moved', player: p.id, from, to: JAIL_INDEX, steps: 0, passedStart: false, direct: true });
  emit(ctx, { t: 'jailed', player: p.id, reason });
}

type Special = 'doubleTransport' | 'utility10' | undefined;

function moveBy(ctx: Ctx, p: Player, steps: number, special?: Special): void {
  const from = p.position;
  const raw = from + steps;
  const to = ((raw % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const passedStart = steps > 0 && raw >= BOARD_SIZE;
  p.position = to;
  emit(ctx, { t: 'moved', player: p.id, from, to, steps, passedStart, direct: false });
  if (passedStart) receive(ctx, p.id, ctx.s.settings.startBonus, 'start');
  landOn(ctx, p, special);
}

function moveForwardTo(ctx: Ctx, p: Player, target: number, special?: Special): void {
  const steps = (target - p.position + BOARD_SIZE) % BOARD_SIZE;
  moveBy(ctx, p, steps === 0 ? BOARD_SIZE : steps, special);
}

function landOn(ctx: Ctx, p: Player, special?: Special): void {
  const { s } = ctx;
  const t = tile(p.position);
  switch (t.kind) {
    case 'property':
    case 'transport':
    case 'utility': {
      const o = own(s, t.index);
      if (o.owner === null) {
        ctx.pendingBuy = true;
      } else if (o.owner !== p.id && !o.mortgaged) {
        const diceSum = s.dice ? s.dice[0] + s.dice[1] : 0;
        charge(ctx, p.id, o.owner, rentFor(s, t.index, diceSum, special), 'rent', t.index);
      }
      return;
    }
    case 'tax':
      return charge(ctx, p.id, null, t.tax!, 'tax', t.index);
    case 'card':
      return drawCard(ctx, p, t.deck!);
    case 'goToJail':
      return sendToJail(ctx, p, 'tile');
    default:
      return;
  }
}

function jailCardId(deck: DeckId): number {
  return CARDS[deck].find((c) => c.effect.kind === 'jailCard')!.id;
}

function drawCard(ctx: Ctx, p: Player, deck: DeckId): void {
  const { s } = ctx;
  const id = s.decks[deck].shift();
  if (id === undefined) return; // все карты на руках — колода пуста
  const c = card(deck, id);
  emit(ctx, { t: 'card', player: p.id, deck, card: id });
  const e = c.effect;
  if (e.kind === 'jailCard') {
    p.jailCards.push(deck);
    return;
  }
  s.decks[deck].push(id);
  switch (e.kind) {
    case 'money':
      if (e.amount > 0) receive(ctx, p.id, e.amount, 'card');
      else charge(ctx, p.id, null, -e.amount, 'card');
      return;
    case 'moveTo':
      return moveForwardTo(ctx, p, e.tile);
    case 'moveBack':
      return moveBy(ctx, p, -e.steps);
    case 'nearest': {
      const kind = e.target;
      let i = p.position;
      do i = (i + 1) % BOARD_SIZE;
      while (TILES[i]!.kind !== kind);
      return moveForwardTo(ctx, p, i, kind === 'transport' ? 'doubleTransport' : 'utility10');
    }
    case 'jail':
      return sendToJail(ctx, p, 'card');
    case 'repairs': {
      let total = 0;
      for (const i of ownedTiles(s, p.id)) {
        const h = s.ownership[i]!.houses;
        total += h === HOTEL ? e.hotel : h * e.house;
      }
      return charge(ctx, p.id, null, total, 'card');
    }
    case 'payEach':
      for (const other of activePlayers(s)) if (other.id !== p.id) charge(ctx, p.id, other.id, e.amount, 'card');
      return;
    case 'collectEach':
      for (const other of activePlayers(s)) if (other.id !== p.id) charge(ctx, other.id, p.id, e.amount, 'card');
      return;
  }
}

/** Куда идёт ход после того, как событие разрешено (покупка/аукцион/долг закрыты). */
function turnContinuation(s: GameState): Phase {
  const p = currentPlayer(s);
  return s.extraRoll && !p.inJail && !p.bankrupt ? 'roll' : 'endTurn';
}

function continueTurn(ctx: Ctx): void {
  const { s } = ctx;
  const next: Phase = ctx.pendingBuy ? 'buy' : turnContinuation(s);
  ctx.pendingBuy = false;
  if (s.debts.length > 0) {
    s.phase = 'debt';
    s.resumePhase = next;
  } else {
    s.phase = next;
  }
}

function afterDebtStep(ctx: Ctx): void {
  const { s } = ctx;
  if (s.debts.length > 0) return; // следующий должник
  const resume = s.resumePhase ?? 'endTurn';
  s.resumePhase = null;
  if (currentPlayer(s).bankrupt) return nextTurn(ctx);
  s.phase = resume === 'roll' ? turnContinuation(s) : resume;
}

function advanceAuction(ctx: Ctx, lastActor: PlayerId): void {
  const { s } = ctx;
  const au = s.auction!;
  const contenders = au.participants.filter((id) => id !== au.highBidder);
  if (contenders.length === 0) return finishAuction(ctx);
  const seat = s.players.findIndex((p) => p.id === lastActor);
  for (let k = 1; k <= s.players.length; k++) {
    const p = s.players[(seat + k) % s.players.length]!;
    if (contenders.includes(p.id)) {
      au.turn = p.id;
      return;
    }
  }
}

function finishAuction(ctx: Ctx): void {
  const { s } = ctx;
  const au = s.auction!;
  if (au.highBidder) {
    transfer(ctx, au.highBidder, null, au.highBid, 'auction', au.tile);
    own(s, au.tile).owner = au.highBidder;
  }
  emit(ctx, { t: 'auctionEnd', tile: au.tile, winner: au.highBidder, price: au.highBidder ? au.highBid : 0 });
  s.auction = null;
  continueTurn(ctx);
}

function bankrupt(ctx: Ctx, playerId: PlayerId, creditor: PlayerId | null): void {
  const { s } = ctx;
  const p = getPlayer(s, playerId);
  // 1. Постройки продаются банку за полцены.
  for (const i of ownedTiles(s, playerId)) {
    const o = s.ownership[i]!;
    if (o.houses > 0) {
      const t = tile(i);
      if (o.houses === HOTEL) s.bank.hotels += 1;
      else s.bank.houses += o.houses;
      p.cash += Math.floor((o.houses * t.houseCost!) / 2);
      o.houses = 0;
    }
  }
  // 2. Имущество — кредитору или банку.
  const cash = p.cash;
  p.cash = 0;
  if (creditor) {
    const c = getPlayer(s, creditor);
    c.cash += cash;
    if (cash > 0) emit(ctx, { t: 'money', from: playerId, to: creditor, amount: cash, reason: 'bankruptcy' });
    for (const i of ownedTiles(s, playerId)) s.ownership[i]!.owner = creditor;
    c.jailCards.push(...p.jailCards);
  } else {
    for (const i of ownedTiles(s, playerId)) {
      s.ownership[i] = { owner: null, houses: 0, mortgaged: false };
    }
    for (const d of p.jailCards) s.decks[d].push(jailCardId(d));
  }
  p.jailCards = [];
  p.bankrupt = true;
  p.inJail = false;
  // 3. Долги банкрота и долги перед ним аннулируются.
  s.debts = s.debts.filter((d) => d.debtor !== playerId && d.creditor !== playerId);
  emit(ctx, { t: 'bankrupt', player: playerId, creditor });

  const alive = activePlayers(s);
  if (alive.length <= 1) {
    s.phase = 'gameOver';
    s.winner = alive[0]?.id ?? null;
    s.debts = [];
    emit(ctx, { t: 'gameOver', winner: s.winner, reason: 'lastStanding' });
  }
}

function nextTurn(ctx: Ctx): void {
  const { s } = ctx;
  const next = seatOrderFrom(s, s.current + 1)[0]!;
  const nextIndex = s.players.indexOf(next);
  if (nextIndex <= s.current) s.round += 1;
  s.current = nextIndex;
  s.phase = 'roll';
  s.doublesCount = 0;
  s.extraRoll = false;
  s.tradesThisTurn = 0;
  s.turn += 1;
  if (s.settings.maxRounds > 0 && s.round > s.settings.maxRounds) {
    const ranking = activePlayers(s).sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id));
    s.phase = 'gameOver';
    s.winner = ranking[0]?.id ?? null;
    emit(ctx, { t: 'gameOver', winner: s.winner, reason: 'roundLimit' });
    return;
  }
  emit(ctx, { t: 'turnStart', player: next.id, turn: s.turn });
}

// Экспорт внутренностей для модульных тестов (детерминированные броски).
export const __test = {
  makeCtx(state: GameState): Ctx {
    return { s: structuredClone(state), rng: new Rng(state.rng), events: [], pendingBuy: false };
  },
  rollWith(state: GameState, d1: number, d2: number): GameState {
    const ctx = __test.makeCtx(state);
    ensure(ctx.s.phase === 'roll' && !ctx.s.trade, 'wrongPhase');
    resolveRoll(ctx, d1, d2);
    ctx.s.log = [...ctx.s.log, ...ctx.events].slice(-LOG_LIMIT);
    return ctx.s;
  },
};
