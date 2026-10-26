// Room service: lobby, seats, match lifecycle, commands, timers, presence.
// All handlers are synchronous: SQLite writes are synchronous and Node runs one handler at a time,
// so commands of one room are processed strictly sequentially and committed before any ack/broadcast.
import crypto from 'node:crypto';
import { RULESET } from '@pb/content';
import { advance, applyCommand, botCommand, createMatch, nextDeadline, privateView, publicView, shiftTime } from '@pb/game-core';
import type { Command, MatchEvent, SeatId } from '@pb/game-core';
import type { CommandAck, MatchCommand, RoomPublic, RoomSettings, Snapshot } from '@pb/protocol';
import type { Clock } from './clock';
import type { ServerConfig } from './config';
import type { GuestRow, Store } from './store';
import type { RoomRecord, SeatRecord } from './types';

export class ServiceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const SEATS: SeatId[] = ['s0', 's1', 's2', 's3'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COMMAND_RESULTS_LIMIT = 600;
/** Everybody gone for this long → timers stop until someone returns. */
export const SUSPEND_AFTER_MS = 60_000;
/** Suspended rooms are unloaded from memory after this long (they stay in the database). */
export const UNLOAD_AFTER_MS = 30 * 60_000;
export const LOBBY_SEAT_RELEASE_MS = 5 * 60_000;
export const RETENTION_MS = 3 * 24 * 60 * 60_000;
const BOT_DELAY_MS = 700;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPayload(m: MatchCommand): string {
  return crypto.createHash('sha256').update(JSON.stringify([m.matchId, m.command])).digest('hex');
}

interface Runtime {
  rec: RoomRecord;
  timer: unknown;
}

export class RoomService {
  private rooms = new Map<string, Runtime>();
  /** guestId → active controlling connection id */
  private active = new Map<string, string>();

  constructor(
    private store: Store,
    private clock: Clock,
    private config: ServerConfig,
    private notify: (roomId: string) => void,
  ) {}

  // ------------------------------------------------------------- sessions

  /** Resume by secret token or create a new guest. The token is returned only when newly created. */
  hello(token: string | undefined, name: string | undefined): { guest: GuestRow; token?: string } {
    const now = this.clock.now();
    if (token) {
      const g = this.store.guestByTokenHash(hashToken(token));
      if (g) {
        if (name && name !== g.name && !this.guestRoomStarted(g)) this.store.updateGuest(g.guest_id, { name });
        this.store.updateGuest(g.guest_id, { last_seen: now });
        return { guest: this.store.guest(g.guest_id)! };
      }
    }
    const fresh = crypto.randomBytes(32).toString('base64url');
    const guest: GuestRow = {
      guest_id: crypto.randomUUID(),
      token_hash: hashToken(fresh),
      name: name ?? 'Гость',
      room_id: null,
      created_at: now,
      last_seen: now,
    };
    this.store.createGuest(guest);
    return { guest, token: fresh };
  }

  private guestRoomStarted(g: GuestRow): boolean {
    if (!g.room_id) return false;
    const r = this.load(g.room_id);
    return !!r && r.rec.status !== 'lobby';
  }

  /** Bind a connection as the only controller of this guest. Returns the replaced connection, if any. */
  attach(guestId: string, connId: string): string | null {
    const prev = this.active.get(guestId) ?? null;
    this.active.set(guestId, connId);
    const rt = this.roomOfGuest(guestId);
    if (rt) {
      this.touchSeat(rt, guestId);
      this.resumeIfSuspended(rt);
      this.commit(rt);
    }
    return prev && prev !== connId ? prev : null;
  }

  detach(guestId: string, connId: string): void {
    if (this.active.get(guestId) !== connId) return;
    this.active.delete(guestId);
    const rt = this.roomOfGuest(guestId);
    if (rt) {
      this.touchSeat(rt, guestId);
      if (rt.rec.status === 'lobby' && rt.rec.hostSeat === this.seatOf(rt.rec, guestId)?.seat) this.transferHost(rt.rec);
      this.commit(rt);
    }
  }

  isActive(guestId: string, connId: string): boolean {
    return this.active.get(guestId) === connId;
  }

  isConnected(guestId: string | null): boolean {
    return !!guestId && this.active.has(guestId);
  }

  private touchSeat(rt: Runtime, guestId: string): void {
    const seat = this.seatOf(rt.rec, guestId);
    if (seat) seat.lastSeen = this.clock.now();
  }

  // ------------------------------------------------------------- rooms

  private load(roomId: string): Runtime | undefined {
    let rt = this.rooms.get(roomId);
    if (rt) return rt;
    const rec = this.store.room(roomId);
    if (!rec || rec.status === 'closed') return undefined;
    rt = { rec, timer: null };
    this.rooms.set(roomId, rt);
    this.schedule(rt);
    return rt;
  }

  roomOfGuest(guestId: string): Runtime | undefined {
    const g = this.store.guest(guestId);
    if (!g?.room_id) return undefined;
    const rt = this.load(g.room_id);
    if (!rt || !this.seatOf(rt.rec, guestId)) return undefined;
    return rt;
  }

  roomIdOfGuest(guestId: string): string | null {
    return this.roomOfGuest(guestId)?.rec.roomId ?? null;
  }

  guestsOfRoom(roomId: string): string[] {
    const rt = this.rooms.get(roomId);
    return rt ? rt.rec.seats.map((s) => s.guestId).filter((x): x is string => !!x) : [];
  }

  private seatOf(rec: RoomRecord, guestId: string): SeatRecord | undefined {
    return rec.seats.find((s) => s.guestId === guestId);
  }

  private newCode(): string {
    for (;;) {
      const code = Array.from(crypto.randomBytes(5), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.store.codeExists(code)) return code;
    }
  }

  private emptySeat(seat: SeatId): SeatRecord {
    return { seat, guestId: null, name: '', avatar: 0, ready: false, isBot: false, lastSeen: 0 };
  }

  create(guestId: string, settings?: RoomSettings): RoomRecord {
    this.leaveLobbyIfAny(guestId);
    const g = this.store.guest(guestId)!;
    const now = this.clock.now();
    const rec: RoomRecord = {
      roomId: crypto.randomUUID(),
      code: this.newCode(),
      createdAt: now,
      updatedAt: now,
      status: 'lobby',
      hostSeat: 's0',
      seats: SEATS.map((s) => this.emptySeat(s)),
      settings: { minigameEvery: settings?.minigameEvery ?? RULESET.minigameEveryRoundsDefault, debugBots: !!settings?.debugBots && this.config.devMode },
      match: null,
      matchCount: 0,
      rematchVotes: [],
      commandResults: {},
      suspendedAt: null,
    };
    rec.seats[0] = { seat: 's0', guestId, name: g.name, avatar: 0, ready: false, isBot: false, lastSeen: now };
    const rt: Runtime = { rec, timer: null };
    this.rooms.set(rec.roomId, rt);
    this.store.updateGuest(guestId, { room_id: rec.roomId });
    this.commit(rt);
    return rec;
  }

  join(guestId: string, code: string): RoomRecord {
    const found = this.store.roomByCode(code);
    if (!found || found.status === 'closed') throw new ServiceError('roomNotFound');
    const rt = this.load(found.roomId)!;
    const rec = rt.rec;
    if (this.seatOf(rec, guestId)) {
      this.store.updateGuest(guestId, { room_id: rec.roomId });
      this.touchSeat(rt, guestId);
      this.resumeIfSuspended(rt);
      this.commit(rt);
      return rec; // re-join the same seat
    }
    if (rec.status !== 'lobby') throw new ServiceError('alreadyStarted');
    const free = rec.seats.find((s) => !s.guestId);
    if (!free) throw new ServiceError('roomFull');
    this.leaveLobbyIfAny(guestId);
    const g = this.store.guest(guestId)!;
    const used = new Set(rec.seats.filter((s) => s.guestId).map((s) => s.avatar));
    Object.assign(free, { guestId, name: g.name, avatar: [0, 1, 2, 3, 4, 5].find((a) => !used.has(a)) ?? 0, ready: false, isBot: false, lastSeen: this.clock.now() });
    this.store.updateGuest(guestId, { room_id: rec.roomId });
    this.commit(rt);
    return rec;
  }

  private leaveLobbyIfAny(guestId: string): void {
    const rt = this.roomOfGuest(guestId);
    if (rt && rt.rec.status === 'lobby') this.leave(guestId);
  }

  private requireLobbySeat(guestId: string): { rt: Runtime; seat: SeatRecord } {
    const rt = this.roomOfGuest(guestId);
    if (!rt) throw new ServiceError('noRoom');
    const seat = this.seatOf(rt.rec, guestId)!;
    return { rt, seat };
  }

  setReady(guestId: string, ready: boolean): void {
    const { rt, seat } = this.requireLobbySeat(guestId);
    if (rt.rec.status !== 'lobby') throw new ServiceError('notLobby');
    seat.ready = ready;
    this.commit(rt);
  }

  setAvatar(guestId: string, avatar: number): void {
    const { rt, seat } = this.requireLobbySeat(guestId);
    if (rt.rec.status !== 'lobby') throw new ServiceError('notLobby');
    if (rt.rec.seats.some((s) => s !== seat && s.guestId && s.avatar === avatar)) throw new ServiceError('avatarTaken');
    seat.avatar = avatar;
    this.commit(rt);
  }

  setSettings(guestId: string, settings: RoomSettings): void {
    const { rt, seat } = this.requireLobbySeat(guestId);
    if (rt.rec.status !== 'lobby') throw new ServiceError('notLobby');
    if (rt.rec.hostSeat !== seat.seat) throw new ServiceError('notHost');
    rt.rec.settings = { minigameEvery: settings.minigameEvery, debugBots: !!settings.debugBots && this.config.devMode };
    for (const s of rt.rec.seats) s.ready = false;
    this.commit(rt);
  }

  start(guestId: string): void {
    const { rt, seat } = this.requireLobbySeat(guestId);
    const rec = rt.rec;
    if (rec.status !== 'lobby') throw new ServiceError('notLobby');
    if (rec.hostSeat !== seat.seat) throw new ServiceError('notHost');
    const humans = rec.seats.filter((s) => s.guestId);
    const debug = !!rec.settings.debugBots && this.config.devMode;
    if (!debug && humans.length < RULESET.seats) throw new ServiceError('needFourPlayers');
    if (humans.some((s) => !s.ready)) throw new ServiceError('notAllReady');
    if (humans.some((s) => !this.isConnected(s.guestId))) throw new ServiceError('someoneOffline');
    if (debug) {
      const usedAvatars = new Set(humans.map((s) => s.avatar));
      let bot = 1;
      for (const s of rec.seats) {
        if (s.guestId) continue;
        const avatar = [0, 1, 2, 3, 4, 5].find((a) => !usedAvatars.has(a)) ?? 0;
        usedAvatars.add(avatar);
        Object.assign(s, { name: `Бот ${bot++}`, avatar, isBot: true, ready: true, lastSeen: this.clock.now() });
      }
    }
    this.startMatch(rt);
  }

  private startMatch(rt: Runtime): void {
    const rec = rt.rec;
    const seats = rec.seats.filter((s) => s.guestId || s.isBot);
    rec.matchCount += 1;
    rec.match = createMatch({
      matchId: `${rec.roomId.slice(0, 8)}-${rec.matchCount}`,
      seed: crypto.randomInt(0, 2 ** 31),
      seats: seats.map((s) => ({ seat: s.seat, name: s.name, avatar: s.avatar })),
      settings: { minigameEvery: rec.settings.minigameEvery, debug: seats.length !== RULESET.seats || seats.some((s) => s.isBot) },
      now: this.clock.now(),
    });
    rec.status = 'playing';
    rec.rematchVotes = [];
    rec.commandResults = {};
    this.commit(rt);
  }

  /** Lobby: free the seat. Match: voluntary exit (assets go to the bank) and the seat stops being yours. */
  leave(guestId: string): void {
    const rt = this.roomOfGuest(guestId);
    if (!rt) return;
    const rec = rt.rec;
    const seat = this.seatOf(rec, guestId)!;
    if (rec.status === 'playing' && rec.match) {
      const r = applyCommand(rec.match, seat.seat, { type: 'LEAVE' }, this.clock.now());
      if (r.ok) this.applyMatch(rt, r.state, r.events);
    }
    if (rec.status === 'lobby' || rec.status === 'finished') {
      Object.assign(seat, this.emptySeat(seat.seat));
    } else {
      seat.guestId = null;
      seat.ready = false;
    }
    rec.rematchVotes = rec.rematchVotes.filter((x) => x !== seat.seat);
    this.store.updateGuest(guestId, { room_id: null });
    if (rec.hostSeat === seat.seat) this.transferHost(rec);
    if (!rec.seats.some((s) => s.guestId)) rec.status = 'closed';
    this.commit(rt);
  }

  private transferHost(rec: RoomRecord): void {
    const next = rec.seats.find((s) => s.guestId && this.isConnected(s.guestId)) ?? rec.seats.find((s) => s.guestId);
    if (next) rec.hostSeat = next.seat;
  }

  rematch(guestId: string): void {
    const { rt, seat } = this.requireLobbySeat(guestId);
    const rec = rt.rec;
    if (rec.status !== 'finished') throw new ServiceError('notFinished');
    if (!rec.rematchVotes.includes(seat.seat)) rec.rematchVotes.push(seat.seat);
    const humans = rec.seats.filter((s) => s.guestId);
    if (humans.every((s) => rec.rematchVotes.includes(s.seat))) {
      const full = rec.seats.filter((s) => s.guestId || s.isBot).length === RULESET.seats;
      if (full) return this.startMatch(rt);
      rec.status = 'lobby';
      rec.match = null;
      for (const s of rec.seats) s.ready = false;
    }
    this.commit(rt);
  }

  // ------------------------------------------------------------- match commands

  command(guestId: string, msg: MatchCommand): CommandAck {
    const rt = this.roomOfGuest(guestId);
    if (!rt?.rec.match) return { ok: false, error: 'noMatch' };
    const rec = rt.rec;
    const match = rec.match!;
    const key = `${msg.matchId}:${guestId}:${msg.commandId}`;
    const hash = hashPayload(msg);
    const stored = rec.commandResults[key];
    if (stored) {
      if (stored.hash !== hash) return { ok: false, error: 'commandIdConflict' };
      return { ...stored.ack, duplicate: true };
    }
    if (msg.matchId !== match.matchId) return { ok: false, error: 'staleMatch' };
    const seat = this.seatOf(rec, guestId)!;
    if (msg.expectedRevision !== undefined && msg.expectedRevision !== match.revision) {
      // Context-sensitive commands carry the revision they were made for.
      return this.storeAck(rt, key, hash, { ok: false, error: 'staleRevision', revision: match.revision });
    }
    if (msg.command.type === 'LEAVE') {
      this.leave(guestId);
      return { ok: true };
    }
    const r = applyCommand(match, seat.seat, msg.command, this.clock.now());
    if (!r.ok) return this.storeAck(rt, key, hash, { ok: false, error: r.error, revision: match.revision });
    const ack: CommandAck = { ok: true, revision: r.state.revision };
    rec.commandResults[key] = { hash, ack };
    this.trimResults(rec);
    this.applyMatch(rt, r.state, r.events);
    return ack;
  }

  private storeAck(rt: Runtime, key: string, hash: string, ack: CommandAck): CommandAck {
    // Rejections are remembered in memory only (no state change to persist).
    rt.rec.commandResults[key] = { hash, ack };
    this.trimResults(rt.rec);
    return ack;
  }

  private trimResults(rec: RoomRecord): void {
    const keys = Object.keys(rec.commandResults);
    if (keys.length > COMMAND_RESULTS_LIMIT) for (const k of keys.slice(0, keys.length - COMMAND_RESULTS_LIMIT)) delete rec.commandResults[k];
  }

  private applyMatch(rt: Runtime, state: RoomRecord['match'], events: MatchEvent[]): void {
    const rec = rt.rec;
    rec.match = state;
    if (state?.phase === 'FINISHED' && rec.status === 'playing') {
      rec.status = 'finished';
      rec.rematchVotes = [];
    }
    this.commit(rt, events);
  }

  // ------------------------------------------------------------- persistence, timers, bots

  /** Persist first, then notify clients, then reschedule timers. */
  private commit(rt: Runtime, events: MatchEvent[] = []): void {
    rt.rec.updatedAt = this.clock.now();
    this.store.saveRoom(rt.rec, events);
    this.notify(rt.rec.roomId);
    this.schedule(rt);
    if (rt.rec.status === 'closed') {
      this.clock.clearTimeout(rt.timer);
      this.rooms.delete(rt.rec.roomId);
    }
  }

  private schedule(rt: Runtime): void {
    this.clock.clearTimeout(rt.timer);
    rt.timer = null;
    const rec = rt.rec;
    if (rec.status !== 'playing' || !rec.match || rec.suspendedAt !== null) return;
    const now = this.clock.now();
    const times: number[] = [];
    const d = nextDeadline(rec.match);
    if (d !== null) times.push(d);
    if (rec.seats.some((s) => s.isBot)) times.push(now + BOT_DELAY_MS);
    if (!times.length) return;
    const at = Math.min(...times);
    rt.timer = this.clock.setTimeout(() => this.onTimer(rt.rec.roomId), Math.max(0, at - now) + 5);
  }

  private onTimer(roomId: string): void {
    const rt = this.rooms.get(roomId);
    if (!rt || !rt.rec.match || rt.rec.status !== 'playing') return;
    const now = this.clock.now();
    const a = advance(rt.rec.match, now);
    if (a) {
      this.applyMatch(rt, a.state, a.events);
      return;
    }
    if (this.runBots(rt)) return;
    this.schedule(rt);
  }

  /** Debug bots: one command per tick. */
  private runBots(rt: Runtime): boolean {
    const rec = rt.rec;
    if (!rec.match) return false;
    for (const s of rec.seats) {
      if (!s.isBot) continue;
      const cmd: Command | null = botCommand(rec.match, s.seat, this.clock.now());
      if (!cmd) continue;
      let r = applyCommand(rec.match, s.seat, cmd, this.clock.now());
      if (!r.ok && rec.match.phase === 'POST_ROLL') r = applyCommand(rec.match, s.seat, { type: 'END_TURN' }, this.clock.now());
      if (r.ok) {
        this.applyMatch(rt, r.state, r.events);
        return true;
      }
    }
    return false;
  }

  private resumeIfSuspended(rt: Runtime): void {
    const rec = rt.rec;
    if (rec.suspendedAt === null) return;
    if (rec.match) rec.match = shiftTime(rec.match, this.clock.now() - rec.suspendedAt);
    rec.suspendedAt = null;
  }

  /** Periodic housekeeping: absence policy, suspension, unloading, retention. */
  sweep(): void {
    const now = this.clock.now();
    for (const rt of [...this.rooms.values()]) {
      const rec = rt.rec;
      const humans = rec.seats.filter((s) => s.guestId);
      const online = humans.filter((s) => this.isConnected(s.guestId));
      for (const s of humans) if (this.isConnected(s.guestId)) s.lastSeen = now;
      if (rec.status === 'lobby') {
        for (const s of humans) {
          if (!this.isConnected(s.guestId) && now - s.lastSeen > LOBBY_SEAT_RELEASE_MS) this.leave(s.guestId!);
        }
        continue;
      }
      if (rec.status === 'playing' && rec.match) {
        // Long absence = leaving the match (assets to the bank). Short drops keep the seat.
        for (const s of humans) {
          const p = rec.match.players.find((x) => x.seat === s.seat);
          if (p && p.role !== 'left' && !this.isConnected(s.guestId) && now - s.lastSeen > RULESET.absenceTimeoutMs) {
            const r = applyCommand(rec.match, s.seat, { type: 'LEAVE' }, now);
            if (r.ok) this.applyMatch(rt, r.state, r.events);
          }
        }
        if (!online.length && rec.suspendedAt === null && humans.length && humans.every((s) => now - s.lastSeen > SUSPEND_AFTER_MS)) {
          rec.suspendedAt = now;
          this.commit(rt);
        }
      }
      if (!online.length && humans.every((s) => now - s.lastSeen > UNLOAD_AFTER_MS)) {
        this.clock.clearTimeout(rt.timer);
        this.rooms.delete(rec.roomId);
      }
    }
    this.store.purgeRooms(now - RETENTION_MS);
  }

  /** After a server restart: load recent rooms, finish expired decisions, restart timers. */
  boot(): void {
    const now = this.clock.now();
    for (const rec of this.store.activeRooms(now - UNLOAD_AFTER_MS)) {
      for (const s of rec.seats) if (s.guestId) s.lastSeen = now;
      if (rec.suspendedAt !== null && rec.match) {
        rec.match = shiftTime(rec.match, now - rec.suspendedAt);
        rec.suspendedAt = now;
      }
      const rt: Runtime = { rec, timer: null };
      this.rooms.set(rec.roomId, rt);
      if (rec.status === 'playing' && rec.match && rec.suspendedAt === null) {
        const a = advance(rec.match, now);
        if (a) this.applyMatch(rt, a.state, a.events);
      }
      this.schedule(rt);
    }
  }

  shutdown(): void {
    for (const rt of this.rooms.values()) this.clock.clearTimeout(rt.timer);
    this.rooms.clear();
  }

  /** DEV ONLY (PB_DEV=1): shortcuts for manual QA and screenshots. Disabled in production. */
  devCheat(guestId: string, op: string): void {
    if (!this.config.devMode) throw new ServiceError('notAllowed');
    const rt = this.roomOfGuest(guestId);
    const m = rt?.rec.match;
    if (!rt || !m) throw new ServiceError('noMatch');
    const seat = this.seatOf(rt.rec, guestId)!.seat;
    const s = structuredClone(m);
    const me = s.players.find((p) => p.seat === seat)!;
    switch (op) {
      case 'cash':
        me.cash += 2000;
        break;
      case 'set': {
        // Give me the cheapest free full group.
        for (const g of [[1, 3], [5, 7], [27, 28], [30, 31]]) {
          if (g.every((i) => s.tiles[i]!.owner === null || s.tiles[i]!.owner === seat)) {
            for (const i of g) s.tiles[i] = { owner: seat, level: 0, mortgaged: false };
            break;
          }
        }
        break;
      }
      case 'ghost':
        for (const o of s.tiles) if (o?.owner === seat) Object.assign(o, { owner: null, level: 0, mortgaged: false });
        Object.assign(me, { role: 'ghost', cash: 0, items: [], ghostEnergy: 1, ghostPrankRound: 0 });
        break;
      case 'minigame':
        s.minigameRequested = true;
        break;
      case 'endSoon':
        s.settings.maxRounds = s.round;
        break;
      case 'skip':
        if (s.deadline !== null) s.deadline = this.clock.now();
        if (s.minigame) {
          const now = this.clock.now();
          const mg = s.minigame;
          mg.stageEndsAt = now;
          if (mg.game.kind === 'reaction' && mg.stage === 'play') mg.game.playEnd = now;
          if (mg.game.kind === 'memory' && mg.stage === 'play') {
            const r = mg.game.rounds[mg.game.round]!;
            r.showEnd = Math.min(r.showEnd, now);
            r.inputEnd = now;
          }
        }
        break;
      default:
        throw new ServiceError('badRequest');
    }
    s.revision += 1;
    this.applyMatch(rt, s, []);
  }

  // ------------------------------------------------------------- views

  roomPublic(rec: RoomRecord): RoomPublic {
    return {
      code: rec.code,
      status: rec.status === 'closed' ? 'lobby' : rec.status,
      seats: rec.seats
        .filter((s) => s.guestId || s.isBot)
        .map((s) => ({
          seat: s.seat,
          name: s.name,
          avatar: s.avatar,
          ready: s.ready,
          connected: s.isBot || this.isConnected(s.guestId),
          isBot: s.isBot,
          isHost: rec.hostSeat === s.seat,
        })),
      settings: rec.settings,
      matchId: rec.match?.matchId ?? null,
      rematchVotes: rec.rematchVotes,
      devMode: this.config.devMode,
    };
  }

  snapshot(guestId: string): Snapshot {
    const g = this.store.guest(guestId);
    const rt = this.roomOfGuest(guestId);
    const seat = rt ? this.seatOf(rt.rec, guestId)!.seat : null;
    const match = rt?.rec.match ?? null;
    return {
      room: rt ? this.roomPublic(rt.rec) : null,
      match: match ? publicView(match) : null,
      me: { guestId, name: g?.name ?? '', seat, private: match && seat ? privateView(match, seat) : null },
      serverTime: this.clock.now(),
    };
  }

  /** For tests and diagnostics. */
  roomRecord(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId)?.rec;
  }
}
