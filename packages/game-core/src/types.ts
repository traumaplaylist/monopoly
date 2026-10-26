import type { ChanceCard, ItemKind } from '@pb/content';

export const SCHEMA_VERSION = 1;

export type SeatId = string;
export type Role = 'alive' | 'ghost' | 'left';

export type Phase =
  | 'PRE_ROLL'
  | 'PURCHASE'
  | 'AUCTION'
  | 'RENT_CHOICE'
  | 'DEBT'
  | 'POST_ROLL'
  | 'TRADE'
  | 'DUEL_OFFER'
  | 'DUEL'
  | 'MINIGAME'
  | 'FINISHED';

export interface PlayerState {
  seat: SeatId;
  name: string;
  avatar: number;
  color: string;
  role: Role;
  cash: number;
  position: number;
  items: ItemKind[];
  duelTokens: number;
  ghostEnergy: number;
  /** Round of the last ghost prank (one per round). */
  ghostPrankRound: number;
  /** For each target seat: the round it was last targeted by this ghost. */
  ghostTargets: Record<SeatId, number>;
  pranksDone: number;
  /** Item waiting for a replace decision (inventory full). */
  pendingItem: { item: ItemKind; deadline: number } | null;
}

export interface Ownership {
  owner: SeatId | null;
  level: number;
  mortgaged: boolean;
}

export type MoneyReason =
  | 'rent'
  | 'tax'
  | 'chance'
  | 'salary'
  | 'purchase'
  | 'auction'
  | 'upgrade'
  | 'sellUpgrade'
  | 'mortgage'
  | 'unmortgage'
  | 'trade'
  | 'duel'
  | 'trap'
  | 'minigame'
  | 'bankruptcy';

export interface Obligation {
  payer: SeatId;
  /** null = bank */
  payee: SeatId | null;
  amount: number;
  reason: MoneyReason;
  tile?: number;
  /** Discount choice was already offered for this rent. */
  discountOffered?: boolean;
}

export interface Auction {
  tile: number;
  source: 'decline' | 'corner';
  highBid: number;
  leader: SeatId | null;
  passed: SeatId[];
  startedAt: number;
  deadline: number;
}

export interface TradeSide {
  cash: number;
  tiles: number[];
}

export interface TradeOffer {
  id: number;
  from: SeatId;
  to: SeatId;
  give: TradeSide;
  get: TradeSide;
  deadline: number;
}

export interface DuelOffer {
  id: number;
  buyer: SeatId;
  seller: SeatId;
  tile: number;
  priceIfBuyerWins: number;
  priceIfSellerWins: number;
  deadline: number;
}

export interface Duel {
  offer: DuelOffer;
  reserved: number;
  outcome: 'buyerWon' | 'sellerWon' | 'draw' | null;
}

export interface Trap {
  tile: number;
  placer: SeatId;
  source: 'cone' | 'ghost';
}

export interface UpgradeBlock {
  target: SeatId;
  tile: number;
  ghost: SeatId;
  /** Global turn counter when the block was placed; it applies to the target's next turn only. */
  placedTurn: number;
}

export type MinigameKind = 'reaction' | 'memory';

export interface ReactionSignal {
  id: number;
  /** ms from play start */
  at: number;
  ttl: number;
  slot: number;
  icon: string;
  target: boolean;
}

export interface ReactionGame {
  kind: 'reaction';
  playStart: number;
  playEnd: number;
  orders: { from: number; icon: string }[];
  signals: ReactionSignal[];
  /** per seat: answered signal ids, score, input timestamps for rate limit */
  players: Record<
    SeatId,
    { answered: number[]; score: number; hits: number; mistakes: number; inputs: number; recent: number[] }
  >;
}

export interface MemoryRound {
  length: number;
  showStart: number;
  showEnd: number;
  inputEnd: number;
}

export interface MemoryGame {
  kind: 'memory';
  stops: string[];
  rounds: MemoryRound[];
  round: number;
  /** Round whose sequence is currently revealed (only during its show stage). */
  revealed: number | null;
  /** Private: full sequences; only the current one is revealed during its show stage. */
  sequences: number[][];
  players: Record<
    SeatId,
    { pos: number; failed: boolean; done: boolean; score: number; inputs: number; roundsCompleted: number }
  >;
}

export interface MinigameResult {
  seat: SeatId;
  score: number;
  participated: boolean;
  place: number | null;
  prize: number;
  ghost: boolean;
}

export interface Minigame {
  id: number;
  kind: MinigameKind;
  context: 'group' | 'duel';
  participants: SeatId[];
  stage: 'intro' | 'play' | 'results';
  stageEndsAt: number;
  ready: SeatId[];
  game: ReactionGame | MemoryGame;
  results: MinigameResult[] | null;
  /** Prizes / duel outcome applied (exactly once). */
  applied: boolean;
}

export interface TurnState {
  seat: SeatId;
  /** Global sequential turn counter. */
  seq: number;
  rolled: boolean;
  dice: [number, number] | null;
  tradeOffers: number;
  /** Landing on the duel tile suggests a duel this turn. */
  duelHint: boolean;
}

export interface ResumePoint {
  phase: 'PRE_ROLL' | 'POST_ROLL';
  remainingMs: number;
}

export interface FinalStanding {
  seat: SeatId;
  role: Role;
  value: number;
  rank: number | null;
  winner: boolean;
  pranks: number;
}

export interface MatchSettings {
  minigameEvery: 1 | 2 | 3;
  maxRounds: number;
  /** Debug match (fewer seats, bots). Never on in production. */
  debug: boolean;
}

