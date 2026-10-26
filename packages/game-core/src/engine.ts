// Authoritative rules engine for ruleset V1.
// (state, seat, command, serverNow) -> new state + events. Pure: no I/O, no real clock, seeded RNG inside state.
import { CHANCE_CARDS, GROUPS, RULESET, RULES_VERSION, groupTiles, pct } from '@pb/content';
import type { ItemKind } from '@pb/content';
import { RuleError, commit, emit, ensure, makeCtx } from './ctx';
import type { Ctx } from './ctx';
import { createMinigame, dropParticipant, minigameDeadline, minigameInput, minigameReady, tickMinigame } from './minigames';
import { Rng, seedToState } from './rng';
import {
  BOARD_SIZE,
  MAP,
  alivePlayers,
  available,
  canPlaceTrap,
  currentSeat,
  groupHasUpgrades,
  groupOf,
  isLocked,
  isTradeableTile,
  liquidationValue,
  mortgageValue,
  own,
  ownedTiles,
  ownsFullGroup,
  player,
  rentFor,
  tileDef,
  unmortgageCost,
  upgradeCost,
} from './rules';
import type {
  Command,
  MatchSettings,
  MatchState,
  MinigameKind,
  MoneyReason,
  Obligation,
  Phase,
  PlayerState,
  Result,
  SeatId,
  TradeSide,
} from './types';
import { SCHEMA_VERSION } from './types';

export const PLAYER_COLORS = ['#e2574c', '#2a9d9a', '#e8a33a', '#8a52c9'];

export interface SeatInit {
  seat: SeatId;
  name: string;
  avatar: number;
}

export interface CreateMatchOptions {
  matchId: string;
  seed: number;
  seats: SeatInit[];
  settings?: Partial<MatchSettings>;
  now: number;
}

export function createMatch(opts: CreateMatchOptions): MatchState {
  const settings: MatchSettings = {
    minigameEvery: RULESET.minigameEveryRoundsDefault,
    maxRounds: RULESET.maxRounds,
    debug: false,
    ...opts.settings,
  };
  if (!settings.debug && opts.seats.length !== RULESET.seats) throw new Error(`Match needs ${RULESET.seats} seats`);
  if (opts.seats.length < 2 || opts.seats.length > RULESET.seats) throw new Error('2..4 seats required');
  const rng = new Rng(seedToState(opts.seed));
  const order = rng.shuffle(opts.seats.map((x) => x.seat));
  const players: PlayerState[] = opts.seats.map((x, i) => ({
    seat: x.seat,
    name: x.name,
    avatar: x.avatar,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
    role: 'alive',
    cash: RULESET.startCash,
    position: 0,
    items: ['shield'],
    duelTokens: RULESET.duelTokens,
    ghostEnergy: 0,
    ghostPrankRound: 0,
    ghostTargets: {},
    pranksDone: 0,
    pendingItem: null,
  }));
  const s: MatchState = {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    matchId: opts.matchId,
    revision: 1,
    seed: opts.seed,
    rng: 0,
    settings,
    startedAt: opts.now,
    now: opts.now,
    players,
    order,
    turnIndex: 0,
    round: 1,
    phase: 'PRE_ROLL',
    deadline: opts.now + RULESET.turnDecisionMs,
    tiles: MAP.tiles.map((t) => (t.kind === 'property' ? { owner: null, level: 0, mortgaged: false } : null)),
    turn: { seat: order[0]!, seq: 1, rolled: false, dice: null, tradeOffers: 0, duelHint: false },
    pending: [],
    purchaseTile: null,
    cornerAuction: false,
    auction: null,
    debt: null,
    trade: null,
    duelOffer: null,
    duel: null,
    minigame: null,
    resume: null,
    traps: [],
    upgradeBlocks: [],
    minigameRequested: false,
    duelPairsThisRound: [],
    deck: rng.shuffle(CHANCE_CARDS.map((c) => c.id)),
    nextId: 1,
    finishedAt: null,
    standings: null,
    eventSeq: 1,
    log: [{ t: 'turnStart', seq: 1, at: opts.now, seat: order[0]!, round: 1 }],
    stats: { minigamesPlayed: 0, duelsPlayed: 0, phaseSince: opts.now, phaseTime: {} },
  };
  s.rng = rng.state;
  return s;
}

// ---------------------------------------------------------------- public API

/** Apply a player command at server time `now`. Expired deadlines are processed first. */
export function applyCommand(state: MatchState, seat: SeatId, cmd: Command, now: number): Result {
  const ctx = makeCtx(state, now);
  try {
    advanceCtx(ctx);
    ensure(ctx.s.phase !== 'FINISHED', 'finished');
    handle(ctx, seat, cmd);
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.code };
    throw e;
  }
  ctx.s.revision += 1;
  return { ok: true, state: commit(ctx), events: ctx.events };
}

/** Process all deadlines that have passed. Returns null when nothing changed. */
export function advance(state: MatchState, now: number): { state: MatchState; events: MatchState['log'] } | null {
  const ctx = makeCtx(state, now);
  advanceCtx(ctx);
  if (!ctx.changed) return null;
  ctx.s.revision += 1;
  return { state: commit(ctx), events: ctx.events };
}

/** Earliest moment the state changes on its own. */
export function nextDeadline(s: MatchState): number | null {
  if (s.phase === 'FINISHED') return null;
  const ds: number[] = [];
  if (s.minigame) ds.push(minigameDeadline(s.minigame));
  else if (s.deadline !== null) ds.push(s.deadline);
  for (const p of s.players) if (p.pendingItem) ds.push(p.pendingItem.deadline);
  return ds.length ? Math.min(...ds) : null;
}

// ---------------------------------------------------------------- time

function advanceCtx(ctx: Ctx): void {
  const s = ctx.s;
  for (let guard = 0; guard < 50; guard++) {
    if (s.phase === 'FINISHED') return;
    let did = false;
    for (const p of s.players) {
      if (p.pendingItem && p.pendingItem.deadline <= ctx.now) {
        emit(ctx, { t: 'item', seat: p.seat, item: p.pendingItem.item, action: 'dropped' });
        p.pendingItem = null;
        did = true;
      }
    }
    if (s.minigame) {
      const before = s.minigame.stage;
      const done = tickMinigame(ctx, s.minigame);
      applyMinigameOutcome(ctx);
      if (done) {
        endMinigame(ctx);
        did = true;
      } else if (s.minigame && s.minigame.stage !== before) did = true;
    } else if (s.deadline !== null && s.deadline <= ctx.now) {
      onTimeout(ctx);
      did = true;
    }
    if (!did) return;
  }
}

