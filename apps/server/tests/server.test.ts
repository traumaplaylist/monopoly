import { afterEach, describe, expect, it } from 'vitest';
import { EV } from '@pb/protocol';
import { ManualClock } from '../src/clock';
import { TestClient, bySeat, current, fullTable, startServer, tempDb, until } from './helpers';

const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function boot(opts: Parameters<typeof startServer>[0] = {}) {
  const env = await startServer(opts);
  cleanup.push(() => env.server.close());
  return env;
}

describe('комнаты', () => {
  it('четыре клиента вступают в комнату и видят одно состояние', async () => {
    const { url } = await boot();
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    const seats = clients.map((c) => c.seat);
    expect(new Set(seats).size).toBe(4);
    await until(() => new Set(clients.map((c) => c.snap!.match!.revision)).size === 1);
    const m = clients[0]!.snap!.match!;
    expect(m.phase).toBe('PRE_ROLL');
    expect(clients.every((c) => c.snap!.match!.matchId === m.matchId)).toBe(true);
    // Секрет возобновления и RNG не попадают в снимок.
    const raw = JSON.stringify(clients[0]!.snap);
    expect(raw).not.toContain(clients[1]!.token!);
    expect(raw).not.toContain('"rng"');
  });

  it('старт без четырёх готовых запрещён, пятый не войдёт', async () => {
    const { url } = await boot();
    const a = new TestClient(url, 'A');
    await a.hello();
    const { code } = await a.emit<{ ok: boolean; code: string }>(EV.create);
    expect((await a.emit(EV.start)).error).toBe('needFourPlayers');
    const others = [1, 2, 3, 4].map((i) => new TestClient(url, `P${i}`));
    cleanup.push(() => [a, ...others].forEach((c) => c.close()));
    for (const c of others) await c.hello();
    for (const c of others.slice(0, 3)) expect((await c.emit(EV.join, { code })).ok).toBe(true);
    expect((await others[3]!.emit(EV.join, { code })).error).toBe('roomFull');
    expect((await a.emit(EV.start)).error).toBe('notAllReady');
    expect((await others[0]!.emit(EV.start)).error).toBe('notHost');
  });

  it('вторая комната изолирована', async () => {
    const { url } = await boot();
    const t1 = await fullTable(url);
    const t2 = await fullTable(url);
    cleanup.push(() => [...t1.clients, ...t2.clients].forEach((c) => c.close()));
    const c1 = bySeat(t1.clients, current(t1.clients[0]!));
    expect((await c1.cmd({ type: 'ROLL' })).ok).toBe(true);
    await until(() => t1.clients.every((c) => c.snap!.match!.turn.rolled));
    expect(t2.clients.every((c) => !c.snap!.match!.turn.rolled)).toBe(true);
    expect(t1.clients[0]!.snap!.match!.matchId).not.toBe(t2.clients[0]!.snap!.match!.matchId);
  });

  it('нельзя ходить чужим местом; бросок виден всем одинаково', async () => {
    const { url } = await boot();
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    const cur = current(clients[0]!);
    const wrong = clients.find((c) => c.seat !== cur)!;
    expect((await wrong.cmd({ type: 'ROLL' })).error).toBe('notYourTurn');
    expect((await bySeat(clients, cur).cmd({ type: 'ROLL' })).ok).toBe(true);
    await until(() => clients.every((c) => c.snap!.match!.turn.rolled));
    const pos = clients.map((c) => c.snap!.match!.players.find((p) => p.seat === cur)!.position);
    expect(new Set(pos).size).toBe(1);
  });

  it('повтор commandId не исполняется дважды; другой payload с тем же id — конфликт', async () => {
    const { url } = await boot();
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    const me = bySeat(clients, current(clients[0]!));
    const first = await me.cmd({ type: 'ROLL' }, 'cmd-roll-0001');
    const again = await me.cmd({ type: 'ROLL' }, 'cmd-roll-0001');
    expect(first.ok).toBe(true);
    expect(again).toMatchObject({ ok: true, duplicate: true, revision: first.revision });
    const conflict = await me.cmd({ type: 'END_TURN' }, 'cmd-roll-0001');
    expect(conflict.error).toBe('commandIdConflict');
    await me.sync();
    expect(me.snap!.match!.log.filter((e) => e.t === 'rolled')).toHaveLength(1);
  });

  it('поддельный ввод мини-игры отклоняется схемой или ядром', async () => {
    const { url } = await boot();
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    const r1 = await clients[0]!.emit(EV.cmd, { commandId: 'fake-score-1', matchId: clients[0]!.snap!.match!.matchId, command: { type: 'MG_INPUT', minigameId: 1, value: 9999, score: 9999 } });
    expect(r1.ok).toBe(false);
    const r2 = await clients[0]!.emit(EV.cmd, { commandId: 'fake-score-2', matchId: 'x', command: { type: 'SET_CASH', amount: 1e6 } });
    expect(r2.error).toBe('badRequest');
  });
});

