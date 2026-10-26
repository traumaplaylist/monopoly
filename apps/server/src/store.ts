// Persistence on SQLite (built-in node:sqlite, no native addons). One row per room holds the full
// authoritative state; every committed transition is written in a single transaction before acks.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { MatchEvent } from '@pb/game-core';
import type { RoomRecord } from './types';

export interface GuestRow {
  guest_id: string;
  token_hash: string;
  name: string;
  room_id: string | null;
  created_at: number;
  last_seen: number;
}

export class Store {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS guests (
        guest_id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        room_id TEXT,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS match_events (
        room_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        data TEXT NOT NULL,
        at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS match_events_room ON match_events(room_id, match_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  guestByTokenHash(hash: string): GuestRow | undefined {
    return this.db.prepare('SELECT * FROM guests WHERE token_hash = ?').get(hash) as GuestRow | undefined;
  }

  guest(id: string): GuestRow | undefined {
    return this.db.prepare('SELECT * FROM guests WHERE guest_id = ?').get(id) as GuestRow | undefined;
  }

  createGuest(g: GuestRow): void {
    this.db
      .prepare('INSERT INTO guests (guest_id, token_hash, name, room_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
      .run(g.guest_id, g.token_hash, g.name, g.room_id, g.created_at, g.last_seen);
  }

  updateGuest(id: string, fields: { name?: string; room_id?: string | null; last_seen?: number }): void {
    const g = this.guest(id);
    if (!g) return;
    this.db
      .prepare('UPDATE guests SET name = ?, room_id = ?, last_seen = ? WHERE guest_id = ?')
      .run(fields.name ?? g.name, fields.room_id === undefined ? g.room_id : fields.room_id, fields.last_seen ?? g.last_seen, id);
  }

  /** Atomically stores the room and the events of one transition. */
  saveRoom(room: RoomRecord, events: MatchEvent[] = []): void {
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO rooms (room_id, code, status, data, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(room_id) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`,
        )
        .run(room.roomId, room.code, room.status, JSON.stringify(room), room.updatedAt);
      if (events.length && room.match) {
        const ins = this.db.prepare('INSERT INTO match_events (room_id, match_id, revision, data, at) VALUES (?, ?, ?, ?, ?)');
        for (const e of events) ins.run(room.roomId, room.match.matchId, room.match.revision, JSON.stringify(e), e.at);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  room(roomId: string): RoomRecord | undefined {
    const row = this.db.prepare('SELECT data FROM rooms WHERE room_id = ?').get(roomId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as RoomRecord) : undefined;
  }

  roomByCode(code: string): RoomRecord | undefined {
    const row = this.db.prepare('SELECT data FROM rooms WHERE code = ?').get(code) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as RoomRecord) : undefined;
  }

  activeRooms(since: number): RoomRecord[] {
    const rows = this.db.prepare("SELECT data FROM rooms WHERE status != 'closed' AND updated_at >= ?").all(since) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as RoomRecord);
  }

  codeExists(code: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code);
  }

  /** Retention: drop rooms (and their events) not updated since `before`. */
  purgeRooms(before: number): number {
    const ids = this.db.prepare('SELECT room_id FROM rooms WHERE updated_at < ?').all(before) as { room_id: string }[];
    for (const { room_id } of ids) {
      this.db.prepare('DELETE FROM match_events WHERE room_id = ?').run(room_id);
      this.db.prepare('DELETE FROM rooms WHERE room_id = ?').run(room_id);
      this.db.prepare('UPDATE guests SET room_id = NULL WHERE room_id = ?').run(room_id);
    }
    return ids.length;
  }

  eventCount(roomId: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM match_events WHERE room_id = ?').get(roomId) as { n: number }).n;
  }
}