function onTimeout(ctx: Ctx): void {
  const s = ctx.s;
  const seat = currentSeat(s);
  switch (s.phase) {
    case 'PRE_ROLL':
      return roll(ctx);
    case 'PURCHASE':
      return startAuction(ctx, s.purchaseTile!, 'decline');
    case 'AUCTION':
      return finishAuction(ctx);
    case 'RENT_CHOICE':
      return proceed(ctx);
    case 'DEBT':
      return settleDebt(ctx, true);
    case 'POST_ROLL':
      return endTurn(ctx);
    case 'TRADE':
      emit(ctx, { t: 'trade', offer: s.trade!, result: 'expired' });
      s.trade = null;
      return resumeTurn(ctx);
    case 'DUEL_OFFER':
      emit(ctx, { t: 'duel', offer: s.duelOffer!, result: 'expired' });
      s.duelOffer = null;
      return resumeTurn(ctx);
    default:
      void seat;
      s.deadline = null;
  }
}

function setPhase(ctx: Ctx, phase: Phase, ms: number | null): void {
  const s = ctx.s;
  if (s.phase !== phase) {
    s.stats.phaseTime[s.phase] = (s.stats.phaseTime[s.phase] ?? 0) + (ctx.now - s.stats.phaseSince);
    s.stats.phaseSince = ctx.now;
  }
  s.phase = phase;
  s.deadline = ms === null ? null : ctx.now + ms;
  ctx.changed = true;
}

// ---------------------------------------------------------------- commands

function handle(ctx: Ctx, seat: SeatId, cmd: Command): void {
  const s = ctx.s;
  const me = player(s, seat);
  ensure(me.role !== 'left', 'left');
  switch (cmd.type) {
    case 'ROLL':
      requireTurn(s, seat, ['PRE_ROLL']);
      return roll(ctx);
    case 'BUY': {
      requireTurn(s, seat, ['PURCHASE']);
      const t = tileDef(s.purchaseTile!);
      ensure(available(s, seat) >= t.price!, 'noCash');
      transfer(ctx, seat, null, t.price!, 'purchase', t.index);
      own(s, t.index).owner = seat;
      emit(ctx, { t: 'bought', seat, tile: t.index, price: t.price! });
      s.purchaseTile = null;
      return proceed(ctx);
    }
    case 'DECLINE_BUY':
      requireTurn(s, seat, ['PURCHASE']);
      return startAuction(ctx, s.purchaseTile!, 'decline');
    case 'BID':
      return bid(ctx, seat, cmd.amount);
    case 'PASS_AUCTION': {
      const au = s.auction;
      ensure(s.phase === 'AUCTION' && au, 'wrongPhase');
      ensure(me.role === 'alive', 'notAlive');
      ensure(au.leader !== seat, 'leaderCannotPass');
      if (!au.passed.includes(seat)) au.passed.push(seat);
      ctx.changed = true;
      if (alivePlayers(s).every((p) => p.seat === au.leader || au.passed.includes(p.seat))) finishAuction(ctx);
      return;
    }
    case 'USE_DISCOUNT': {
      requireTurn(s, seat, ['RENT_CHOICE']);
      const o = s.pending[0]!;
      const k = me.items.indexOf('discount');
      ensure(k >= 0, 'noItem');
      me.items.splice(k, 1);
      o.amount -= pct(o.amount, RULESET.discountRate);
      emit(ctx, { t: 'item', seat, item: 'discount', action: 'used' });
      return proceed(ctx);
    }
    case 'PAY_FULL':
      requireTurn(s, seat, ['RENT_CHOICE']);
      return proceed(ctx);
    case 'UPGRADE':
      return upgrade(ctx, seat, cmd.tile);
    case 'SELL_UPGRADE':
      return sellUpgrade(ctx, seat, cmd.tile);
    case 'MORTGAGE':
      return mortgage(ctx, seat, cmd.tile);
    case 'UNMORTGAGE': {
      requireManage(s, seat, false);
      const o = own(s, cmd.tile);
      ensure(o.owner === seat, 'notOwner');
      ensure(o.mortgaged, 'notMortgaged');
      ensure(!isLocked(s, cmd.tile), 'locked');
      const cost = unmortgageCost(cmd.tile);
      ensure(available(s, seat) >= cost, 'noCash');
      transfer(ctx, seat, null, cost, 'unmortgage', cmd.tile);
      o.mortgaged = false;
      emit(ctx, { t: 'mortgaged', seat, tile: cmd.tile, mortgaged: false });
      return;
    }
    case 'PAY_DEBT':
      ensure(s.phase === 'DEBT' && s.debt?.payer === seat, 'wrongPhase');
      ensure(available(s, seat) >= s.debt.amount, 'noCash');
      return settleDebt(ctx, false);
    case 'DECLARE_BANKRUPTCY':
      // Auto-liquidates everything allowed; bankrupt only if that still does not cover the debt.
      ensure(s.phase === 'DEBT' && s.debt?.payer === seat, 'wrongPhase');
      return settleDebt(ctx, true);
    case 'END_TURN':
      requireTurn(s, seat, ['POST_ROLL']);
      return endTurn(ctx);
    case 'PROPOSE_TRADE':
      return proposeTrade(ctx, seat, cmd.to, cmd.give, cmd.get);
    case 'ACCEPT_TRADE': {
      const tr = s.trade;
      ensure(s.phase === 'TRADE' && tr && tr.to === seat && tr.id === cmd.offerId, 'noOffer');
      try {
        validateSide(s, tr.from, tr.give);
        validateSide(s, tr.to, tr.get);
      } catch (e) {
        emit(ctx, { t: 'trade', offer: tr, result: 'invalid' });
        s.trade = null;
        resumeTurn(ctx);
        return;
      }
      s.trade = null; // unlock before transfer
      executeSide(ctx, tr.from, tr.to, tr.give);
      executeSide(ctx, tr.to, tr.from, tr.get);
      emit(ctx, { t: 'trade', offer: tr, result: 'accepted' });
      return resumeTurn(ctx);
    }
    case 'REJECT_TRADE': {
      const tr = s.trade;
      ensure(s.phase === 'TRADE' && tr && tr.to === seat && tr.id === cmd.offerId, 'noOffer');
      s.trade = null;
      emit(ctx, { t: 'trade', offer: tr, result: 'rejected' });
      return resumeTurn(ctx);
    }
    case 'CANCEL_TRADE': {
      const tr = s.trade;
      ensure(s.phase === 'TRADE' && tr && tr.from === seat, 'noOffer');
      s.trade = null;
      emit(ctx, { t: 'trade', offer: tr, result: 'cancelled' });
      return resumeTurn(ctx);
    }
    case 'PROPOSE_DUEL':
      return proposeDuel(ctx, seat, cmd.tile, cmd.priceIfBuyerWins, cmd.priceIfSellerWins);
    case 'ACCEPT_DUEL':
      return acceptDuel(ctx, seat, cmd.offerId);
    case 'DECLINE_DUEL': {
      const d = s.duelOffer;
      ensure(s.phase === 'DUEL_OFFER' && d && d.seller === seat && d.id === cmd.offerId, 'noOffer');
      s.duelOffer = null;
      emit(ctx, { t: 'duel', offer: d, result: 'declined' });
      return resumeTurn(ctx);
    }
    case 'CANCEL_DUEL': {
      const d = s.duelOffer;
      ensure(s.phase === 'DUEL_OFFER' && d && d.buyer === seat, 'noOffer');
      s.duelOffer = null;
      emit(ctx, { t: 'duel', offer: d, result: 'cancelled' });
      return resumeTurn(ctx);
    }
    case 'PLACE_CONE': {
      requireTurn(s, seat, ['PRE_ROLL', 'POST_ROLL']);
      const k = me.items.indexOf('cone');
      ensure(k >= 0, 'noItem');
      ensure(canPlaceTrap(s, cmd.tile), 'badTrapTile');
      me.items.splice(k, 1);
      s.traps.push({ tile: cmd.tile, placer: seat, source: 'cone' });
      emit(ctx, { t: 'item', seat, item: 'cone', action: 'used' });
      emit(ctx, { t: 'trap', seat, tile: cmd.tile, action: 'placed', by: seat });
      return;
    }
    case 'REPLACE_ITEM': {
      const pi = me.pendingItem;
      ensure(pi, 'noPendingItem');
      if (cmd.drop === null) {
        emit(ctx, { t: 'item', seat, item: pi.item, action: 'dropped' });
      } else {
        ensure(Number.isInteger(cmd.drop) && cmd.drop >= 0 && cmd.drop < me.items.length, 'badSlot');
        const old = me.items[cmd.drop]!;
        me.items[cmd.drop] = pi.item;
        emit(ctx, { t: 'item', seat, item: old, action: 'dropped' });
        emit(ctx, { t: 'item', seat, item: pi.item, action: 'gained' });
      }
      me.pendingItem = null;
      return;
    }
    case 'GHOST_TRAP':
    case 'GHOST_BLOCK':
      return ghostPrank(ctx, me, cmd);
    case 'MG_READY': {
      const mg = s.minigame;
      ensure(mg && mg.id === cmd.minigameId && mg.participants.includes(seat), 'noMinigame');
      minigameReady(ctx, mg, seat);
      ctx.changed = true;
      return;
    }
    case 'MG_INPUT': {
      const mg = s.minigame;
      ensure(mg && mg.id === cmd.minigameId && mg.participants.includes(seat), 'noMinigame');
      minigameInput(ctx, mg, seat, cmd.value);
      ctx.changed = true;
      applyMinigameOutcome(ctx);
      return;
    }
    case 'LEAVE':
      return leave(ctx, seat);
    default: {
      const never: never = cmd;
      throw new RuleError(`unknownCommand:${(never as Command).type}`);
    }
  }
}

