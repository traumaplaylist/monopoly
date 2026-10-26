import { create } from 'zustand';
import { createGame } from '../engine';
import type { Action, DeckId, GameEvent, GameState, PlayerId } from '../engine';
import { LocalGameClient } from './client';
import { clearSave, loadGame, saveGame } from './persistence';

export interface MoveSegment {
  from: number;
  to: number;
  steps: number;
  direct: boolean;
}

export interface NewGameOptions {
  playerName: string;
  bots: number;
  seed: number;
  startCash: number;
  maxRounds: number;
  botDelay: number;
}

export interface ShownCard {
  deck: DeckId;
  card: number;
  player: PlayerId;
  seq: number;
}

interface GameStore {
  client: LocalGameClient | null;
  state: GameState | null;
  localPlayerId: PlayerId;
  botDelay: number;
  selectedTile: number | null;
  error: string | null;
  /** Очереди анимаций перемещения по игрокам. */
  moves: Record<PlayerId, MoveSegment[]>;
  shownCard: ShownCard | null;
  tradeOpen: boolean;
  /** seq последнего броска — триггер анимации кубиков. */
  rollSeq: number;

  newGame(opts: NewGameOptions): void;
  continueSaved(): boolean;
  quitToMenu(): void;
  dispatch(action: Action): boolean;
  selectTile(tile: number | null): void;
  finishMove(player: PlayerId): void;
  dismissCard(): void;
  setTradeOpen(open: boolean): void;
  setBotDelay(ms: number): void;
  clearError(): void;
}

export const BOT_NAMES = ['Вега', 'Орион', 'Лира', 'Кассиопея', 'Антарес'];

export const useGame = create<GameStore>((set, get) => {
  function attach(client: LocalGameClient, localPlayerId: PlayerId, botDelay: number) {
    client.subscribe((state, events) => onEvents(state, events));
    set({
      client,
      state: client.getState(),
      localPlayerId,
      botDelay,
      selectedTile: null,
      error: null,
      moves: {},
      shownCard: null,
      tradeOpen: false,
      rollSeq: 0,
    });
  }

  function onEvents(state: GameState, events: GameEvent[]) {
    const moves = { ...get().moves };
    let shownCard = get().shownCard;
    let rollSeq = get().rollSeq;
    for (const e of events) {
      if (e.t === 'moved') {
        moves[e.player] = [...(moves[e.player] ?? []), { from: e.from, to: e.to, steps: e.steps, direct: e.direct }];
      } else if (e.t === 'card') {
        shownCard = { deck: e.deck, card: e.card, player: e.player, seq: e.seq };
      } else if (e.t === 'rolled') {
        rollSeq = e.seq;
      }
    }
    set({ state, moves, shownCard, rollSeq });
    saveGame({ state, localPlayerId: get().localPlayerId, botDelay: get().botDelay });
  }

  return {
    client: null,
    state: null,
    localPlayerId: 'p0',
    botDelay: 700,
    selectedTile: null,
    error: null,
    moves: {},
    shownCard: null,
    tradeOpen: false,
    rollSeq: 0,

    newGame(opts) {
      const players = [
        { id: 'p0', name: opts.playerName.trim() || 'Капитан', isBot: false },
        ...Array.from({ length: opts.bots }, (_, i) => ({ id: `b${i + 1}`, name: BOT_NAMES[i]!, isBot: true })),
      ];
      const state = createGame({
        seed: opts.seed,
        players,
        settings: { startCash: opts.startCash, maxRounds: opts.maxRounds },
      });
      attach(new LocalGameClient(state), 'p0', opts.botDelay);
      saveGame({ state, localPlayerId: 'p0', botDelay: opts.botDelay });
    },

    continueSaved() {
      const data = loadGame();
      if (!data) return false;
      attach(new LocalGameClient(data.state), data.localPlayerId, data.botDelay);
      return true;
    },

    quitToMenu() {
      set({ client: null, state: null, moves: {}, shownCard: null, tradeOpen: false, selectedTile: null });
    },

    dispatch(action) {
      const client = get().client;
      if (!client) return false;
      const r = client.dispatch(action);
      if (!r.ok) {
        set({ error: r.error });
        return false;
      }
      if (get().error) set({ error: null });
      if (client.getState().phase === 'gameOver') clearSave();
      return true;
    },

    selectTile(tile) {
      set({ selectedTile: tile });
    },

    finishMove(player) {
      const moves = { ...get().moves };
      const queue = moves[player];
      if (!queue || queue.length === 0) return;
      moves[player] = queue.slice(1);
      set({ moves });
    },

    dismissCard() {
      set({ shownCard: null });
    },

    setTradeOpen(open) {
      set({ tradeOpen: open });
    },

    setBotDelay(ms) {
      set({ botDelay: ms });
    },

    clearError() {
      set({ error: null });
    },
  };
});

export function isAnimating(moves: Record<PlayerId, MoveSegment[]>): boolean {
  return Object.values(moves).some((q) => q.length > 0);
}
