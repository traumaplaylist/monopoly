// Very simple bots for DEBUG matches only (fill empty seats while developing alone).
// They act through the same commands as players.
import { GROUPS, GROUP_ORDER, RULESET, groupTiles } from '@pb/content';
import { REACTION } from './minigames';
import { MAP, available, canPlaceTrap, currentSeat, isLocked, ownsFullGroup, player, tileDef } from './rules';
import type { Command, MatchState, SeatId } from './types';

function hash(seat: SeatId, n: number): number {
  let h = n * 2654435761;
  for (const c of seat) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function botCommand(s: MatchState, seat: SeatId, now: number): Command | null {
  const me = player(s, seat);
  if (me.role === 'left' || s.phase === 'FINISHED') return null;
  if (me.pendingItem) return { type: 'REPLACE_ITEM', drop: null };
  const mg = s.minigame;
  if (mg && mg.participants.includes(seat)) {
    if (mg.stage === 'intro' && !mg.ready.includes(seat)) return { type: 'MG_READY', minigameId: mg.id };
    if (mg.stage === 'play') {
      const g = mg.game;
      if (g.kind === 'reaction') {
        const pl = g.players[seat]!;
        const sig = g.signals.find((x) => {
          const t = g.playStart + x.at;
          return x.target && !pl.answered.includes(x.id) && now >= t + 300 && now <= t + x.ttl;
        });
        if (
          sig &&
          hash(seat, sig.id) < 0.75 &&
          pl.recent.filter((t) => now - t < 1000).length < REACTION.maxInputsPerSecond - 1
        ) {
          return { type: 'MG_INPUT', minigameId: mg.id, value: sig.id };
        }
      } else if (g.kind === 'quiz') {
        const x = g.questions[g.q]!;
        const pl = g.players[seat]!;
        // Bots answer after 1.5–3.5 s, right ~70% of the time.
        const delay = 1500 + hash(seat, g.q) * 2000;
        if (g.shown.length === g.q && pl.picks[g.q] === null && now >= x.start + delay && now <= x.inputEnd) {
          const right = hash(seat, g.q + 100) < 0.7;
          return { type: 'MG_INPUT', minigameId: mg.id, value: right ? g.answers[g.q]! : (g.answers[g.q]! + 1) % x.options.length };
        }
      } else {
        const r = g.rounds[g.round]!;
        const pl = g.players[seat]!;
        if (now >= r.showEnd && now < r.inputEnd && !pl.done && !pl.failed) {
          const seq = g.sequences[g.round]!;
          const wrong = hash(seat, g.round * 10 + pl.pos) < 0.12;
          return { type: 'MG_INPUT', minigameId: mg.id, value: wrong ? (seq[pl.pos]! + 1) % g.stops.length : seq[pl.pos]! };
        }
      }
    }
    return null;
  }
  if (me.role === 'ghost') {
    if ((s.phase === 'PRE_ROLL' || s.phase === 'POST_ROLL') && me.ghostEnergy >= 1 && me.ghostPrankRound !== s.round) {
      const tile = [5, 9, 13, 19, 23, 27, 33, 38].find((t) => canPlaceTrap(s, t));
      if (tile !== undefined) return { type: 'GHOST_TRAP', tile };
    }
    return null;
  }
  // Debt can belong to someone else than the current player (e.g. «каждый платит вам»).
  if (s.phase === 'DEBT' && s.debt?.payer === seat) return raiseMoney(s, seat);
  if (s.trade?.to === seat) return answerTrade(s, seat);
  if (s.duelOffer?.seller === seat) {
    const price = tileDef(s.duelOffer.tile).price!;
    return s.duelOffer.priceIfBuyerWins >= price
      ? { type: 'ACCEPT_DUEL', offerId: s.duelOffer.id }
      : { type: 'DECLINE_DUEL', offerId: s.duelOffer.id };
  }
  if (s.phase === 'AUCTION' && s.auction) {
    const au = s.auction;
    if (au.leader === seat || au.passed.includes(seat)) return null;
    const next = Math.max(RULESET.auction.minBid, au.highBid + RULESET.auction.step);
    const limit = Math.floor(tileDef(au.tile).price! * (0.6 + hash(seat, au.tile) * 0.4));
    return next <= limit && available(s, seat) - next > 100 ? { type: 'BID', amount: next } : { type: 'PASS_AUCTION' };
  }
  if (currentSeat(s) !== seat) return null;
  switch (s.phase) {
    case 'PRE_ROLL':
      return { type: 'ROLL' };
    case 'PURCHASE': {
      const price = tileDef(s.purchaseTile!).price!;
      return available(s, seat) - price >= 120 ? { type: 'BUY' } : { type: 'DECLINE_BUY' };
    }
    case 'RENT_CHOICE':
      return { type: 'USE_DISCOUNT' };
    case 'POST_ROLL': {
      const up = legalUpgrade(s, seat);
      if (up !== null) return { type: 'UPGRADE', tile: up };
      const trade = s.turn.tradeOffers < RULESET.maxTradeOffersPerTurn ? setTrade(s, seat) : null;
      if (trade) return trade;
      return { type: 'END_TURN' };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------- smarter debug-bot helpers
// Still simple, but close enough to people for balance probes: they mortgage before going
// bankrupt, build only legally and buy the missing city of a country from a rival.

/** Debt: mortgage the cheapest plain property, sell upgrades, then pay; bankruptcy is the last resort. */
function raiseMoney(s: MatchState, seat: SeatId): Command {
  const debt = s.debt!;
  if (available(s, seat) >= debt.amount) return { type: 'PAY_DEBT' };
  const mine = s.tiles.map((o, i) => ({ o, i })).filter((x) => x.o?.owner === seat && !isLocked(s, x.i));
  const upgraded = mine.filter((x) => x.o!.level > 0).sort((a, b) => b.o!.level - a.o!.level)[0];
  if (upgraded) return { type: 'SELL_UPGRADE', tile: upgraded.i };
  const plain = mine
    .filter((x) => !x.o!.mortgaged && !groupTiles(MAP, tileDef(x.i).group!).some((i) => (s.tiles[i]?.level ?? 0) > 0))
    .sort((a, b) => tileDef(a.i).price! - tileDef(b.i).price!)[0];
  if (plain) return { type: 'MORTGAGE', tile: plain.i };
  return { type: 'DECLARE_BANKRUPTCY' };
}

/** A legal upgrade the bot can afford while keeping a cushion, or null. */
function legalUpgrade(s: MatchState, seat: SeatId): number | null {
  for (const g of GROUP_ORDER) {
    if (!GROUPS[g].upgradeCost || !ownsFullGroup(s, seat, g)) continue;
    const tiles = groupTiles(MAP, g);
    if (tiles.some((i) => s.tiles[i]!.mortgaged || isLocked(s, i))) continue;
    if (RULESET.upgradableGroups && !RULESET.upgradableGroups.includes(g)) continue;
    const min = Math.min(...tiles.map((i) => s.tiles[i]!.level));
    if (min >= RULESET.maxUpgradeLevel) continue;
    const tile = tiles.find((i) => s.tiles[i]!.level === min)!;
    if (s.upgradeBlocks.some((b) => b.target === seat && b.tile === tile)) continue;
    if (available(s, seat) - GROUPS[g].upgradeCost >= 150) return tile;
  }
  return null;
}

/** Offer to buy the last missing city of a country from its owner at 1.5× price. */
function setTrade(s: MatchState, seat: SeatId): Command | null {
  for (const g of GROUP_ORDER) {
    const tiles = groupTiles(MAP, g);
    const mine = tiles.filter((i) => s.tiles[i]?.owner === seat);
    const others = tiles.filter((i) => s.tiles[i]?.owner && s.tiles[i]!.owner !== seat);
    if (mine.length !== tiles.length - 1 || others.length !== 1) continue;
    const tile = others[0]!;
    const o = s.tiles[tile]!;
    if (o.level > 0 || isLocked(s, tile) || player(s, o.owner!).role !== 'alive') continue;
    const price = Math.ceil((tileDef(tile).price! * 1.5) / 10) * 10;
    if (available(s, seat) - price < 150) continue;
    return { type: 'PROPOSE_TRADE', to: o.owner!, give: { cash: price, tiles: [] }, get: { cash: 0, tiles: [tile] } };
  }
  return null;
}

/** Accept a cash offer of ≥1.4× price unless the tile is part of a country the bot is collecting itself. */
function answerTrade(s: MatchState, seat: SeatId): Command {
  const tr = s.trade!;
  const ok =
    tr.give.tiles.length === 0 &&
    tr.get.tiles.length === 1 &&
    tr.get.cash === 0 &&
    (() => {
      const tile = tr.get.tiles[0]!;
      const g = tileDef(tile).group!;
      const mineInGroup = groupTiles(MAP, g).filter((i) => s.tiles[i]?.owner === seat).length;
      return mineInGroup < 2 && tr.give.cash >= tileDef(tile).price! * 1.4;
    })();
  return ok ? { type: 'ACCEPT_TRADE', offerId: tr.id } : { type: 'REJECT_TRADE', offerId: tr.id };
}
