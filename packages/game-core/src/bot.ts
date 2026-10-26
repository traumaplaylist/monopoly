// Very simple bots for DEBUG matches only (fill empty seats while developing alone).
// They act through the same commands as players.
import { RULESET } from '@pb/content';
import { REACTION } from './minigames';
import { available, canPlaceTrap, currentSeat, player, tileDef } from './rules';
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
      const tile = [5, 9, 13, 17, 22, 27, 30].find((t) => canPlaceTrap(s, t));
      if (tile !== undefined) return { type: 'GHOST_TRAP', tile };
    }
    return null;
  }
  if (s.trade?.to === seat) return { type: 'REJECT_TRADE', offerId: s.trade.id };
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
    case 'DEBT':
      return { type: 'DECLARE_BANKRUPTCY' };
    case 'POST_ROLL': {
      // Upgrade the first legal tile when rich.
      for (let i = 0; i < s.tiles.length; i++) {
        const o = s.tiles[i];
        if (o?.owner === seat && available(s, seat) > 500 && o.level < RULESET.maxUpgradeLevel) {
          return { type: 'UPGRADE', tile: i };
        }
      }
      return { type: 'END_TURN' };
    }
    default:
      return null;
  }
}
