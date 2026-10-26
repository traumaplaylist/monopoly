// Pure queries over MatchState.
import { GROUPS, MEGAPOLIS, RULESET, groupTiles, pct } from '@pb/content';
import type { GroupId, TileDef } from '@pb/content';
import { RuleError, ensure } from './ctx';
import type { MatchState, Ownership, PlayerState, SeatId } from './types';

export const MAP = MEGAPOLIS;
export const BOARD_SIZE = MAP.tiles.length;

export function tileDef(index: number): TileDef {
  const t = MAP.tiles[index];
  if (!t) throw new RuleError('badTile');
  return t;
}

export function player(s: MatchState, seat: SeatId): PlayerState {
  const p = s.players.find((x) => x.seat === seat);
  if (!p) throw new RuleError('unknownSeat');
  return p;
}

export function alivePlayers(s: MatchState): PlayerState[] {
  return s.order.map((seat) => player(s, seat)).filter((p) => p.role === 'alive');
}

export function currentSeat(s: MatchState): SeatId {
  return s.order[s.turnIndex]!;
}

export function own(s: MatchState, index: number): Ownership {
  const o = s.tiles[index];
  if (!o) throw new RuleError('notProperty');
  return o;
}

export function groupOf(index: number): GroupId {
  const g = tileDef(index).group;
  if (!g) throw new RuleError('notProperty');
  return g;
}

export function ownsFullGroup(s: MatchState, seat: SeatId, group: GroupId): boolean {
  return groupTiles(MAP, group).every((i) => s.tiles[i]?.owner === seat);
}

export function groupHasUpgrades(s: MatchState, index: number): boolean {
  return groupTiles(MAP, groupOf(index)).some((i) => (s.tiles[i]?.level ?? 0) > 0);
}

export function rentFor(s: MatchState, index: number): number {
  const t = tileDef(index);
  const o = s.tiles[index];
  if (!o || !o.owner || o.mortgaged || !t.baseRent) return 0;
  if (o.level > 0) return t.baseRent * RULESET.upgradeMultipliers[o.level]!;
  const fullUnmortgaged = groupTiles(MAP, t.group!).every((i) => s.tiles[i]?.owner === o.owner && !s.tiles[i]!.mortgaged);
  return fullUnmortgaged ? t.baseRent * RULESET.fullSetMultiplier : t.baseRent;
}

/** Money reserved by active auction leadership or an accepted duel. */
export function reserved(s: MatchState, seat: SeatId): number {
  let r = 0;
  if (s.auction?.leader === seat) r += s.auction.highBid;
  if (s.duel?.offer.buyer === seat) r += s.duel.reserved;
  return r;
}

export function available(s: MatchState, seat: SeatId): number {
  return player(s, seat).cash - reserved(s, seat);
}

export function ownedTiles(s: MatchState, seat: SeatId): number[] {
  const res: number[] = [];
  s.tiles.forEach((o, i) => {
    if (o?.owner === seat) res.push(i);
  });
  return res;
}

/** Tile is locked by a pending trade or duel. */
export function isLocked(s: MatchState, index: number): boolean {
  if (s.trade && (s.trade.give.tiles.includes(index) || s.trade.get.tiles.includes(index))) return true;
  if (s.duelOffer?.tile === index || s.duel?.offer.tile === index) return true;
  return false;
}

export function upgradeCost(index: number): number {
  return GROUPS[groupOf(index)].upgradeCost;
}

export function mortgageValue(index: number): number {
  return pct(tileDef(index).price ?? 0, RULESET.mortgageRate);
}

export function unmortgageCost(index: number): number {
  return pct(tileDef(index).price ?? 0, RULESET.unmortgageRate);
}

/**
 * Liquidation value used for final scoring: cash + 50% of unmortgaged property prices
 * + 50% of paid upgrade costs. Mortgaged property counts 0 (its money was already received).
 */
export function liquidationValue(s: MatchState, seat: SeatId): number {
  const p = player(s, seat);
  if (p.role !== 'alive') return 0;
  let v = p.cash;
  for (const i of ownedTiles(s, seat)) {
    const o = s.tiles[i]!;
    if (!o.mortgaged) v += pct(tileDef(i).price!, 0.5);
    v += pct(o.level * upgradeCost(i), RULESET.upgradeSellRefund);
  }
  return v;
}

/** Maximum cash the player could raise right now (for debt UI and bots). */
export function raisableCash(s: MatchState, seat: SeatId): number {
  let v = available(s, seat);
  for (const i of ownedTiles(s, seat)) {
    const o = s.tiles[i]!;
    v += pct(o.level * upgradeCost(i), RULESET.upgradeSellRefund);
    if (!o.mortgaged) v += mortgageValue(i);
  }
  return v;
}

/** Whose input the match is waiting for (null when only the clock can advance it). */
export function actingSeats(s: MatchState): SeatId[] {
  switch (s.phase) {
    case 'PRE_ROLL':
    case 'POST_ROLL':
    case 'PURCHASE':
    case 'RENT_CHOICE':
      return [currentSeat(s)];
    case 'DEBT':
      return s.debt ? [s.debt.payer] : [];
    case 'AUCTION':
      return s.auction
        ? alivePlayers(s)
            .map((p) => p.seat)
            .filter((x) => x !== s.auction!.leader && !s.auction!.passed.includes(x))
        : [];
    case 'TRADE':
      return s.trade ? [s.trade.to] : [];
    case 'DUEL_OFFER':
      return s.duelOffer ? [s.duelOffer.seller] : [];
    case 'DUEL':
    case 'MINIGAME':
      return s.minigame?.participants ?? [];
    default:
      return [];
  }
}

export function isTradeableTile(s: MatchState, owner: SeatId, index: number): boolean {
  const o = s.tiles[index];
  return !!o && o.owner === owner && !groupHasUpgrades(s, index);
}

export function canPlaceTrap(s: MatchState, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) return false;
  if (MAP.corners.includes(index)) return false;
  if (s.traps.some((t) => t.tile === index)) return false;
  return s.traps.length < RULESET.maxActiveTraps;
}

export { ensure };
