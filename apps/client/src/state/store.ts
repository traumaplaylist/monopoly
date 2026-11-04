import { create } from 'zustand';
import type { PublicMatch, SeatId } from '@pb/game-core';
import type { RoomPublic, Snapshot } from '@pb/protocol';
import type { Emote } from '@pb/content';
import { storage } from '../net/util';
import type { Prefs } from '../net/util';

export type ConnStatus = 'connecting' | 'online' | 'offline' | 'replaced' | 'error';
export type Sheet =
  | { kind: 'tile'; tile: number }
  | { kind: 'trade' }
  | { kind: 'duel'; tile?: number }
  | { kind: 'menu' }
  | { kind: 'assets' }
  | { kind: 'log' }
  | null;

/** Short visual effect on the board, derived from a fresh event. `start` is a performance.now() time. */
export interface Fx {
  id: number;
  kind: 'money' | 'coin' | 'bought' | 'upgraded';
  seat?: SeatId;
  /** Coin flight target. */
  to?: SeatId;
  tile?: number;
  amount?: number;
  start: number;
}

/** A reaction bubble over a player (from the server's room:emoteShow). */
export interface EmoteFx {
  id: number;
  seat: SeatId;
  emote: Emote;
  /** performance.now() */
  start: number;
}

export interface MoveAnim {
  seat: SeatId;
  from: number;
  to: number;
  steps: number;
}

interface UiState {
  conn: ConnStatus;
  connError: string | null;
  guestId: string | null;
  name: string;
  room: RoomPublic | null;
  match: PublicMatch | null;
  seat: SeatId | null;
  priv: Snapshot['me']['private'];
  /** serverTime - localTime */
  offset: number;
  lastSeq: number;
  moves: MoveAnim[];
  fx: Fx[];
  emotes: EmoteFx[];
  rollSeq: number;
  selectedTile: number | null;
  sheet: Sheet;
  /** Tile placement mode for cones / ghost traps / ghost blocks. */
  placing: 'cone' | 'ticket' | 'ghostTrap' | 'ghostBlock' | null;
  toast: { text: string; kind: 'error' | 'info'; id: number } | null;
  chanceCard: { id: string; seat: SeatId; seq: number } | null;
  /** World event of the new round to show as a card (from a fresh event). */
  worldCard: { kind: string; group?: string; round: number; seq: number } | null;
  prefs: Prefs;
  pending: number;
  /** Full-screen wardrobe (character editor) is open. */
  wardrobe: boolean;
}

export const useStore = create<UiState>(() => ({
  conn: 'connecting',
  connError: null,
  guestId: null,
  name: storage.name(),
  room: null,
  match: null,
  seat: null,
  priv: null,
  offset: 0,
  lastSeq: 0,
  moves: [],
  fx: [],
  emotes: [],
  rollSeq: 0,
  selectedTile: null,
  sheet: null,
  placing: null,
  toast: null,
  chanceCard: null,
  worldCard: null,
  prefs: storage.prefs(),
  pending: 0,
  wardrobe: false,
}));

export const set = useStore.setState;
export const get = useStore.getState;

export function serverNow(): number {
  return Date.now() + get().offset;
}

let toastId = 0;
export function toast(text: string, kind: 'error' | 'info' = 'info'): void {
  set({ toast: { text, kind, id: ++toastId } });
}

/** Apply a snapshot: derive animations only from fresh events (skip stale ones after background). */
export function applySnapshot(snap: Snapshot): void {
  const prev = get();
  const match = snap.match;
  const offset = snap.serverTime - Date.now();
  const patch: Partial<UiState> = { room: snap.room, match, seat: snap.me.seat, priv: snap.me.private, guestId: snap.me.guestId, name: snap.me.name, offset };
  if (match) {
    const sameMatch = prev.match?.matchId === match.matchId;
    const fresh = sameMatch ? match.log.filter((e) => e.seq > prev.lastSeq) : [];
    const recent = fresh.filter((e) => snap.serverTime - e.at < 4000);
    const moves: MoveAnim[] = [];
    let rollSeq = prev.rollSeq;
    let chanceCard = prev.chanceCard;
    let worldCard = prev.worldCard;
    // Effects wait until the token of that batch has walked (steps × step time).
    const walk = Math.max(0, ...recent.filter((e) => e.t === 'moved').map((e) => (e.t === 'moved' ? Math.abs(e.steps) : 0))) * 240;
    const t0 = performance.now() + walk + 150;
    const fx: Fx[] = [];
    let fxId = (prev.fx.at(-1)?.id ?? 0) + 1;
    for (const e of recent) {
      if (e.t === 'money') {
        if (e.to) fx.push({ id: fxId++, kind: 'money', seat: e.to, amount: e.amount, start: t0 });
        if (e.from) fx.push({ id: fxId++, kind: 'money', seat: e.from, amount: -e.amount, start: t0 });
        if (e.from && e.to) fx.push({ id: fxId++, kind: 'coin', seat: e.from, to: e.to, start: t0 });
      }
      if (e.t === 'bought') fx.push({ id: fxId++, kind: 'bought', seat: e.seat, tile: e.tile, start: t0 });
      if (e.t === 'upgraded') fx.push({ id: fxId++, kind: 'upgraded', seat: e.seat, tile: e.tile, start: t0 });
      if (e.t === 'moved') moves.push({ seat: e.seat, from: e.from, to: e.to, steps: e.steps });
      if (e.t === 'rolled') rollSeq = e.seq;
      if (e.t === 'chance') chanceCard = { id: e.card, seat: e.seat, seq: e.seq };
      if (e.t === 'worldEvent') worldCard = { kind: e.kind, ...(e.group ? { group: e.group } : {}), round: e.round, seq: e.seq };
    }
    patch.moves = prev.prefs.reduceMotion ? [] : sameMatch ? [...prev.moves, ...moves].slice(-12) : [];
    patch.fx = prev.prefs.reduceMotion || !sameMatch ? [] : [...prev.fx.filter((f) => performance.now() - f.start < 3000), ...fx].slice(-24);
    patch.rollSeq = rollSeq;
    patch.chanceCard = chanceCard;
    patch.worldCard = worldCard;
    patch.lastSeq = match.log.at(-1)?.seq ?? 0;
  } else {
    patch.moves = [];
    patch.lastSeq = 0;
  }
  set(patch);
}

export function setPrefs(p: Partial<Prefs>): void {
  const prefs = { ...get().prefs, ...p };
  storage.setPrefs(prefs);
  set({ prefs });
}
