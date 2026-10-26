import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Command } from '@pb/game-core';
import { EV, PROTOCOL_VERSION } from '@pb/protocol';
import type { CommandAck, Snapshot } from '@pb/protocol';
import { ManualClock } from '../src/clock';
import type { ServerConfig } from '../src/config';
import { createGameServer } from '../src/net';
import type { GameServer } from '../src/net';

export function tempDb(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pb-')), 'test.sqlite');
}

export async function startServer(opts: { dbPath?: string; clock?: ManualClock; devMode?: boolean } = {}) {
  const clock = opts.clock ?? new ManualClock();
  const config: ServerConfig = {
    port: 0,
    host: '127.0.0.1',
    dbPath: opts.dbPath ?? tempDb(),
    devMode: opts.devMode ?? false,
    allowedOrigins: [],
    staticDir: null,
  };
  const server: GameServer = createGameServer(config, clock);
  const port = await server.listen();
  return { server, clock, url: `http://127.0.0.1:${port}`, dbPath: config.dbPath };
}

export class TestClient {
  socket: Socket;
  snap: Snapshot | null = null;
  token: string | undefined;
  replaced = false;

  constructor(
    public url: string,
    public name: string,
  ) {
    this.socket = this.open();
  }

  private open(): Socket {
    const s = connect(this.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.on(EV.snapshot, (x: Snapshot) => (this.snap = x));
    s.on(EV.replaced, () => (this.replaced = true));
    return s;
  }

  async emit<T = { ok: boolean; error?: string }>(event: string, payload?: unknown): Promise<T> {
    return (await this.socket.timeout(5000).emitWithAck(event, payload ?? {})) as T;
  }

  async hello(): Promise<{ ok: boolean; guestId: string; token?: string }> {
    if (!this.socket.connected) await new Promise<void>((r) => this.socket.once('connect', () => r()));
    const r = await this.emit<{ ok: boolean; guestId: string; token?: string }>(EV.hello, { protocolVersion: PROTOCOL_VERSION, token: this.token, name: this.name });
    if (r.token) this.token = r.token;
    return r;
  }

  /** Simulates a page reload / network drop: new socket, same stored token. */
  async reconnect(): Promise<void> {
    this.socket.disconnect();
    this.snap = null;
    this.socket = this.open();
    await this.hello();
  }

  /** A second device using the same token (takeover). */
  clone(): TestClient {
    const c = new TestClient(this.url, this.name);
    c.token = this.token;
    return c;
  }

  async cmd(command: Command, commandId: string = crypto.randomUUID()): Promise<CommandAck> {
    return this.emit<CommandAck>(EV.cmd, { commandId, matchId: this.snap!.match!.matchId, command });
  }

  async sync(): Promise<Snapshot> {
    const r = await this.emit<{ ok: boolean; snapshot: Snapshot }>(EV.sync);
    this.snap = r.snapshot;
    return r.snapshot;
  }

  get seat(): string | null {
    return this.snap?.me.seat ?? null;
  }

  close(): void {
    this.socket.disconnect();
  }
}

export async function until(pred: () => boolean, ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (!pred()) {
    if (Date.now() > end) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Create a room with 4 connected, ready guests and start the match. */
export async function fullTable(url: string) {
  const clients = ['Аня', 'Боря', 'Вика', 'Гоша'].map((n) => new TestClient(url, n));
  for (const c of clients) await c.hello();
  const created = await clients[0]!.emit<{ ok: boolean; code: string }>(EV.create, { settings: { minigameEvery: 2 } });
  for (const c of clients.slice(1)) {
    const r = await c.emit(EV.join, { code: created.code });
    if (!r.ok) throw new Error(`join failed ${r.error}`);
  }
  for (const c of clients) await c.emit(EV.ready, { ready: true });
  const st = await clients[0]!.emit(EV.start);
  if (!st.ok) throw new Error(`start failed ${st.error}`);
  await until(() => clients.every((c) => !!c.snap?.match));
  return { clients, code: created.code };
}

export function current(c: TestClient): string {
  const m = c.snap!.match!;
  return m.order[m.turnIndex]!;
}

export function bySeat(clients: TestClient[], seat: string): TestClient {
  return clients.find((c) => c.seat === seat)!;
}
