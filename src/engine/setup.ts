import { BOARD_SIZE, isOwnable } from './board';
import { CARDS } from './cards';
import { Rng, seedToState } from './rng';
import type { GameSettings, GameSetup, GameState } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  startCash: 1500,
  startBonus: 200,
  jailFine: 50,
  maxTurns: 0,
  maxTradesPerTurn: 3,
};

export const PLAYER_COLORS = ['#ff5d73', '#4cc9f0', '#ffd166', '#06d6a0', '#b388ff', '#ff9f43'];

export function createGame(setup: GameSetup): GameState {
  if (setup.players.length < 2 || setup.players.length > 6) throw new Error('Нужно от 2 до 6 игроков');
  const ids = new Set(setup.players.map((p) => p.id));
  if (ids.size !== setup.players.length) throw new Error('Идентификаторы игроков должны быть уникальны');
  const settings = { ...DEFAULT_SETTINGS, ...setup.settings };
  const rng = new Rng(seedToState(setup.seed));
  const deckOrder = (n: number) => rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const decks = { signal: deckOrder(CARDS.signal.length), council: deckOrder(CARDS.council.length) };
  const state: GameState = {
    version: 1,
    seed: setup.seed,
    rng: 0,
    settings,
    players: setup.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      token: i,
      color: PLAYER_COLORS[i]!,
      cash: settings.startCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: [],
      bankrupt: false,
    })),
    ownership: Array.from({ length: BOARD_SIZE }, (_, i) => (isOwnable(i) ? { owner: null, houses: 0, mortgaged: false } : null)),
    current: 0,
    phase: 'roll',
    dice: null,
    doublesCount: 0,
    extraRoll: false,
    turn: 1,
    decks,
    bank: { houses: 32, hotels: 12 },
    auction: null,
    trade: null,
    tradesThisTurn: 0,
    nextTradeId: 1,
    debts: [],
    resumePhase: null,
    winner: null,
    eventSeq: 1,
    log: [{ t: 'turnStart', seq: 1, player: setup.players[0]!.id, turn: 1 }],
  };
  state.rng = rng.state;
  return state;
}
