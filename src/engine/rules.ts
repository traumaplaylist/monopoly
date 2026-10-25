// Чистые запросы к состоянию: аренда, группы, проверки строительства и залога.
import { GROUPS, TILES, TRANSPORT_RENT, UTILITY_MULTIPLIER, isOwnable, mortgageValue, tile, unmortgageCost } from './board';
import type { GameState, GroupId, OwnershipState, Player, PlayerId } from './types';

export const MAX_HOUSES = 4;
export const HOTEL = 5;

export function getPlayer(s: GameState, id: PlayerId): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError('unknownPlayer');
  return p;
}

export function findPlayer(s: GameState, id: PlayerId): Player | undefined {
  return s.players.find((x) => x.id === id);
}

export function currentPlayer(s: GameState): Player {
  return s.players[s.current]!;
}

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt);
}

export function own(s: GameState, index: number): OwnershipState {
  const o = s.ownership[index];
  if (!o) throw new RuleError('notOwnable');
  return o;
}

export function ownsFullGroup(s: GameState, owner: PlayerId, group: GroupId): boolean {
  return GROUPS[group].tiles.every((t) => s.ownership[t]?.owner === owner);
}

export function groupHasBuildings(s: GameState, group: GroupId): boolean {
  return GROUPS[group].tiles.some((t) => (s.ownership[t]?.houses ?? 0) > 0);
}

/** Есть ли постройки в группе этой клетки (для транспорта/коммунальных — нет). */
export function tileGroupHasBuildings(s: GameState, index: number): boolean {
  const g = tile(index).group;
  return g ? groupHasBuildings(s, g) : false;
}

export function countOwnedOfKind(s: GameState, owner: PlayerId, kind: 'transport' | 'utility'): number {
  return TILES.filter((t) => t.kind === kind && s.ownership[t.index]?.owner === owner).length;
}

/**
 * Аренда за клетку.
 * @param diceSum сумма кубиков (для коммунальных)
 * @param special модификатор карты: двойной тариф транспорта / 10× для коммунальных
 */
export function rentFor(s: GameState, index: number, diceSum: number, special?: 'doubleTransport' | 'utility10'): number {
  const t = tile(index);
  const o = s.ownership[index];
  if (!o || !o.owner || o.mortgaged) return 0;
  if (t.kind === 'property') {
    const rent = t.rent!;
    if (o.houses > 0) return rent[o.houses]!;
    return ownsFullGroup(s, o.owner, t.group!) ? rent[0]! * 2 : rent[0]!;
  }
  if (t.kind === 'transport') {
    const n = countOwnedOfKind(s, o.owner, 'transport');
    const base = TRANSPORT_RENT[n] ?? 0;
    return special === 'doubleTransport' ? base * 2 : base;
  }
  if (t.kind === 'utility') {
    if (special === 'utility10') return diceSum * 10;
    const n = countOwnedOfKind(s, o.owner, 'utility');
    return diceSum * (UTILITY_MULTIPLIER[n] ?? 0);
  }
  return 0;
}

export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function ensure(cond: unknown, code: string): asserts cond {
  if (!cond) throw new RuleError(code);
}

/** Может ли игрок сейчас управлять имуществом (строить, закладывать...). */
export function managementMode(s: GameState, player: PlayerId): 'full' | 'raiseOnly' | null {
  if (s.phase === 'debt') return s.debts[0]?.debtor === player ? 'raiseOnly' : null;
  if (s.trade) return null;
  if ((s.phase === 'roll' || s.phase === 'endTurn' || s.phase === 'buy') && currentPlayer(s).id === player) return 'full';
  return null;
}

