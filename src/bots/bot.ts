// ИИ бота. Работает только через публичный интерфейс движка: смотрит на состояние
// и возвращает действие. Проверка допустимости — через validate() движка.
import {
  GROUPS,
  GROUP_ORDER,
  TILES,
  checkBuild,
  checkMortgage,
  checkSellBuilding,
  checkUnmortgage,
  currentPlayer,
  getActor,
  getPlayer,
  isTradeableTile,
  liquidationValue,
  mortgageValue,
  ownedTiles,
  ownsFullGroup,
  rentFor,
  tile,
  unmortgageCost,
  validate,
} from '../engine';
import type { Action, GameState, OwnershipState, PlayerId, TradeOffer, TradeSide } from '../engine';

export interface BotProfile {
  /** Множитель желания покупать (1 — норма). */
  greed: number;
  /** Минимальный денежный резерв. */
  baseReserve: number;
}

export const DEFAULT_PROFILE: BotProfile = { greed: 1, baseReserve: 120 };

function ok(state: GameState, action: Action): boolean {
  return validate(state, action) === null;
}

function tryCheck(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

/** Резерв: сколько держать на руках, учитывая самую опасную аренду соперников. */
export function reserveFor(s: GameState, me: PlayerId, profile: BotProfile = DEFAULT_PROFILE): number {
  let maxRent = 0;
  for (const t of TILES) {
    const o = s.ownership[t.index];
    if (o?.owner && o.owner !== me) maxRent = Math.max(maxRent, rentFor(s, t.index, 7));
  }
  return Math.min(600, profile.baseReserve + Math.round(maxRent * 0.4));
}

/** Оценка всего имущества игрока при данном распределении собственности. */
export function assetScore(s: GameState, player: PlayerId, ownership: (OwnershipState | null)[] = s.ownership): number {
  let score = 0;
  const owns = (i: number) => ownership[i]?.owner === player;
  for (const t of TILES) {
    if (!owns(t.index)) continue;
    const o = ownership[t.index]!;
    score += (t.price ?? 0) * (o.mortgaged ? 0.55 : 1);
  }
  for (const g of GROUP_ORDER) {
    const tiles = GROUPS[g].tiles;
    const mine = tiles.filter(owns).length;
    const groupPrice = tiles.reduce((acc, i) => acc + tile(i).price!, 0);
    const othersOwn = tiles.some((i) => ownership[i]?.owner && ownership[i]!.owner !== player);
    if (mine === tiles.length) score += groupPrice * 1.6;
    else if (mine === tiles.length - 1) score += groupPrice * (othersOwn ? 0.3 : 0.4);
    else if (!othersOwn && mine > 0) score += groupPrice * 0.15 * mine;
  }
  const transports = TILES.filter((t) => t.kind === 'transport' && owns(t.index)).length;
  score += [0, 0, 60, 180, 360][transports] ?? 0;
  const utils = TILES.filter((t) => t.kind === 'utility' && owns(t.index)).length;
  if (utils === 2) score += 60;
  return score;
}

/** Насколько ценна свободная клетка для игрока (для покупки и аукциона). */
export function tileValueFor(s: GameState, player: PlayerId, index: number): number {
  const before = assetScore(s, player);
  const after = structuredClone(s.ownership);
  after[index] = { owner: player, houses: 0, mortgaged: false };
  let value = assetScore(s, player, after) - before;
  // Защитная ценность: не дать сопернику собрать группу.
  const g = tile(index).group;
  if (g) {
    const others = GROUPS[g].tiles.filter((i) => i !== index).map((i) => s.ownership[i]?.owner);
    const rival = others[0];
    if (rival && rival !== player && others.every((o) => o === rival)) value += tile(index).price! * 0.5;
  }
  return value;
}

function sideScoreDelta(s: GameState, player: PlayerId, gives: TradeSide, gets: TradeSide): number {
  const after = structuredClone(s.ownership);
  for (const t of gives.tiles) after[t]!.owner = '__other__';
  for (const t of gets.tiles) after[t]!.owner = player;
  return assetScore(s, player, after) - assetScore(s, player) + gets.cash - gives.cash + (gets.jailCards - gives.jailCards) * 40;
}

/** Минимальная выгода и доля от выгоды партнёра, при которых бот соглашается на сделку. */
const TRADE_MIN_GAIN = 25;
const TRADE_FAIR_SHARE = 0.35;

/** Решение по входящему предложению. */
export function evaluateTrade(s: GameState, me: PlayerId, offer: TradeOffer): boolean {
  // offer.give — что получаю я, offer.get — что отдаю.
  const myDelta = sideScoreDelta(s, me, offer.get, offer.give);
  const theirDelta = sideScoreDelta(s, offer.from, offer.give, offer.get);
  const meP = getPlayer(s, me);
  if (meP.cash - offer.get.cash < 40) return false;
  return myDelta > TRADE_MIN_GAIN && myDelta >= theirDelta * TRADE_FAIR_SHARE;
}

function planTrade(s: GameState, me: PlayerId, profile: BotProfile): Action | null {
  const p = getPlayer(s, me);
  const reserve = reserveFor(s, me, profile);
  for (const g of GROUP_ORDER) {
    const tiles = GROUPS[g].tiles;
    const mine = tiles.filter((i) => s.ownership[i]?.owner === me);
    const missing = tiles.filter((i) => s.ownership[i]?.owner !== me);
    if (mine.length === 0 || missing.length === 0) continue;
    // Покупаем у каждого владельца его часть группы (иногда это шаг к монополии).
    const owners = [...new Set(missing.map((i) => s.ownership[i]?.owner))];
    for (const owner of owners) {
      if (!owner || owner === me) continue;
      const theirs = missing.filter((i) => s.ownership[i]?.owner === owner);
      if (!theirs.every((i) => isTradeableTile(s, owner, i))) continue;
      const get: TradeSide = { cash: 0, tiles: theirs, jailCards: 0 };
      const give: TradeSide = { cash: 0, tiles: [], jailCards: 0 };
      // Подсластитель: клетка, которой сопернику не хватает до его группы.
      const sweetener = ownedTiles(s, me).find((i) => {
        if (!isTradeableTile(s, me, i) || tiles.includes(i)) return false;
        const tg = tile(i).group;
        if (!tg) return false;
        return GROUPS[tg].tiles.filter((x) => x !== i).every((x) => s.ownership[x]?.owner === owner);
      });
      if (sweetener !== undefined) give.tiles = [sweetener];
      const myGain = sideScoreDelta(s, me, give, get);
      const theirBase = sideScoreDelta(s, owner, get, give);
      // Минимальная доплата, при которой соперник (по нашей же модели) согласится.
      const need = Math.max(TRADE_MIN_GAIN + 1 - theirBase, (TRADE_FAIR_SHARE * myGain - theirBase) / (1 + TRADE_FAIR_SHARE));
      const cash = Math.max(0, Math.ceil((need * 1.1) / 10) * 10);
      if (myGain - cash < 60) continue;
      if (p.cash - cash < reserve * 0.6) continue;
      give.cash = cash;
      const action: Action = { type: 'PROPOSE_TRADE', player: me, to: owner, give, get };
      if (ok(s, action)) return action;
    }
  }
  return null;
}

function bestBuild(s: GameState, me: PlayerId, budget: number): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const i of ownedTiles(s, me)) {
    const t = tile(i);
    if (t.kind !== 'property' || t.houseCost! > budget) continue;
    if (!tryCheck(() => checkBuild(s, me, i))) continue;
    const o = s.ownership[i]!;
    const gain = t.rent![o.houses + 1]! - (o.houses === 0 ? t.rent![0]! * 2 : t.rent![o.houses]!);
    const score = gain / t.houseCost!;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function raiseFunds(s: GameState, me: PlayerId): Action | null {
  // 1. Продаём постройки там, где их больше всего.
  let sell: number | null = null;
  let maxH = 0;
  for (const i of ownedTiles(s, me)) {
    const h = s.ownership[i]!.houses;
    if (h > maxH && tryCheck(() => checkSellBuilding(s, me, i))) {
      maxH = h;
      sell = i;
    }
  }
  // 2. Сначала закладываем то, что не входит в полные группы, и дешёвое.
  const mortgageable = ownedTiles(s, me).filter((i) => tryCheck(() => checkMortgage(s, me, i)));
  mortgageable.sort((a, b) => {
    const fa = tile(a).group && ownsFullGroup(s, me, tile(a).group!) ? 1 : 0;
    const fb = tile(b).group && ownsFullGroup(s, me, tile(b).group!) ? 1 : 0;
    return fa - fb || mortgageValue(a) - mortgageValue(b);
  });
  if (mortgageable.length > 0) return { type: 'MORTGAGE', player: me, tile: mortgageable[0]! };
  if (sell !== null) return { type: 'SELL_BUILDING', player: me, tile: sell };
  return null;
}

export function chooseBotAction(s: GameState, me: PlayerId, profile: BotProfile = DEFAULT_PROFILE): Action | null {
  if (getActor(s) !== me) return null;
  const p = getPlayer(s, me);
  const reserve = reserveFor(s, me, profile);

  if (s.trade && s.trade.to === me) {
    return evaluateTrade(s, me, s.trade) ? { type: 'ACCEPT_TRADE', player: me } : { type: 'REJECT_TRADE', player: me };
  }

  switch (s.phase) {
    case 'debt': {
      const d = s.debts[0]!;
      if (p.cash >= d.amount) return { type: 'PAY_DEBT', player: me };
      if (liquidationValue(s, me) < d.amount) return { type: 'DECLARE_BANKRUPTCY', player: me };
      return raiseFunds(s, me) ?? { type: 'DECLARE_BANKRUPTCY', player: me };
    }
    case 'auction': {
      const au = s.auction!;
      const value = tileValueFor(s, me, au.tile) * profile.greed;
      const cap = Math.min(value, p.cash - Math.round(reserve * 0.5));
      const step = au.highBid < 100 ? 10 : au.highBid < 300 ? 20 : 50;
      const bid = Math.max(au.highBid + 1, Math.ceil((au.highBid + step) / step) * step);
      if (bid <= cap) return { type: 'BID', player: me, amount: bid };
      return { type: 'PASS_AUCTION', player: me };
    }
    case 'buy': {
      const t = tile(p.position);
      const price = t.price!;
      const value = tileValueFor(s, me, t.index) * profile.greed;
      const completes = !!t.group && GROUPS[t.group].tiles.every((i) => i === t.index || s.ownership[i]?.owner === me);
      const canAfford = p.cash - price >= (completes ? 0 : reserve);
      if (canAfford && value >= price * 0.8 && ok(s, { type: 'BUY', player: me })) return { type: 'BUY', player: me };
      return { type: 'DECLINE_BUY', player: me };
    }
    case 'roll':
    case 'endTurn': {
      const mgmt = manage(s, me, reserve, profile);
      if (mgmt) return mgmt;
      if (s.phase === 'endTurn') return { type: 'END_TURN', player: me };
      if (p.inJail) {
        if (p.jailCards.length > 0) return { type: 'USE_JAIL_CARD', player: me };
        const freeTiles = s.ownership.filter((o) => o && o.owner === null).length;
        if (freeTiles > 8 && p.cash - s.settings.jailFine > reserve && ok(s, { type: 'PAY_JAIL_FINE', player: me })) {
          return { type: 'PAY_JAIL_FINE', player: me };
        }
      }
      return { type: 'ROLL', player: me };
    }
    default:
      return null;
  }
}

function manage(s: GameState, me: PlayerId, reserve: number, profile: BotProfile): Action | null {
  const p = getPlayer(s, me);
  if (currentPlayer(s).id !== me) return null;
  // Выкуп из залога, прежде всего в полных группах.
  const mortgaged = ownedTiles(s, me).filter((i) => s.ownership[i]!.mortgaged);
  mortgaged.sort((a, b) => {
    const fa = tile(a).group && ownsFullGroup(s, me, tile(a).group!) ? 0 : 1;
    const fb = tile(b).group && ownsFullGroup(s, me, tile(b).group!) ? 0 : 1;
    return fa - fb;
  });
  for (const i of mortgaged) {
    if (p.cash - unmortgageCost(i) > reserve + 150 && tryCheck(() => checkUnmortgage(s, me, i))) {
      return { type: 'UNMORTGAGE', player: me, tile: i };
    }
  }
  // Строительство.
  const build = bestBuild(s, me, p.cash - reserve);
  if (build !== null) return { type: 'BUILD', player: me, tile: build };
  // Сделка: каждый третий круг, чтобы не заваливать соперников предложениями.
  const round = Math.floor((s.turn - 1) / s.players.length);
  if (s.tradesThisTurn === 0 && round % 3 === 0 && s.phase === 'roll') {
    const trade = planTrade(s, me, profile);
    if (trade) return trade;
  }
  return null;
}
