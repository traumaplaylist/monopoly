import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import {
  AvatarSchema,
  CreateRoomSchema,
  EV,
  HelloSchema,
  JoinRoomSchema,
  MatchCommandSchema,
  PROTOCOL_VERSION,
  ReadySchema,
  RoomSettingsSchema,
} from '@pb/protocol';
import type { Ack } from '@pb/protocol';
import type { Clock } from './clock';
import type { ServerConfig } from './config';
import { RoomService, ServiceError } from './rooms';
import { Store } from './store';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function staticHandler(dir: string | null): http.RequestListener {
  return (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (!dir) {
      res.writeHead(404);
      res.end('Party Board server');
      return;
    }
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    let file = path.normalize(path.join(dir, url));
    if (!file.startsWith(dir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  };
}

/** Token bucket per connection: 25 messages per second. */
function rateLimiter(clock: Clock) {
  let tokens = 25;
  let last = clock.now();
  return () => {
    const now = clock.now();
    tokens = Math.min(25, tokens + ((now - last) / 1000) * 25);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

export interface GameServer {
  http: http.Server;
  io: Server;
  service: RoomService;
  store: Store;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export function createGameServer(config: ServerConfig, clock: Clock): GameServer {
  const store = new Store(config.dbPath);
  const httpServer = http.createServer(staticHandler(config.staticDir));
  const io = new Server(httpServer, {
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: config.devMode ? true : config.allowedOrigins, credentials: false },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000, skipMiddlewares: true },
  });

  const sockets = new Map<string, Socket>();

  const service = new RoomService(store, clock, config, (roomId) => {
    for (const guestId of service.guestsOfRoom(roomId)) pushSnapshot(guestId);
  });

  function pushSnapshot(guestId: string): void {
    for (const s of sockets.values()) {
      if (s.data.guestId === guestId && service.isActive(guestId, s.id)) s.emit(EV.snapshot, service.snapshot(guestId));
    }
  }

  io.on('connection', (socket) => {
    sockets.set(socket.id, socket);
    const allow = rateLimiter(clock);

    const on = <T>(event: string, schema: { safeParse(x: unknown): { success: true; data: T } | { success: false } } | null, fn: (data: T, guestId: string) => unknown) => {
      socket.on(event, (payload: unknown, ack?: (r: unknown) => void) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        if (!allow()) return reply({ ok: false, error: 'rateLimited' });
        const guestId = socket.data.guestId as string | undefined;
        if (event !== EV.hello && (!guestId || !service.isActive(guestId, socket.id))) return reply({ ok: false, error: 'noSession' });
        let data = payload as T;
        if (schema) {
          const parsed = schema.safeParse(payload);
          if (!parsed.success) return reply({ ok: false, error: 'badRequest' });
          data = parsed.data;
        }
        try {
          const result = fn(data, guestId!);
          reply(result ?? { ok: true });
        } catch (e) {
          if (e instanceof ServiceError) return reply({ ok: false, error: e.code });
          console.error('[server] handler error', event, e);
          reply({ ok: false, error: 'serverError' });
        }
      });
    };

    on(EV.hello, HelloSchema, (data): Ack<{ guestId: string; name: string; token?: string }> => {
      if (data.protocolVersion !== PROTOCOL_VERSION) return { ok: false, error: 'protocolMismatch' };
      const { guest, token } = service.hello(data.token, data.name);
      socket.data.guestId = guest.guest_id;
      const replaced = service.attach(guest.guest_id, socket.id);
      if (replaced) {
        const old = sockets.get(replaced);
        old?.emit(EV.replaced);
        old?.disconnect(true);
      }
      setImmediate(() => pushSnapshot(guest.guest_id));
      return { ok: true, guestId: guest.guest_id, name: guest.name, ...(token ? { token } : {}) };
    });
    on(EV.create, CreateRoomSchema, (data, g) => ({ ok: true, code: service.create(g, data.settings).code }));
    on(EV.join, JoinRoomSchema, (data, g) => ({ ok: true, code: service.join(g, data.code).code }));
    on(EV.ready, ReadySchema, (data, g) => service.setReady(g, data.ready));
    on(EV.avatar, AvatarSchema, (data, g) => service.setAvatar(g, data.avatar));
    on(EV.settings, RoomSettingsSchema, (data, g) => service.setSettings(g, data));
    on(EV.start, null, (_d, g) => service.start(g));
    on(EV.leave, null, (_d, g) => service.leave(g));
    on(EV.rematch, null, (_d, g) => service.rematch(g));
    on(EV.cmd, MatchCommandSchema, (data, g) => service.command(g, data));
    on(EV.sync, null, (_d, g) => ({ ok: true, snapshot: service.snapshot(g) }));
    on(EV.ping, null, () => ({ ok: true, serverTime: clock.now() }));

    socket.on('disconnect', () => {
      sockets.delete(socket.id);
      const guestId = socket.data.guestId as string | undefined;
      if (guestId) service.detach(guestId, socket.id);
    });
  });

  service.boot();
  const sweepTimer = setInterval(() => service.sweep(), 10_000);
  sweepTimer.unref();

  return {
    http: httpServer,
    io,
    service,
    store,
    listen: () =>
      new Promise((resolve) => {
        httpServer.listen(config.port, config.host, () => {
          const addr = httpServer.address();
          resolve(typeof addr === 'object' && addr ? addr.port : config.port);
        });
      }),
    close: async () => {
      clearInterval(sweepTimer);
      service.shutdown();
      await new Promise<void>((r) => io.close(() => r()));
      store.close();
    },
  };
}