describe('переподключение', () => {
  it('перезагрузка возвращает то же место; второе устройство вытесняет первое', async () => {
    const { url } = await boot();
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    const a = clients[0]!;
    const seat = a.seat;
    const guest = a.snap!.me.guestId;
    await a.reconnect();
    await until(() => !!a.snap?.match);
    expect(a.seat).toBe(seat);
    expect(a.snap!.me.guestId).toBe(guest);
    expect(a.snap!.room!.seats).toHaveLength(4);

    const b = a.clone();
    cleanup.push(() => b.close());
    await b.hello();
    await until(() => a.replaced && !!b.snap?.match);
    expect(b.seat).toBe(seat);
    // Старое соединение больше не управляет местом.
    expect(a.socket.connected).toBe(false);
  });

  it('перезапуск сервера восстанавливает матч из SQLite', async () => {
    const dbPath = tempDb();
    const clock = new ManualClock();
    const first = await startServer({ dbPath, clock });
    const { clients } = await fullTable(first.url);
    const me = bySeat(clients, current(clients[0]!));
    await me.cmd({ type: 'ROLL' });
    await until(() => clients.every((c) => c.snap!.match!.turn.rolled));
    const before = clients[0]!.snap!.match!;
    clients.forEach((c) => c.close());
    await first.server.close();

    const second = await startServer({ dbPath, clock });
    cleanup.push(() => second.server.close());
    const again = clients.map((c) => {
      const n = new TestClient(second.url, c.name);
      n.token = c.token;
      return n;
    });
    cleanup.push(() => again.forEach((c) => c.close()));
    for (const c of again) await c.hello();
    await until(() => again.every((c) => !!c.snap?.match));
    const after = again[0]!.snap!.match!;
    expect(after.matchId).toBe(before.matchId);
    expect(after.revision).toBeGreaterThanOrEqual(before.revision);
    expect(after.players.map((p) => p.position)).toEqual(before.players.map((p) => p.position));
    expect(again.map((c) => c.seat).sort()).toEqual(clients.map((c) => c.seat).sort());
  });

  it('отключение во время аукциона не блокирует стол: срок закрывает торги', async () => {
    const clock = new ManualClock();
    const { url } = await boot({ clock });
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    // Бросаем, пока не окажемся на свободном объекте.
    for (let i = 0; i < 30; i++) {
      const m = clients[0]!.snap!.match!;
      const me = bySeat(clients, current(clients[0]!));
      if (m.phase === 'PURCHASE') {
        await me.cmd({ type: 'DECLINE_BUY' });
        break;
      }
      if (m.phase === 'PRE_ROLL') await me.cmd({ type: 'ROLL' });
      else await clock.advance(30_000);
      await new Promise((r) => setTimeout(r, 30));
    }
    await until(() => clients[1]!.snap!.match!.phase === 'AUCTION');
    clients[2]!.close();
    await clock.advance(13_000);
    await until(() => clients[0]!.snap!.match!.phase !== 'AUCTION');
    expect(clients[0]!.snap!.match!.phase).toBe('POST_ROLL');
  });
});

describe('полная партия через сервер', () => {
  it('ускоренная партия доходит до финала, затем реванш той же компанией', async () => {
    const clock = new ManualClock();
    const { url } = await boot({ clock });
    const { clients } = await fullTable(url);
    cleanup.push(() => clients.forEach((c) => c.close()));
    let guard = 0;
    while (clients[0]!.snap!.match!.phase !== 'FINISHED' && guard++ < 3000) {
      const m = clients[0]!.snap!.match!;
      const cur = bySeat(clients, current(clients[0]!));
      const rev = m.revision;
      let acted = true;
      switch (m.phase) {
        case 'PRE_ROLL':
          await cur.cmd({ type: 'ROLL' });
          break;
        case 'PURCHASE':
          await cur.cmd({ type: m.players.find((p) => p.seat === cur.seat)!.cash > 400 ? 'BUY' : 'DECLINE_BUY' });
          break;
        case 'POST_ROLL':
          await cur.cmd({ type: 'END_TURN' });
          break;
        case 'RENT_CHOICE':
          await cur.cmd({ type: 'USE_DISCOUNT' });
          break;
        case 'DEBT':
          await cur.cmd({ type: 'DECLARE_BANKRUPTCY' });
          break;
        case 'MINIGAME':
          if (m.minigame?.stage === 'intro') {
            for (const c of clients) await c.cmd({ type: 'MG_READY', minigameId: m.minigame.id });
          } else acted = false;
          break;
        default:
          acted = false;
      }
      if (!acted) await clock.advance(5_000);
      await until(() => clients[0]!.snap!.match!.revision !== rev || !acted, 2000).catch(() => undefined);
    }
    const end = clients[0]!.snap!.match!;
    expect(end.phase).toBe('FINISHED');
    expect(end.round).toBe(12);
    expect(end.standings!.some((s) => s.winner)).toBe(true);
    await until(() => clients.every((c) => c.snap!.room!.status === 'finished'));
    for (const c of clients) expect((await c.emit(EV.rematch)).ok).toBe(true);
    await until(() => clients.every((c) => c.snap!.match!.matchId !== end.matchId));
    const next = clients[0]!.snap!.match!;
    expect(next.phase).toBe('PRE_ROLL');
    expect(next.round).toBe(1);
    expect(next.players.every((p) => p.cash === 1500 && p.items.join() === 'shield')).toBe(true);
  }, 120_000);
});
