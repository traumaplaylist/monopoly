// Типы ядра игры. Всё состояние сериализуемо в JSON (для сохранений и будущего сервера).

export type PlayerId = string;
export type DeckId = 'signal' | 'council';
export type GroupId = 'brown' | 'ice' | 'mars' | 'belt' | 'venus' | 'jupiter' | 'saturn' | 'rim';

export type TileKind = 'start' | 'property' | 'transport' | 'utility' | 'tax' | 'card' | 'jail' | 'rest' | 'goToJail';

export interface TileDef {
  index: number;
  kind: TileKind;
  name: string;
  /** Цена покупки (для собственности, транспорта, коммунальных). */
  price?: number;
  group?: GroupId;
  /** Аренда: [без домов, 1, 2, 3, 4 дома, отель]. */
  rent?: readonly number[];
  houseCost?: number;
  /** Сумма налога для kind === 'tax'. */
  tax?: number;
  deck?: DeckId;
}

export interface GroupDef {
  id: GroupId;
  name: string;
  color: string;
  tiles: readonly number[];
}

export interface Player {
  id: PlayerId;
  name: string;
  isBot: boolean;
  /** Индекс фигурки (0..5). */
  token: number;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  /** Сколько неудачных попыток выйти дублем уже сделано. */
  jailTurns: number;
  /** Карты «выход из карантина» на руках (из какой колоды — чтобы вернуть её туда). */
  jailCards: DeckId[];
  bankrupt: boolean;
}

export interface OwnershipState {
  owner: PlayerId | null;
  /** 0..4 — дома, 5 — отель. */
  houses: number;
  mortgaged: boolean;
}

export type Phase = 'roll' | 'buy' | 'auction' | 'endTurn' | 'debt' | 'gameOver';

export interface Auction {
  tile: number;
  highBid: number;
  highBidder: PlayerId | null;
  /** Кто ещё не спасовал (в порядке хода). */
  participants: PlayerId[];
  /** Кто сейчас должен сделать ставку или спасовать. */
  turn: PlayerId;
}

export interface TradeSide {
  cash: number;
  tiles: number[];
  jailCards: number;
}

export interface TradeOffer {
  id: number;
  from: PlayerId;
  to: PlayerId;
  /** Что отдаёт инициатор. */
  give: TradeSide;
  /** Что инициатор хочет получить. */
  get: TradeSide;
}

export interface Debt {
  debtor: PlayerId;
  /** null — банк. */
  creditor: PlayerId | null;
  amount: number;
  reason: MoneyReason;
}

export type MoneyReason =
  | 'rent'
  | 'tax'
  | 'card'
  | 'jailFine'
  | 'purchase'
  | 'auction'
  | 'build'
  | 'sellBuilding'
  | 'mortgage'
  | 'unmortgage'
  | 'start'
  | 'trade'
  | 'bankruptcy';

export interface GameSettings {
  startCash: number;
  startBonus: number;
  jailFine: number;
  /** Лимит ходов (0 — без лимита). По достижении побеждает самый богатый. */
  maxTurns: number;
  /** Лимит предложений сделки за один ход. */
  maxTradesPerTurn: number;
}

export interface GameState {
  version: 1;
  seed: number;
  /** Внутреннее состояние ГСЧ (mulberry32). */
  rng: number;
  settings: GameSettings;
  players: Player[];
  /** Индексируется номером клетки; null — клетка не продаётся. */
  ownership: (OwnershipState | null)[];
  /** Индекс в players. */
  current: number;
  phase: Phase;
  dice: [number, number] | null;
  doublesCount: number;
  /** Положен ли ещё один бросок после завершения текущих событий (дубль). */
  extraRoll: boolean;
  /** Сквозной счётчик ходов. */
  turn: number;
  decks: Record<DeckId, number[]>;
  bank: { houses: number; hotels: number };
  auction: Auction | null;
  trade: TradeOffer | null;
  tradesThisTurn: number;
  nextTradeId: number;
  debts: Debt[];
  /** Фаза, в которую вернуться после погашения долгов. */
  resumePhase: Phase | null;
  winner: PlayerId | null;
  /** Монотонный номер события. */
  eventSeq: number;
  /** Последние события (журнал), ограниченный размер. */
  log: GameEvent[];
}