export interface MatchState {
  schemaVersion: number;
  rulesVersion: string;
  matchId: string;
  revision: number;
  seed: number;
  rng: number;
  settings: MatchSettings;
  startedAt: number;
  now: number;
  players: PlayerState[];
  order: SeatId[];
  turnIndex: number;
  round: number;
  phase: Phase;
  deadline: number | null;
  tiles: (Ownership | null)[];
  turn: TurnState;
  pending: Obligation[];
  purchaseTile: number | null;
  /** Auction requested by the corner tile, started after obligations. */
  cornerAuction: boolean;
  auction: Auction | null;
  debt: Obligation | null;
  trade: TradeOffer | null;
  duelOffer: DuelOffer | null;
  duel: Duel | null;
  minigame: Minigame | null;
  resume: ResumePoint | null;
  traps: Trap[];
  upgradeBlocks: UpgradeBlock[];
  minigameRequested: boolean;
  duelPairsThisRound: string[];
  deck: string[];
  nextId: number;
  finishedAt: number | null;
  standings: FinalStanding[] | null;
  eventSeq: number;
  log: MatchEvent[];
  stats: { minigamesPlayed: number; duelsPlayed: number; phaseSince: number; phaseTime: Record<string, number> };
}

type Ev<T extends string, P> = { t: T; seq: number; at: number } & P;

export type MatchEvent =
  | Ev<'turnStart', { seat: SeatId; round: number }>
  | Ev<'rolled', { seat: SeatId; dice: [number, number] }>
  | Ev<'moved', { seat: SeatId; from: number; to: number; steps: number; direct: boolean }>
  | Ev<'money', { from: SeatId | null; to: SeatId | null; amount: number; reason: MoneyReason; tile?: number }>
  | Ev<'bought', { seat: SeatId; tile: number; price: number }>
  | Ev<'chance', { seat: SeatId; card: ChanceCard['id'] }>
  | Ev<'item', { seat: SeatId; item: ItemKind; action: 'gained' | 'used' | 'dropped' | 'blocked' }>
  | Ev<'trap', { seat: SeatId; tile: number; action: 'placed' | 'triggered' | 'shielded'; by: SeatId }>
  | Ev<'auctionStart', { tile: number }>
  | Ev<'bid', { seat: SeatId; amount: number }>
  | Ev<'auctionEnd', { tile: number; winner: SeatId | null; price: number }>
  | Ev<'upgraded', { seat: SeatId; tile: number; level: number }>
  | Ev<'mortgaged', { seat: SeatId; tile: number; mortgaged: boolean }>
  | Ev<'trade', { offer: TradeOffer; result: 'proposed' | 'accepted' | 'rejected' | 'cancelled' | 'expired' | 'invalid' }>
  | Ev<
      'duel',
      {
        offer: DuelOffer;
        result: 'proposed' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'buyerWon' | 'sellerWon' | 'draw' | 'void';
      }
    >
  | Ev<'debt', { seat: SeatId; amount: number; to: SeatId | null }>
  | Ev<'bankrupt', { seat: SeatId; to: SeatId | null }>
  | Ev<'left', { seat: SeatId }>
  | Ev<'ghost', { seat: SeatId; action: 'trap' | 'block'; target?: SeatId; tile: number; blocked: boolean }>
  | Ev<'minigame', { id: number; kind: MinigameKind; context: 'group' | 'duel'; stage: 'intro' | 'play' | 'results' }>
  | Ev<'roundEnd', { round: number }>
  | Ev<'finished', { winners: SeatId[] }>;

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EventInput = DistributiveOmit<MatchEvent, 'seq' | 'at'>;

export type Command =
  | { type: 'ROLL' }
  | { type: 'BUY' }
  | { type: 'DECLINE_BUY' }
  | { type: 'BID'; amount: number }
  | { type: 'PASS_AUCTION' }
  | { type: 'USE_DISCOUNT' }
  | { type: 'PAY_FULL' }
  | { type: 'UPGRADE'; tile: number }
  | { type: 'SELL_UPGRADE'; tile: number }
  | { type: 'MORTGAGE'; tile: number }
  | { type: 'UNMORTGAGE'; tile: number }
  | { type: 'PAY_DEBT' }
  | { type: 'DECLARE_BANKRUPTCY' }
  | { type: 'END_TURN' }
  | { type: 'PROPOSE_TRADE'; to: SeatId; give: TradeSide; get: TradeSide }
  | { type: 'ACCEPT_TRADE'; offerId: number }
  | { type: 'REJECT_TRADE'; offerId: number }
  | { type: 'CANCEL_TRADE' }
  | { type: 'PROPOSE_DUEL'; tile: number; priceIfBuyerWins: number; priceIfSellerWins: number }
  | { type: 'ACCEPT_DUEL'; offerId: number }
  | { type: 'DECLINE_DUEL'; offerId: number }
  | { type: 'CANCEL_DUEL' }
  | { type: 'PLACE_CONE'; tile: number }
  | { type: 'REPLACE_ITEM'; drop: number | null }
  | { type: 'GHOST_TRAP'; tile: number }
  | { type: 'GHOST_BLOCK'; target: SeatId; tile: number }
  | { type: 'MG_READY'; minigameId: number }
  | { type: 'MG_INPUT'; minigameId: number; value: number }
  | { type: 'LEAVE' };

export type CommandType = Command['type'];

export type Result = { ok: true; state: MatchState; events: MatchEvent[] } | { ok: false; error: string };
