// Wire protocol between client and server. All inbound payloads are validated with these schemas.
import { z } from 'zod';
import type { Command, PrivateView, PublicMatch, SeatId } from '@pb/game-core';

export const PROTOCOL_VERSION = 1;

const int = z.number().int();
const tile = int.min(0).max(63);
const side = z.object({ cash: int.min(0).max(1_000_000), tiles: z.array(tile).max(20) });

export const CommandSchema: z.ZodType<Command> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLL') }),
  z.object({ type: z.literal('BUY') }),
  z.object({ type: z.literal('DECLINE_BUY') }),
  z.object({ type: z.literal('BID'), amount: int.min(0).max(1_000_000) }),
  z.object({ type: z.literal('PASS_AUCTION') }),
  z.object({ type: z.literal('USE_DISCOUNT') }),
  z.object({ type: z.literal('PAY_FULL') }),
  z.object({ type: z.literal('UPGRADE'), tile }),
  z.object({ type: z.literal('SELL_UPGRADE'), tile }),
  z.object({ type: z.literal('MORTGAGE'), tile }),
  z.object({ type: z.literal('UNMORTGAGE'), tile }),
  z.object({ type: z.literal('PAY_DEBT') }),
  z.object({ type: z.literal('DECLARE_BANKRUPTCY') }),
  z.object({ type: z.literal('END_TURN') }),
  z.object({ type: z.literal('PROPOSE_TRADE'), to: z.string().max(16), give: side, get: side }),
  z.object({ type: z.literal('ACCEPT_TRADE'), offerId: int }),
  z.object({ type: z.literal('REJECT_TRADE'), offerId: int }),
  z.object({ type: z.literal('CANCEL_TRADE') }),
  z.object({
    type: z.literal('PROPOSE_DUEL'),
    tile,
    priceIfBuyerWins: int.min(0).max(1_000_000),
    priceIfSellerWins: int.min(0).max(1_000_000),
  }),
  z.object({ type: z.literal('ACCEPT_DUEL'), offerId: int }),
  z.object({ type: z.literal('DECLINE_DUEL'), offerId: int }),
  z.object({ type: z.literal('CANCEL_DUEL') }),
  z.object({ type: z.literal('PLACE_CONE'), tile }),
  z.object({ type: z.literal('REPLACE_ITEM'), drop: int.min(0).max(5).nullable() }),
  z.object({ type: z.literal('GHOST_TRAP'), tile }),
  z.object({ type: z.literal('GHOST_BLOCK'), target: z.string().max(16), tile }),
  z.object({ type: z.literal('MG_READY'), minigameId: int }),
  z.object({ type: z.literal('MG_INPUT'), minigameId: int, value: int.min(0).max(10_000) }),
  z.object({ type: z.literal('LEAVE') }),
]) as z.ZodType<Command>;

export const MatchCommandSchema = z.object({
  commandId: z.string().min(8).max(64),
  matchId: z.string().min(1).max(64),
  expectedRevision: int.min(0).optional(),
  command: CommandSchema,
});
export type MatchCommand = z.infer<typeof MatchCommandSchema>;

/** Player names are plain text: trimmed, control characters removed, 1..16 chars. */
export const NameSchema = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim())
  .pipe(z.string().min(1).max(16));

export const RoomCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{4,6}$/));

export const HelloSchema = z.object({
  protocolVersion: int,
  token: z.string().min(16).max(128).optional(),
  name: NameSchema.optional(),
});

export const RoomSettingsSchema = z.object({
  minigameEvery: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Dev-only: allow starting with bots in empty seats. Ignored unless the server runs in dev mode. */
  debugBots: z.boolean().optional(),
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const CreateRoomSchema = z.object({ settings: RoomSettingsSchema.optional() });
export const JoinRoomSchema = z.object({ code: RoomCodeSchema });
export const ReadySchema = z.object({ ready: z.boolean() });
export const AvatarSchema = z.object({ avatar: int.min(0).max(7) });

export interface SeatPublic {
  seat: SeatId;
  name: string;
  avatar: number;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
  isHost: boolean;
}

export interface RoomPublic {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  seats: SeatPublic[];
  settings: RoomSettings;
  matchId: string | null;
  rematchVotes: SeatId[];
  devMode: boolean;
}

export interface Snapshot {
  room: RoomPublic | null;
  match: PublicMatch | null;
  me: { guestId: string; name: string; seat: SeatId | null; private: PrivateView | null };
  serverTime: number;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface CommandAck {
  ok: boolean;
  error?: string;
  revision?: number;
  duplicate?: boolean;
}

/** Socket.IO event names. */
export const EV = {
  hello: 'session:hello',
  create: 'room:create',
  join: 'room:join',
  ready: 'room:ready',
  avatar: 'room:avatar',
  settings: 'room:settings',
  start: 'room:start',
  leave: 'room:leave',
  rematch: 'room:rematch',
  cmd: 'match:cmd',
  sync: 'sync',
  ping: 'time:ping',
  snapshot: 'snapshot',
  replaced: 'session:replaced',
} as const;