export type Action =
  | { type: 'ROLL'; player: PlayerId }
  | { type: 'BUY'; player: PlayerId }
  | { type: 'DECLINE_BUY'; player: PlayerId }
  | { type: 'BID'; player: PlayerId; amount: number }
  | { type: 'PASS_AUCTION'; player: PlayerId }
  | { type: 'BUILD'; player: PlayerId; tile: number }
  | { type: 'SELL_BUILDING'; player: PlayerId; tile: number }
  | { type: 'MORTGAGE'; player: PlayerId; tile: number }
  | { type: 'UNMORTGAGE'; player: PlayerId; tile: number }
  | { type: 'PAY_JAIL_FINE'; player: PlayerId }
  | { type: 'USE_JAIL_CARD'; player: PlayerId }
  | { type: 'PROPOSE_TRADE'; player: PlayerId; to: PlayerId; give: TradeSide; get: TradeSide }
  | { type: 'ACCEPT_TRADE'; player: PlayerId }
  | { type: 'REJECT_TRADE'; player: PlayerId }
  | { type: 'CANCEL_TRADE'; player: PlayerId }
  | { type: 'PAY_DEBT'; player: PlayerId }
  | { type: 'DECLARE_BANKRUPTCY'; player: PlayerId }
  | { type: 'END_TURN'; player: PlayerId };

export type ActionType = Action['type'];

type Ev<T extends string, P> = { t: T; seq: number } & P;

export type GameEvent =
  | Ev<'turnStart', { player: PlayerId; turn: number }>
  | Ev<'rolled', { player: PlayerId; dice: [number, number]; doubles: boolean }>
  | Ev<'moved', { player: PlayerId; from: number; to: number; steps: number; passedStart: boolean; direct: boolean }>
  | Ev<'money', { from: PlayerId | null; to: PlayerId | null; amount: number; reason: MoneyReason; tile?: number }>
  | Ev<'bought', { player: PlayerId; tile: number; price: number }>
  | Ev<'card', { player: PlayerId; deck: DeckId; card: number }>
  | Ev<'jailed', { player: PlayerId; reason: 'card' | 'tile' | 'doubles' }>
  | Ev<'leftJail', { player: PlayerId; how: 'doubles' | 'fine' | 'card' | 'forcedFine' }>
  | Ev<'jailStay', { player: PlayerId; attempt: number }>
  | Ev<'auctionStart', { tile: number }>
  | Ev<'bid', { player: PlayerId; amount: number }>
  | Ev<'auctionPass', { player: PlayerId }>
  | Ev<'auctionEnd', { tile: number; winner: PlayerId | null; price: number }>
  | Ev<'built', { player: PlayerId; tile: number; houses: number }>
  | Ev<'soldBuilding', { player: PlayerId; tile: number; houses: number }>
  | Ev<'mortgaged', { player: PlayerId; tile: number }>
  | Ev<'unmortgaged', { player: PlayerId; tile: number }>
  | Ev<'tradeProposed', { offer: TradeOffer }>
  | Ev<'tradeResolved', { offer: TradeOffer; result: 'accepted' | 'rejected' | 'cancelled' }>
  | Ev<'debt', { debtor: PlayerId; creditor: PlayerId | null; amount: number }>
  | Ev<'bankrupt', { player: PlayerId; creditor: PlayerId | null }>
  | Ev<'gameOver', { winner: PlayerId | null; reason: 'lastStanding' | 'turnLimit' }>;

export type ActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };

export interface PlayerSetup {
  id: PlayerId;
  name: string;
  isBot: boolean;
}

export interface GameSetup {
  seed: number;
  players: PlayerSetup[];
  settings?: Partial<GameSettings>;
}