function requireTurn(s: MatchState, seat: SeatId, phases: Phase[]): void {
  ensure(phases.includes(s.phase), 'wrongPhase');
  ensure(currentSeat(s) === seat, 'notYourTurn');
  ensure(player(s, seat).role === 'alive', 'notAlive');
}

/** Property management: own turn in a calm window, or selling/mortgaging while in debt. */
function requireManage(s: MatchState, seat: SeatId, raising: boolean): void {
  if (raising && s.phase === 'DEBT' && s.debt?.payer === seat) return;
  requireTurn(s, seat, ['PRE_ROLL', 'POST_ROLL']);
}

// ---------------------------------------------------------------- money

function transfer(ctx: Ctx, from: SeatId | null, to: SeatId | null, amount: number, reason: MoneyReason, tile?: number): void {
  if (amount <= 0) return;
  if (from) {
    const p = player(ctx.s, from);
    if (p.cash < amount) throw new Error(`internal: insufficient cash for ${from}`);
    p.cash -= amount;
  }
  if (to) player(ctx.s, to).cash += amount;
  emit(ctx, { t: 'money', from, to, amount, reason, ...(tile !== undefined ? { tile } : {}) });
}

function gainItem(ctx: Ctx, p: PlayerState, item: ItemKind): void {
  if (p.items.length < RULESET.inventorySlots) {
    p.items.push(item);
    emit(ctx, { t: 'item', seat: p.seat, item, action: 'gained' });
  } else {
    p.pendingItem = { item, deadline: ctx.now + RULESET.rentChoiceMs };
    ctx.changed = true;
  }
}

// ---------------------------------------------------------------- turn flow

function startTurn(ctx: Ctx): void {
  const s = ctx.s;
  const seat = currentSeat(s);
  s.turn = { seat, seq: s.turn.seq + 1, rolled: false, dice: null, tradeOffers: 0, duelHint: false };
  s.purchaseTile = null;
  s.cornerAuction = false;
  emit(ctx, { t: 'turnStart', seat, round: s.round });
  setPhase(ctx, 'PRE_ROLL', RULESET.turnDecisionMs);
}

