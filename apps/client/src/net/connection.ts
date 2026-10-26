import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Command } from '@pb/game-core';
import { EV, PROTOCOL_VERSION } from '@pb/protocol';
import type { CommandAck, RoomSettings, Snapshot } from '@pb/protocol';
import { applySnapshot, get, set, toast } from '../state/store';
import { errorText } from '../ui/format';
import { playSound } from '../ui/sound';
import { serverUrl, storage, uuid } from './util';

type AckResult = { ok: boolean; error?: string; [k: string]: unknown };

let socket: Socket | null = null;

export function connect(): void {
  if (socket) return;
  socket = io(serverUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  set({ conn: 'connecting' });
  socket.on('connect', () => void hello());
  socket.on('disconnect', () => set({ conn: get().conn === 'replaced' ? 'replaced' : 'offline' }));
  socket.on('connect_error', () => set({ conn: 'offline' }));
  socket.on(EV.snapshot, (snap: Snapshot) => applySnapshot(snap));
  socket.on(EV.replaced, () => {
    set({ conn: 'replaced' });
    socket?.io.opts && (socket.io.opts.reconnection = false);
  });
  // Back from background: drop stale animations and ask for a fresh authoritative snapshot.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      set({ moves: [] });
      if (socket?.connected) void sync();
      else socket?.connect();
    }
  });
}

/** Test hook: drop the transport as a network failure would (auto-reconnect follows). */
export function debugDropConnection(): void {
  socket?.io.engine?.close();
}

/** Take the seat back on this device after another device replaced us. */
export function reclaim(): void {
  if (!socket) return;
  socket.io.opts.reconnection = true;
  set({ conn: 'connecting' });
  socket.connect();
}

async function emit<T extends AckResult>(event: string, payload?: unknown, timeoutMs = 8000): Promise<T> {
  if (!socket?.connected) return { ok: false, error: 'offline' } as T;
  try {
    return (await socket.timeout(timeoutMs).emitWithAck(event, payload ?? {})) as T;
  } catch {
    return { ok: false, error: 'timeout' } as T;
  }
}

async function hello(): Promise<void> {
  const name = storage.name() || undefined;
  const r = await emit<AckResult & { guestId: string; name: string; token?: string }>(EV.hello, { protocolVersion: PROTOCOL_VERSION, token: storage.token(), name });
  if (!r.ok) {
    set({ conn: 'error', connError: r.error ?? 'error' });
    return;
  }
  if (r.token) storage.setToken(r.token);
  set({ conn: 'online', connError: null, guestId: r.guestId, name: r.name });
  void syncTime();
}

async function syncTime(): Promise<void> {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const r = await emit<AckResult & { serverTime: number }>(EV.ping);
    const t1 = Date.now();
    if (r.ok && t1 - t0 < best) {
      best = t1 - t0;
      set({ offset: r.serverTime - (t0 + t1) / 2 });
    }
  }
}

export async function sync(): Promise<void> {
  const r = await emit<AckResult & { snapshot: Snapshot }>(EV.sync);
  if (r.ok) applySnapshot(r.snapshot);
}

function report(r: AckResult): boolean {
  if (!r.ok) {
    toast(errorText(r.error ?? 'error'), 'error');
    playSound('error');
  }
  return r.ok;
}

export const api = {
  async setName(name: string) {
    storage.setName(name);
    set({ name });
    // Re-hello updates the name (only allowed outside a started match).
    await emit(EV.hello, { protocolVersion: PROTOCOL_VERSION, token: storage.token(), name });
  },
  async create(settings: RoomSettings) {
    const r = await emit<AckResult & { code: string }>(EV.create, { settings });
    return report(r) ? r.code : null;
  },
  async join(code: string) {
    return report(await emit(EV.join, { code }));
  },
  ready: async (ready: boolean) => report(await emit(EV.ready, { ready })),
  avatar: async (avatar: number) => report(await emit(EV.avatar, { avatar })),
  settings: async (s: RoomSettings) => report(await emit(EV.settings, s)),
  start: async () => report(await emit(EV.start)),
  leave: async () => report(await emit(EV.leave)),
  rematch: async () => report(await emit(EV.rematch)),
  /** Dev-mode-only QA shortcuts (server rejects them in production). */
  devCheat: async (op: string) => report(await emit('dev:cheat', { op })),
};

/** Send a match command. A command keeps the same id across retries, so the server never runs it twice. */
export async function send(command: Command, opts: { quiet?: boolean } = {}): Promise<boolean> {
  const match = get().match;
  if (!match) return false;
  const commandId = uuid();
  set({ pending: get().pending + 1 });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await emit<CommandAck & AckResult>(EV.cmd, { commandId, matchId: match.matchId, command }, 5000);
      if (r.error === 'timeout' || r.error === 'offline') {
        await new Promise((res) => setTimeout(res, 600));
        continue;
      }
      if (!r.ok && opts.quiet) return false;
      return report(r);
    }
    return report({ ok: false, error: 'timeout' });
  } finally {
    set({ pending: get().pending - 1 });
  }
}
