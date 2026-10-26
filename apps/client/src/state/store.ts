import { create } from 'zustand';
import type { PublicMatch, SeatId } from '@pb/game-core';
import type { RoomPublic, Snapshot } from '@pb/protocol';
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
  rollSeq: number;
  selectedTile: number | null;
  sheet: Sheet;
  /** Tile placement mode for cones / ghost traps / ghost blocks. */
  placing: 'cone' | 'ghostTrap' | 'ghostBlock' | null;
  toast: { text: string; kind: 'error' | 'info'; id: number } | null;
  chanceCard: { id: string; seat: SeatId; seq: number } | null;
  prefs: Prefs;
  pending: number;
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
  rollSeq: 0,
  selectedTile: null,
  sheet: null,
  placing: null,
  toast: null,
  chanceCard: null,
  prefs: storage.prefs(),
  pending: 0,
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
    for (const e of recent) {
      if (e.t === 'moved') moves.push({ seat: e.seat, from: e.from, to: e.to, steps: e.steps });
      if (e.t === 'rolled') rollSeq = e.seq;
      if (e.t === 'chance') chanceCard = { id: e.card, seat: e.seat, seq: e.seq };
    }
    patch.moves = prev.prefs.reduceMotion ? [] : sameMatch ? [...prev.moves, ...moves].slice(-12) : [];
    patch.rollSeq = rollSeq;
    patch.chanceCard = chanceCard;
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