function roll(ctx: Ctx, fixed?: [number, number]): void {
  const s = ctx.s;
  const p = player(s, currentSeat(s));
  const d1 = fixed ? fixed[0] : ctx.rng.int(1, 6);
  const d2 = fixed ? fixed[1] : ctx.rng.int(1, 6);
  s.turn.rolled = true;
  s.turn.dice = [d1, d2];
  emit(ctx, { t: 'rolled', seat: p.seat, dice: [d1, d2] });
  moveBy(ctx, p, d1 + d2);
  proceed(ctx);
}

function moveBy(ctx: Ctx, p: PlayerState, steps: number): void {
  const from = p.position;
  const raw = from + steps;
  const to = ((raw % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  p.position = to;
  emit(ctx, { t: 'moved', seat: p.seat, from, to, steps, direct: false });
  // Salary exactly once per crossing (landing on Start counts as crossing).
  if (steps > 0 && raw >= BOARD_SIZE) transfer(ctx, null, p.seat, RULESET.startSalary, 'salary');
  landOn(ctx, p, 0);
}

function landOn(ctx: Ctx, p: PlayerState, depth: number): void {
  const s = ctx.s;
  const idx = p.position;
  s.purchaseTile = null;
  const trapAt = s.traps.findIndex((t) => t.tile === idx && t.placer !== p.seat);
  if (trapAt >= 0) {
    const trap = s.traps[trapAt]!;
    s.traps.splice(trapAt, 1);
    const shield = p.items.indexOf('shield');
    if (shield >= 0) {
      p.items.splice(shield, 1);
      emit(ctx, { t: 'item', seat: p.seat, item: 'shield', action: 'used' });
      emit(ctx, { t: 'trap', seat: p.seat, tile: idx, action: 'shielded', by: trap.placer });
    } else {
      s.pending.push({ payer: p.seat, payee: null, amount: RULESET.trapFine, reason: 'trap', tile: idx });
      emit(ctx, { t: 'trap', seat: p.seat, tile: idx, action: 'triggered', by: trap.placer });
      if (trap.source === 'ghost') player(s, trap.placer).pranksDone += 1;
    }
  }
  const t = tileDef(idx);
  switch (t.kind) {
    case 'property': {
      const o = own(s, idx);
      if (o.owner === null) s.purchaseTile = idx;
      else if (o.owner !== p.seat && !o.mortgaged && player(s, o.owner).role === 'alive') {
        s.pending.push({ payer: p.seat, payee: o.owner, amount: rentFor(s, idx), reason: 'rent', tile: idx });
      }
      return;
    }
    case 'tax':
      s.pending.push({ payer: p.seat, payee: null, amount: t.tax!, reason: 'tax', tile: idx });
      return;
    case 'chance':
      if (depth < 2) drawChance(ctx, p, depth);
      return;
    case 'minigame':
      s.minigameRequested = true;
      ctx.changed = true;
      return;
    case 'duel':
      s.turn.duelHint = true;
      return;
    case 'auction':
      s.cornerAuction = true;
      return;
    default:
      return;
  }
}

function drawChance(ctx: Ctx, p: PlayerState, depth: number): void {
  const s = ctx.s;
  const id = s.deck.shift()!;
  s.deck.push(id);
  const card = CHANCE_CARDS.find((c) => c.id === id)!;
  emit(ctx, { t: 'chance', seat: p.seat, card: id });
  const e = card.effect;
  switch (e.kind) {
    case 'money':
      if (e.amount > 0) transfer(ctx, null, p.seat, e.amount, 'chance');
      else s.pending.push({ payer: p.seat, payee: null, amount: -e.amount, reason: 'chance' });
      return;
    case 'moveTo': {
      const steps = (e.index - p.position + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE;
      const from = p.position;
      const raw = from + steps;
      p.position = e.index;
      emit(ctx, { t: 'moved', seat: p.seat, from, to: e.index, steps, direct: false });
      if (raw >= BOARD_SIZE) transfer(ctx, null, p.seat, RULESET.startSalary, 'salary');
      landOn(ctx, p, depth + 1);
      return;
    }
    case 'moveBy': {
      const from = p.position;
      const raw = from + e.steps;
      p.position = ((raw % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
      emit(ctx, { t: 'moved', seat: p.seat, from, to: p.position, steps: e.steps, direct: false });
      if (e.steps > 0 && raw >= BOARD_SIZE) transfer(ctx, null, p.seat, RULESET.startSalary, 'salary');
      landOn(ctx, p, depth + 1);
      return;
    }
    case 'item':
      return gainItem(ctx, p, e.item);
    case 'repairs': {
      const levels = ownedTiles(s, p.seat).reduce((a, i) => a + s.tiles[i]!.level, 0);
      if (levels > 0) s.pending.push({ payer: p.seat, payee: null, amount: levels * e.perLevel, reason: 'chance' });
      return;
    }
  }
}

/** Continue resolving the current turn: obligations, then purchase / auction, then the calm post-roll window. */
function proceed(ctx: Ctx): void {
  const s = ctx.s;
  while (s.pending.length) {
    const o = s.pending[0]!;
    const payer = player(s, o.payer);
    if (payer.role !== 'alive' || o.amount <= 0) {
      s.pending.shift();
      continue;
    }
    if (o.reason === 'rent' && !o.discountOffered && payer.items.includes('discount')) {
      o.discountOffered = true;
      setPhase(ctx, 'RENT_CHOICE', RULESET.rentChoiceMs);
      return;
    }
    if (o.payee && player(s, o.payee).role !== 'alive') {
      s.pending.shift();
      continue;
    }
    if (available(s, o.payer) >= o.amount) {
      s.pending.shift();
      transfer(ctx, o.payer, o.payee, o.amount, o.reason, o.tile);
      continue;
    }
    s.pending.shift();
    s.debt = o;
    emit(ctx, { t: 'debt', seat: o.payer, amount: o.amount, to: o.payee });
    setPhase(ctx, 'DEBT', RULESET.debtMs);
    return;
  }
  if (player(s, currentSeat(s)).role !== 'alive') return endTurn(ctx);
  if (s.purchaseTile !== null) {
    setPhase(ctx, 'PURCHASE', RULESET.purchaseMs);
    return;
  }
  if (s.cornerAuction) {
    s.cornerAuction = false;
    const free = MAP.tiles.filter((t) => t.kind === 'property' && s.tiles[t.index]!.owner === null && !isLocked(s, t.index));
    if (free.length) return startAuction(ctx, free[ctx.rng.int(0, free.length - 1)]!.index, 'corner');
  }
  setPhase(ctx, 'POST_ROLL', RULESET.turnDecisionMs);
}

function endTurn(ctx: Ctx): void {
  const s = ctx.s;
  const seat = currentSeat(s);
  // Ghost upgrade-blocks placed before this turn expire at its end.
  s.upgradeBlocks = s.upgradeBlocks.filter((b) => !(b.target === seat && b.placedTurn < s.turn.seq));
  s.pending = [];
  s.purchaseTile = null;
  s.cornerAuction = false;
  if (alivePlayers(s).length <= 1) return finish(ctx);
  const n = s.order.length;
  let next = s.turnIndex;
  for (let k = 1; k <= n; k++) {
    const idx = (s.turnIndex + k) % n;
    if (player(s, s.order[idx]!).role === 'alive') {
      next = idx;
      break;
    }
  }
  const wrapped = next <= s.turnIndex;
  s.turnIndex = next;
  if (wrapped) return roundEnd(ctx);
  startTurn(ctx);
}

function roundEnd(ctx: Ctx): void {
  const s = ctx.s;
  emit(ctx, { t: 'roundEnd', round: s.round });
  for (const p of s.players) if (p.role === 'ghost') p.ghostEnergy = Math.min(RULESET.ghostEnergyMax, p.ghostEnergy + 1);
  s.duelPairsThisRound = [];
  if (s.round >= s.settings.maxRounds) return finish(ctx);
  const due = s.round % s.settings.minigameEvery === 0 || s.minigameRequested;
  s.minigameRequested = false;
  s.round += 1;
  const participants = s.order.filter((seat) => player(s, seat).role !== 'left');
  if (due && participants.length >= 2) {
    const kind: MinigameKind = s.stats.minigamesPlayed % 2 === 0 ? 'reaction' : 'memory';
    s.minigame = createMinigame(ctx, kind, 'group', participants);
    setPhase(ctx, 'MINIGAME', null);
    return;
  }
  startTurn(ctx);
}

function resumeTurn(ctx: Ctx): void {
  const s = ctx.s;
  const r = s.resume ?? { phase: 'POST_ROLL' as const, remainingMs: RULESET.turnDecisionMs };
  s.resume = null;
  if (player(s, currentSeat(s)).role !== 'alive') return endTurn(ctx);
  setPhase(ctx, r.phase, r.remainingMs);
}

function pauseTurnFor(ctx: Ctx, phase: Phase, ms: number): void {
  const s = ctx.s;
  ensure(s.phase === 'PRE_ROLL' || s.phase === 'POST_ROLL', 'wrongPhase');
  s.resume = { phase: s.phase, remainingMs: Math.max(5_000, (s.deadline ?? ctx.now) - ctx.now) };
  setPhase(ctx, phase, ms);
}

// ---------------------------------------------------------------- auction

function startAuction(ctx: Ctx, tile: number, source: 'decline' | 'corner'): void {
  const s = ctx.s;
  s.purchaseTile = null;
  const deadline = ctx.now + RULESET.auction.baseMs;
  s.auction = { tile, source, highBid: 0, leader: null, passed: [], startedAt: ctx.now, deadline };
  emit(ctx, { t: 'auctionStart', tile });
  setPhase(ctx, 'AUCTION', RULESET.auction.baseMs);
}

function bid(ctx: Ctx, seat: SeatId, amount: number): void {
  const s = ctx.s;
  const au = s.auction;
  ensure(s.phase === 'AUCTION' && au, 'wrongPhase');
  ensure(player(s, seat).role === 'alive', 'notAlive');
  ensure(!au.passed.includes(seat), 'passed');
  ensure(au.leader !== seat, 'alreadyLeading');
  const min = Math.max(RULESET.auction.minBid, au.highBid + RULESET.auction.step);
  ensure(Number.isInteger(amount) && amount >= min && amount % RULESET.auction.step === 0, 'bidTooLow');
  ensure(amount <= available(s, seat), 'noCash');
  au.highBid = amount;
  au.leader = seat;
  const left = au.deadline - ctx.now;
  if (left < RULESET.auction.extendToMs)
    au.deadline = Math.min(ctx.now + RULESET.auction.extendToMs, au.startedAt + RULESET.auction.maxMs);
  s.deadline = au.deadline;
  emit(ctx, { t: 'bid', seat, amount });
  if (alivePlayers(s).every((p) => p.seat === au.leader || au.passed.includes(p.seat))) finishAuction(ctx);
}

function finishAuction(ctx: Ctx): void {
  const s = ctx.s;
  const au = s.auction!;
  s.auction = null; // releases the reserve
  if (au.leader && player(s, au.leader).role === 'alive') {
    transfer(ctx, au.leader, null, au.highBid, 'auction', au.tile);
    own(s, au.tile).owner = au.leader;
    emit(ctx, { t: 'auctionEnd', tile: au.tile, winner: au.leader, price: au.highBid });
  } else {
    emit(ctx, { t: 'auctionEnd', tile: au.tile, winner: null, price: 0 });
  }
  proceed(ctx);
}

// ---------------------------------------------------------------- property management

function upgrade(ctx: Ctx, seat: SeatId, tile: number): void {
  const s = ctx.s;
  requireManage(s, seat, false);
  const o = own(s, tile);
  ensure(o.owner === seat, 'notOwner');
  const g = groupOf(tile);
  ensure(ownsFullGroup(s, seat, g), 'needFullGroup');
  const tiles = groupTiles(MAP, g);
  ensure(
    tiles.every((i) => !s.tiles[i]!.mortgaged),
    'groupMortgaged',
  );
  ensure(o.level < RULESET.maxUpgradeLevel, 'maxLevel');
  ensure(o.level === Math.min(...tiles.map((i) => s.tiles[i]!.level)), 'buildEvenly');
  ensure(!tiles.some((i) => isLocked(s, i)), 'locked');
  ensure(!s.upgradeBlocks.some((b) => b.target === seat && b.tile === tile && b.placedTurn < s.turn.seq), 'upgradeBlocked');
  const cost = upgradeCost(tile);
  ensure(available(s, seat) >= cost, 'noCash');
  transfer(ctx, seat, null, cost, 'upgrade', tile);
  o.level += 1;
  emit(ctx, { t: 'upgraded', seat, tile, level: o.level });
}

function sellUpgrade(ctx: Ctx, seat: SeatId, tile: number): void {
  const s = ctx.s;
  requireManage(s, seat, true);
  const o = own(s, tile);
  ensure(o.owner === seat, 'notOwner');
  ensure(o.level > 0, 'nothingToSell');
  const tiles = groupTiles(MAP, groupOf(tile));
  ensure(o.level === Math.max(...tiles.map((i) => s.tiles[i]!.level)), 'sellEvenly');
  o.level -= 1;
  transfer(ctx, null, seat, pct(upgradeCost(tile), RULESET.upgradeSellRefund), 'sellUpgrade', tile);
  emit(ctx, { t: 'upgraded', seat, tile, level: o.level });
}

function mortgage(ctx: Ctx, seat: SeatId, tile: number): void {
  const s = ctx.s;
  requireManage(s, seat, true);
  const o = own(s, tile);
  ensure(o.owner === seat, 'notOwner');
  ensure(!o.mortgaged, 'alreadyMortgaged');
  ensure(!groupHasUpgrades(s, tile), 'sellUpgradesFirst');
  ensure(!isLocked(s, tile), 'locked');
  o.mortgaged = true;
  transfer(ctx, null, seat, mortgageValue(tile), 'mortgage', tile);
  emit(ctx, { t: 'mortgaged', seat, tile, mortgaged: true });
}

// ---------------------------------------------------------------- debt & bankruptcy

/**
 * Deterministic auto-liquidation: sell upgrades starting from the highest level (lowest index on ties),
 * then mortgage properties by ascending index. Stops as soon as `need` is covered.
 */
export function autoLiquidate(ctx: Ctx, seat: SeatId, need: number): void {
  const s = ctx.s;
  for (let guard = 0; guard < 200 && available(s, seat) < need; guard++) {
    const withUpgrades = ownedTiles(s, seat).filter((i) => s.tiles[i]!.level > 0);
    if (withUpgrades.length) {
      const top = Math.max(...withUpgrades.map((i) => s.tiles[i]!.level));
      const tile = withUpgrades.filter((i) => s.tiles[i]!.level === top).sort((a, b) => a - b)[0]!;
      const o = s.tiles[tile]!;
      o.level -= 1;
      transfer(ctx, null, seat, pct(upgradeCost(tile), RULESET.upgradeSellRefund), 'sellUpgrade', tile);
      emit(ctx, { t: 'upgraded', seat, tile, level: o.level });
      continue;
    }
    const m = ownedTiles(s, seat).find((i) => !s.tiles[i]!.mortgaged && !isLocked(s, i));
    if (m === undefined) return;
    s.tiles[m]!.mortgaged = true;
    transfer(ctx, null, seat, mortgageValue(m), 'mortgage', m);
    emit(ctx, { t: 'mortgaged', seat, tile: m, mortgaged: true });
  }
}

function settleDebt(ctx: Ctx, liquidate: boolean): void {
  const s = ctx.s;
  const d = s.debt!;
  if (liquidate) autoLiquidate(ctx, d.payer, d.amount);
  s.debt = null;
  if (available(s, d.payer) >= d.amount) {
    transfer(ctx, d.payer, d.payee, d.amount, d.reason, d.tile);
    return proceed(ctx);
  }
  bankrupt(ctx, d.payer, d.payee, d.amount);
  if (s.phase === 'FINISHED') return;
  endTurn(ctx);
}

function clearAssets(ctx: Ctx, seat: SeatId): void {
  const s = ctx.s;
  for (const i of ownedTiles(s, seat)) s.tiles[i] = { owner: null, level: 0, mortgaged: false };
  const p = player(s, seat);
  p.items = [];
  p.pendingItem = null;
  s.upgradeBlocks = s.upgradeBlocks.filter((b) => b.target !== seat);
}

/** V1: remaining cash goes to the creditor up to the debt; property returns to the bank clean. */
function bankrupt(ctx: Ctx, seat: SeatId, creditor: SeatId | null, owed: number): void {
  const s = ctx.s;
  const p = player(s, seat);
  const pay = Math.min(p.cash, owed);
  if (pay > 0) transfer(ctx, seat, creditor && player(s, creditor).role === 'alive' ? creditor : null, pay, 'bankruptcy');
  p.cash = 0;
  clearAssets(ctx, seat);
  p.role = 'ghost';
  p.ghostEnergy = RULESET.ghostEnergyStart;
  p.ghostPrankRound = 0;
  s.pending = s.pending.filter((o) => o.payer !== seat);
  emit(ctx, { t: 'bankrupt', seat, to: creditor });
  if (alivePlayers(s).length <= 1) finish(ctx);
}

function leave(ctx: Ctx, seat: SeatId): void {
  const s = ctx.s;
  const p = player(s, seat);
  const wasAlive = p.role === 'alive';
  const wasCurrent = currentSeat(s) === seat;
  // Close every offer involving the seat.
  if (s.trade && (s.trade.from === seat || s.trade.to === seat)) {
    emit(ctx, { t: 'trade', offer: s.trade, result: 'cancelled' });
    s.trade = null;
    if (s.phase === 'TRADE') resumeTurnSoft(ctx);
  }
  if (s.duelOffer && (s.duelOffer.buyer === seat || s.duelOffer.seller === seat)) {
    emit(ctx, { t: 'duel', offer: s.duelOffer, result: 'cancelled' });
    s.duelOffer = null;
    if (s.phase === 'DUEL_OFFER') resumeTurnSoft(ctx);
  }
  if (s.duel && (s.duel.offer.buyer === seat || s.duel.offer.seller === seat)) {
    const buyer = player(s, s.duel.offer.buyer);
    if (buyer.seat !== seat) buyer.duelTokens += 1;
    emit(ctx, { t: 'duel', offer: s.duel.offer, result: 'void' });
    s.duel = null;
    s.minigame = null;
    resumeTurnSoft(ctx);
  }
  if (s.auction) {
    if (s.auction.leader === seat) {
      s.auction.leader = null;
      s.auction.highBid = 0;
    }
    if (!s.auction.passed.includes(seat)) s.auction.passed.push(seat);
  }
  if (s.minigame) dropParticipant(s.minigame, seat);
  if (wasAlive) clearAssets(ctx, seat);
  p.cash = 0;
  p.role = 'left';
  s.pending = s.pending.filter((o) => o.payer !== seat);
  if (s.debt?.payer === seat) s.debt = null;
  emit(ctx, { t: 'left', seat });
  if (alivePlayers(s).length <= 1 && s.phase !== 'FINISHED') return finish(ctx);
  if (wasCurrent && wasAlive && s.phase !== 'MINIGAME') {
    s.auction = null;
    endTurn(ctx);
  } else if (s.auction && alivePlayers(s).every((x) => x.seat === s.auction!.leader || s.auction!.passed.includes(x.seat))) {
    finishAuction(ctx);
  }
}

function resumeTurnSoft(ctx: Ctx): void {
  if (player(ctx.s, currentSeat(ctx.s)).role === 'alive') resumeTurn(ctx);
  else ctx.s.resume = null;
}

// ---------------------------------------------------------------- trades

function validateSide(s: MatchState, owner: SeatId, side: TradeSide): void {
  ensure(player(s, owner).role === 'alive', 'notAlive');
  ensure(Number.isInteger(side.cash) && side.cash >= 0 && side.cash <= available(s, owner), 'tradeCash');
  ensure(Array.isArray(side.tiles) && side.tiles.length <= 20 && new Set(side.tiles).size === side.tiles.length, 'tradeTiles');
  for (const t of side.tiles) {
    ensure(Number.isInteger(t) && t >= 0 && t < BOARD_SIZE && isTradeableTile(s, owner, t), 'tradeTiles');
    ensure(!(s.duelOffer?.tile === t || s.duel?.offer.tile === t), 'locked');
  }
}

function proposeTrade(ctx: Ctx, seat: SeatId, to: SeatId, give: TradeSide, get: TradeSide): void {
  const s = ctx.s;
  requireTurn(s, seat, ['PRE_ROLL', 'POST_ROLL']);
  ensure(s.turn.tradeOffers < RULESET.maxTradeOffersPerTurn, 'tooManyOffers');
  ensure(to !== seat && s.players.some((p) => p.seat === to && p.role === 'alive'), 'badPartner');
  validateSide(s, seat, give);
  validateSide(s, to, get);
  ensure(give.cash + give.tiles.length + get.cash + get.tiles.length > 0, 'emptyTrade');
  s.turn.tradeOffers += 1;
  pauseTurnFor(ctx, 'TRADE', RULESET.tradeResponseMs);
  s.trade = {
    id: s.nextId++,
    from: seat,
    to,
    give: { cash: give.cash, tiles: [...give.tiles] },
    get: { cash: get.cash, tiles: [...get.tiles] },
    deadline: ctx.now + RULESET.tradeResponseMs,
  };
  emit(ctx, { t: 'trade', offer: structuredClone(s.trade), result: 'proposed' });
}

function executeSide(ctx: Ctx, from: SeatId, to: SeatId, side: TradeSide): void {
  if (side.cash > 0) transfer(ctx, from, to, side.cash, 'trade');
  for (const t of side.tiles) own(ctx.s, t).owner = to;
}

// ---------------------------------------------------------------- duels

export function duelPairKey(a: SeatId, b: SeatId): string {
  return [a, b].sort().join('|');
}

function validateDuel(s: MatchState, buyer: SeatId, seller: SeatId, tile: number, low: number, high: number): void {
  ensure(player(s, buyer).duelTokens > 0, 'noDuelTokens');
  ensure(seller !== buyer && player(s, seller).role === 'alive', 'badPartner');
  const o = s.tiles[tile];
  ensure(o && o.owner === seller, 'notOwner');
  ensure(!o.mortgaged, 'mortgaged');
  ensure(!groupHasUpgrades(s, tile), 'hasUpgrades');
  ensure(Number.isInteger(low) && Number.isInteger(high) && low >= RULESET.auction.minBid && high >= low, 'badPrices');
  ensure(available(s, buyer) >= high, 'noCash');
  ensure(!s.duelPairsThisRound.includes(duelPairKey(buyer, seller)), 'pairDueledThisRound');
}

function proposeDuel(ctx: Ctx, seat: SeatId, tile: number, low: number, high: number): void {
  const s = ctx.s;
  requireTurn(s, seat, ['PRE_ROLL', 'POST_ROLL']);
  ensure(Number.isInteger(tile) && tile >= 0 && tile < BOARD_SIZE, 'badTile');
  const seller = s.tiles[tile]?.owner;
  ensure(seller, 'notOwned');
  validateDuel(s, seat, seller, tile, low, high);
  ensure(!isLocked(s, tile), 'locked');
  pauseTurnFor(ctx, 'DUEL_OFFER', RULESET.duelOfferMs);
  s.duelOffer = {
    id: s.nextId++,
    buyer: seat,
    seller,
    tile,
    priceIfBuyerWins: low,
    priceIfSellerWins: high,
    deadline: ctx.now + RULESET.duelOfferMs,
  };
  emit(ctx, { t: 'duel', offer: structuredClone(s.duelOffer), result: 'proposed' });
}

function acceptDuel(ctx: Ctx, seat: SeatId, offerId: number): void {
  const s = ctx.s;
  const d = s.duelOffer;
  ensure(s.phase === 'DUEL_OFFER' && d && d.seller === seat && d.id === offerId, 'noOffer');
  s.duelOffer = null;
  validateDuel(s, d.buyer, d.seller, d.tile, d.priceIfBuyerWins, d.priceIfSellerWins);
  player(s, d.buyer).duelTokens -= 1;
  s.duelPairsThisRound.push(duelPairKey(d.buyer, d.seller));
  s.duel = { offer: d, reserved: d.priceIfSellerWins, outcome: null };
  s.stats.duelsPlayed += 1;
  emit(ctx, { t: 'duel', offer: d, result: 'accepted' });
  // The server picks the game after terms are fixed.
  const kind: MinigameKind = ctx.rng.int(0, 1) === 0 ? 'reaction' : 'memory';
  s.minigame = createMinigame(ctx, kind, 'duel', [d.buyer, d.seller]);
  setPhase(ctx, 'DUEL', null);
}

// ---------------------------------------------------------------- mini-game outcome

function applyMinigameOutcome(ctx: Ctx): void {
  const s = ctx.s;
  const mg = s.minigame;
  if (!mg || !mg.results || mg.applied) return;
  mg.applied = true;
  if (mg.context === 'group') {
    s.stats.minigamesPlayed += 1;
    for (const r of mg.results) {
      const p = player(s, r.seat);
      if (r.prize > 0 && p.role === 'alive') transfer(ctx, null, r.seat, r.prize, 'minigame');
      if (p.role === 'ghost' && r.participated) p.ghostEnergy = Math.min(RULESET.ghostEnergyMax, p.ghostEnergy + 1);
    }
    return;
  }
  const duel = s.duel;
  if (!duel) return;
  const { offer } = duel;
  const b = mg.results.find((r) => r.seat === offer.buyer)!;
  const sl = mg.results.find((r) => r.seat === offer.seller)!;
  let outcome: 'buyerWon' | 'sellerWon' | 'draw';
  if (!b.participated && !sl.participated) outcome = 'draw';
  else if (!b.participated) outcome = 'sellerWon';
  else if (!sl.participated) outcome = 'buyerWon';
  else outcome = b.score > sl.score ? 'buyerWon' : b.score < sl.score ? 'sellerWon' : 'draw';
  duel.outcome = outcome;
  duel.reserved = 0;
  if (outcome === 'draw') {
    player(s, offer.buyer).duelTokens += 1;
  } else {
    const price = outcome === 'buyerWon' ? offer.priceIfBuyerWins : offer.priceIfSellerWins;
    transfer(ctx, offer.buyer, offer.seller, price, 'duel', offer.tile);
    own(s, offer.tile).owner = offer.buyer;
  }
  emit(ctx, { t: 'duel', offer, result: outcome });
}

function endMinigame(ctx: Ctx): void {
  const s = ctx.s;
  const mg = s.minigame!;
  s.minigame = null;
  if (mg.context === 'duel') {
    s.duel = null;
    return resumeTurn(ctx);
  }
  if (alivePlayers(s).length <= 1) return finish(ctx);
  // The next turn index was already chosen at the round boundary.
  if (player(s, currentSeat(s)).role !== 'alive') {
    s.turnIndex = s.order.findIndex((seat) => player(s, seat).role === 'alive');
  }
  startTurn(ctx);
}

// ---------------------------------------------------------------- ghost

function ghostPrank(ctx: Ctx, me: PlayerState, cmd: Extract<Command, { type: 'GHOST_TRAP' | 'GHOST_BLOCK' }>): void {
  const s = ctx.s;
  ensure(me.role === 'ghost', 'notGhost');
  ensure(s.phase === 'PRE_ROLL' || s.phase === 'POST_ROLL', 'wrongPhase');
  ensure(me.ghostEnergy >= 1, 'noEnergy');
  ensure(me.ghostPrankRound !== s.round, 'onePrankPerRound');
  if (cmd.type === 'GHOST_TRAP') {
    ensure(canPlaceTrap(s, cmd.tile), 'badTrapTile');
    s.traps.push({ tile: cmd.tile, placer: me.seat, source: 'ghost' });
    me.ghostEnergy -= 1;
    me.ghostPrankRound = s.round;
    emit(ctx, { t: 'ghost', seat: me.seat, action: 'trap', tile: cmd.tile, blocked: false });
    return;
  }
  const target = s.players.find((p) => p.seat === cmd.target);
  ensure(target && target.role === 'alive', 'badTarget');
  ensure(s.tiles[cmd.tile]?.owner === target.seat, 'notOwner');
  ensure(me.ghostTargets[target.seat] !== s.round - 1, 'sameTargetTwice');
  ensure(!s.upgradeBlocks.some((b) => b.target === target.seat), 'alreadyBlocked');
  me.ghostEnergy -= 1;
  me.ghostPrankRound = s.round;
  me.ghostTargets[target.seat] = s.round;
  const shield = target.items.indexOf('shield');
  if (shield >= 0) {
    target.items.splice(shield, 1);
    emit(ctx, { t: 'item', seat: target.seat, item: 'shield', action: 'used' });
    emit(ctx, { t: 'ghost', seat: me.seat, action: 'block', target: target.seat, tile: cmd.tile, blocked: true });
    return;
  }
  s.upgradeBlocks.push({ target: target.seat, tile: cmd.tile, ghost: me.seat, placedTurn: s.turn.seq });
  me.pranksDone += 1;
  emit(ctx, { t: 'ghost', seat: me.seat, action: 'block', target: target.seat, tile: cmd.tile, blocked: false });
}

// ---------------------------------------------------------------- finish

function finish(ctx: Ctx): void {
  const s = ctx.s;
  s.auction = null;
  s.trade = null;
  s.duelOffer = null;
  s.duel = null;
  s.minigame = null;
  s.pending = [];
  s.debt = null;
  const alive = alivePlayers(s);
  const values = s.players.map((p) => ({ p, value: liquidationValue(s, p.seat) }));
  const ranked = values.filter((v) => v.p.role === 'alive').sort((a, b) => b.value - a.value);
  const best = ranked[0]?.value ?? 0;
  s.standings = values
    .map(({ p, value }) => {
      const rank = p.role === 'alive' ? 1 + ranked.filter((r) => r.value > value).length : null;
      return {
        seat: p.seat,
        role: p.role,
        value,
        rank,
        winner: p.role === 'alive' && value === best && alive.length > 0,
        pranks: p.pranksDone,
      };
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.pranks - a.pranks);
  s.finishedAt = ctx.now;
  setPhase(ctx, 'FINISHED', null);
  emit(ctx, { t: 'finished', winners: s.standings.filter((x) => x.winner).map((x) => x.seat) });
}

void GROUPS;

/** Test hooks: deterministic dice. Not reachable from the network protocol. */
export const __test = {
  rollWith(state: MatchState, d1: number, d2: number, now: number): MatchState {
    const ctx = makeCtx(state, now);
    advanceCtx(ctx);
    ensure(ctx.s.phase === 'PRE_ROLL', 'wrongPhase');
    roll(ctx, [d1, d2]);
    ctx.s.revision += 1;
    return commit(ctx);
  },
};
