import type { Appearance } from '@pb/content';
import type { MatchState, SeatId } from '@pb/game-core';
import type { CommandAck, RoomSettings } from '@pb/protocol';

export interface SeatRecord {
  seat: SeatId;
  guestId: string | null;
  name: string;
  avatar: number;
  /** Figure look; optional so rooms saved before 03.11.2026 still load (defaults per seat). */
  appearance?: Appearance;
  ready: boolean;
  isBot: boolean;
  /** Last time the seat had an active connection (ms). */
  lastSeen: number;
}

export interface StoredAck {
  hash: string;
  ack: CommandAck;
}

export interface RoomRecord {
  roomId: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  hostSeat: SeatId;
  seats: SeatRecord[];
  settings: RoomSettings;
  match: MatchState | null;
  matchCount: number;
  rematchVotes: SeatId[];
  /** Idempotency: `${matchId}:${guestId}:${commandId}` → stored result (bounded). */
  commandResults: Record<string, StoredAck>;
  /** When every human disconnected, timers stop; time is shifted on resume. */
  suspendedAt: number | null;
}