export function checkBuild(s: GameState, player: PlayerId, index: number): void {
  ensure(managementMode(s, player) === 'full', 'notNow');
  const t = tile(index);
  ensure(t.kind === 'property', 'notProperty');
  const o = own(s, index);
  ensure(o.owner === player, 'notOwner');
  ensure(ownsFullGroup(s, player, t.group!), 'needFullGroup');
  const tiles = GROUPS[t.group!].tiles;
  ensure(
    tiles.every((i) => !s.ownership[i]!.mortgaged),
    'groupMortgaged',
  );
  ensure(o.houses < HOTEL, 'maxBuilt');
  const min = Math.min(...tiles.map((i) => s.ownership[i]!.houses));
  ensure(o.houses === min, 'buildEvenly');
  if (o.houses === MAX_HOUSES) ensure(s.bank.hotels > 0, 'noHotelsInBank');
  else ensure(s.bank.houses > 0, 'noHousesInBank');
  ensure(getPlayer(s, player).cash >= t.houseCost!, 'noCash');
}

export function checkSellBuilding(s: GameState, player: PlayerId, index: number): void {
  ensure(managementMode(s, player) !== null, 'notNow');
  const t = tile(index);
  ensure(t.kind === 'property', 'notProperty');
  const o = own(s, index);
  ensure(o.owner === player, 'notOwner');
  ensure(o.houses > 0, 'nothingToSell');
  const max = Math.max(...GROUPS[t.group!].tiles.map((i) => s.ownership[i]!.houses));
  ensure(o.houses === max, 'sellEvenly');
}

export function checkMortgage(s: GameState, player: PlayerId, index: number): void {
  ensure(managementMode(s, player) !== null, 'notNow');
  ensure(isOwnable(index), 'notOwnable');
  const o = own(s, index);
  ensure(o.owner === player, 'notOwner');
  ensure(!o.mortgaged, 'alreadyMortgaged');
  ensure(!tileGroupHasBuildings(s, index), 'sellBuildingsFirst');
}

export function checkUnmortgage(s: GameState, player: PlayerId, index: number): void {
  ensure(managementMode(s, player) === 'full', 'notNow');
  ensure(isOwnable(index), 'notOwnable');
  const o = own(s, index);
  ensure(o.owner === player, 'notOwner');
  ensure(o.mortgaged, 'notMortgaged');
  ensure(getPlayer(s, player).cash >= unmortgageCost(index), 'noCash');
}

export function ownedTiles(s: GameState, player: PlayerId): number[] {
  const res: number[] = [];
  s.ownership.forEach((o, i) => {
    if (o?.owner === player) res.push(i);
  });
  return res;
}

/** Сколько денег игрок может собрать, продав постройки и заложив всё. */
export function liquidationValue(s: GameState, player: PlayerId): number {
  let total = getPlayer(s, player).cash;
  for (const i of ownedTiles(s, player)) {
    const o = s.ownership[i]!;
    const t = tile(i);
    if (o.houses > 0) total += Math.floor((o.houses * t.houseCost!) / 2);
    if (!o.mortgaged) total += mortgageValue(i);
  }
  return total;
}

/** Чистая стоимость: наличные + имущество по цене (минус залог) + постройки. */
export function netWorth(s: GameState, player: PlayerId): number {
  const p = getPlayer(s, player);
  if (p.bankrupt) return 0;
  let total = p.cash;
  for (const i of ownedTiles(s, player)) {
    const o = s.ownership[i]!;
    const t = tile(i);
    total += (t.price ?? 0) - (o.mortgaged ? mortgageValue(i) : 0);
    total += o.houses * (t.houseCost ?? 0);
  }
  return total;
}

/** Кто должен действовать прямо сейчас. */
export function getActor(s: GameState): PlayerId | null {
  if (s.phase === 'gameOver') return null;
  if (s.trade) return s.trade.to;
  if (s.phase === 'auction' && s.auction) return s.auction.turn;
  if (s.phase === 'debt') return s.debts[0]?.debtor ?? null;
  return currentPlayer(s).id;
}

/** Можно ли передавать клетку в сделке. */
export function isTradeableTile(s: GameState, owner: PlayerId, index: number): boolean {
  const o = s.ownership[index];
  return !!o && o.owner === owner && !tileGroupHasBuildings(s, index);
}
