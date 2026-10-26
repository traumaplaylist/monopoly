// Four independent browser contexts (separate storage = separate guests) play through the real server.
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';

interface Player {
  name: string;
  ctx: BrowserContext;
  page: Page;
  errors: string[];
}

type St = {
  seat: string | null;
  match: null | {
    phase: string;
    round: number;
    order: string[];
    turnIndex: number;
    matchId: string;
    revision: number;
    minigame: null | { id: number; kind: string; stage: string; context: string; participants: string[]; game: { kind: string; current?: number[] | null } };
    trade: null | { to: string };
    duelOffer: null | { seller: string };
    auction: null | { leader: string | null; passed: string[] };
    players: { seat: string; role: string; cash: number }[];
    tiles: ({ owner: string | null } | null)[];
  };
  room: null | { status: string; code: string };
};

async function open(browser: Browser, name: string, viewport: { width: number; height: number }, mobile = false): Promise<Player> {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('WebSocket')) errors.push(m.text());
  });
  return { name, ctx, page, errors };
}

const st = (p: Player) => p.page.evaluate(() => (window as unknown as { __pb: { state: () => unknown } }).__pb.state() as never) as Promise<St>;
const cheat = (p: Player, op: string) => p.page.evaluate((o) => (window as unknown as { __pb: { api: { devCheat: (x: string) => Promise<boolean> } } }).__pb.api.devCheat(o), op);
const shot = (p: Player, file: string) => p.page.screenshot({ path: `${SHOTS}/${file}.png` });

async function clickIf(p: Player, testId: string): Promise<boolean> {
  const el = p.page.locator(`[data-testid="${testId}"]:not([disabled])`);
  if ((await el.count()) === 0) return false;
  await el.first().click({ timeout: 3000 }).catch(() => undefined);
  return true;
}

/** One step of an automatic, UI-driven table. Returns current phase. */
async function step(players: Player[], opts: { buy?: boolean } = {}): Promise<string> {
  const s = await st(players[0]!);
  const m = s.match!;
  for (const p of players) {
    if (await clickIf(p, 'mg-ready')) continue;
  }
  if (m.phase === 'MINIGAME' || m.phase === 'DUEL') {
    if (m.minigame?.stage !== 'intro') await cheat(players[0]!, 'skip');
    await players[0]!.page.waitForTimeout(400);
    return m.phase;
  }
  for (const p of players) {
    if (await clickIf(p, 'auction-pass')) continue;
    if (await clickIf(p, 'accept-trade')) continue;
    if (await clickIf(p, 'use-discount')) continue;
    if (await clickIf(p, opts.buy ? 'buy' : 'decline')) continue;
    if (await clickIf(p, 'roll')) continue;
    if (await clickIf(p, 'end-turn')) continue;
    const debt = p.page.locator('[data-testid="debt"] .btn.danger');
    if (await debt.count()) await debt.click().catch(() => undefined);
  }
  await players[0]!.page.waitForTimeout(500);
  return m.phase;
}

async function playUntil(players: Player[], pred: (s: St) => boolean, max = 200, opts: { buy?: boolean } = {}) {
  for (let i = 0; i < max; i++) {
    const s = await st(players[0]!);
    if (pred(s)) return s;
    await step(players, opts);
  }
  throw new Error('playUntil: condition not reached');
}

function byseat(players: Player[], seats: (string | null)[], seat: string) {
  return players[seats.indexOf(seat)]!;
}

test('стол на четверых: лобби, ходы, мини-игры, дуэль, сделка, призрак, переподключение, финал и реванш', async ({ browser }) => {
  const A = await open(browser, 'Аня', { width: 1366, height: 768 });
  const B = await open(browser, 'Боря', { width: 390, height: 844 }, true);
  const C = await open(browser, 'Вика', { width: 360, height: 800 }, true);
  const D = await open(browser, 'Гоша', { width: 430, height: 932 }, true);
  const players = [A, B, C, D];

  // --- Lobby ---
  await A.page.goto('/');
  await A.page.fill('[data-testid=name]', A.name);
  await shot(A, '01-home-desktop');
  await A.page.click('[data-testid=create]');
  const code = (await A.page.locator('[data-testid=room-code]').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  for (const p of [B, C, D]) {
    await p.page.goto(`/?room=${code}`);
    await p.page.fill('[data-testid=name]', p.name);
    await p.page.click('[data-testid=join]');
    await expect(p.page.locator('[data-testid=room-code]')).toHaveText(code);
  }
  for (const p of players) await p.page.click('[data-testid=ready]');
  await expect(A.page.locator('[data-testid=start]')).toBeEnabled();
  await shot(B, '02-lobby-portrait-390');
  await A.page.click('[data-testid=start]');
  for (const p of players) await expect(p.page.locator('[data-testid=banner]')).toBeVisible({ timeout: 15_000 });
  await A.page.waitForTimeout(1500);
  await shot(A, '03-match-desktop-1366');
  await shot(B, '04-match-portrait-390');
  await shot(C, '05-match-portrait-360');
  await shot(D, '06-match-portrait-430');

  const seats = await Promise.all(players.map(async (p) => (await st(p)).seat));
  expect(new Set(seats).size).toBe(4);

  // --- Same state on every client after a roll ---
  const first = await st(A);
  const cur = byseat(players, seats, first.match!.order[first.match!.turnIndex]!);
  await cur.page.click('[data-testid=roll]');
  await expect.poll(async () => (await Promise.all(players.map(st))).map((s) => s.match!.revision).every((r, _, a) => r === a[0] && r > first.match!.revision)).toBe(true);

  // --- Tile details ---
  await A.page.click('[data-testid=tile-summary]');
  await expect(A.page.locator('[data-testid=tile-sheet]')).toBeVisible();
  await shot(A, '07-tile-details-desktop');
  await A.page.keyboard.press('Escape');
  await A.page.locator('.sheet-layer').click({ position: { x: 5, y: 5 } });
  await B.page.locator('.ab-info [data-testid=tile-summary]').click();
  await expect(B.page.locator('[data-testid=tile-sheet]')).toBeVisible();
  await shot(B, '08-tile-details-portrait');
  await B.page.locator('.sheet-layer').click({ position: { x: 5, y: 5 } });

  // --- Reload: same seat ---
  await B.page.reload();
  await expect(B.page.locator('[data-testid=banner]')).toBeVisible({ timeout: 15_000 });
  expect((await st(B)).seat).toBe(seats[1]);

  // --- Short network drop ---
  await C.ctx.setOffline(true);
  await C.page.evaluate(() => (window as unknown as { __pb: { drop: () => void } }).__pb.drop());
  await expect(C.page.locator('[data-testid=conn-banner]')).toBeVisible({ timeout: 15_000 });
  await shot(C, '09-reconnect-portrait');
  await C.ctx.setOffline(false);
  await expect(C.page.locator('[data-testid=conn-banner]')).toBeHidden({ timeout: 20_000 });
  expect((await st(C)).seat).toBe(seats[2]);

  // --- First group mini-game (reaction) after round 2 ---
  await playUntil(players, (s) => s.match!.phase === 'MINIGAME');
  let s = await st(A);
  expect(s.match!.minigame!.kind).toBe('reaction');
  await shot(B, '10-minigame-intro-portrait');
  for (const p of players) await clickIf(p, 'mg-ready');
  await expect.poll(async () => (await st(A)).match!.minigame?.stage).toBe('play');
  for (let i = 0; i < 12; i++) {
    for (const p of [A, B]) {
      const target = p.page.locator('.customer.on[data-target="1"]');
      if (await target.count()) await target.first().dispatchEvent('pointerdown');
    }
    if (i === 6) await shot(A, '11-reaction-desktop');
    await A.page.waitForTimeout(600);
  }
  await shot(B, '12-reaction-portrait');
  await cheat(A, 'skip');
  await expect.poll(async () => (await st(A)).match!.minigame?.stage).toBe('results');
  await shot(A, '13-minigame-results');
  await cheat(A, 'skip');

  // --- Second mini-game (memory) ---
  await cheat(A, 'minigame');
  await playUntil(players, (x) => x.match!.phase === 'MINIGAME' && x.match!.minigame?.kind === 'memory');
  for (const p of players) await clickIf(p, 'mg-ready');
  await expect.poll(async () => (await st(A)).match!.minigame?.stage).toBe('play');
  s = await st(A);
  const seq = s.match!.minigame!.game.current!;
  expect(seq.length).toBe(3);
  await A.page.waitForTimeout(700);
  await shot(B, '14-memory-show-portrait');
  await expect.poll(async () => (await st(A)).match!.minigame!.game.current ?? null, { timeout: 10_000 }).toBeNull();
  for (const stop of seq) await A.page.locator(`.stop[data-stop="${stop}"]`).dispatchEvent('pointerdown');
  await shot(A, '15-memory-input-desktop');
  await cheat(A, 'skip');
  for (let i = 0; i < 6 && (await st(A)).match!.minigame?.stage === 'play'; i++) {
    await cheat(A, 'skip');
    await A.page.waitForTimeout(300);
  }
  await expect.poll(async () => (await st(A)).match!.minigame?.stage ?? 'done').toBe('results');
  await cheat(A, 'skip');

  // --- Duel: the current player challenges an owner ---
  s = await playUntil(players, (x) => x.match!.phase === 'PRE_ROLL');
  const buyerSeat = s.match!.order[s.match!.turnIndex]!;
  const buyer = byseat(players, seats, buyerSeat);
  const seller = players.find((p) => p !== buyer)!;
  await cheat(seller, 'set');
  await cheat(buyer, 'cash');
  await expect(buyer.page.locator('[data-testid=duel]')).toBeEnabled();
  await buyer.page.click('[data-testid=duel]');
  await expect(buyer.page.locator('[data-testid=duel-sheet]')).toBeVisible();
  await shot(buyer, '16-duel-proposal');
  await buyer.page.click('[data-testid=send-duel]');
  await expect(seller.page.locator('[data-testid=incoming-duel]')).toBeVisible();
  await shot(seller, '17-duel-confirm');
  await seller.page.click('[data-testid=accept-duel]');
  await expect.poll(async () => (await st(A)).match!.phase).toBe('DUEL');
  await clickIf(buyer, 'mg-ready');
  await clickIf(seller, 'mg-ready');
  await expect.poll(async () => (await st(A)).match!.minigame?.stage).toBe('play');
  await buyer.page.waitForTimeout(1200);
  await shot(buyer, '18-duel-play');
  await cheat(A, 'skip');
  for (let i = 0; i < 6 && (await st(A)).match!.minigame?.stage === 'play'; i++) await cheat(A, 'skip');
  await expect.poll(async () => (await st(A)).match!.minigame?.stage ?? 'done').toBe('results');
  await shot(seller, '19-duel-result');
  await cheat(A, 'skip');
  await expect.poll(async () => (await st(A)).match!.phase).toMatch(/PRE_ROLL|POST_ROLL/);

  // --- Trade: same current player offers coins for nothing back ---
  const trader = byseat(players, seats, (await st(A)).match!.order[(await st(A)).match!.turnIndex]!);
  if (await clickIf(trader, 'trade')) {
    await expect(trader.page.locator('[data-testid=trade-sheet]')).toBeVisible();
    await trader.page.locator('[data-testid=trade-sheet] input[type=number]').first().fill('20');
    await shot(trader, '20-trade-sheet');
    await trader.page.click('[data-testid=send-trade]');
    const partner = players.find(async (p) => p !== trader)!;
    void partner;
    await expect.poll(async () => (await st(A)).match!.phase).toBe('TRADE');
    const to = (await st(A)).match!.trade!.to;
    const recv = byseat(players, seats, to);
    await expect(recv.page.locator('[data-testid=incoming-trade]')).toBeVisible();
    await shot(recv, '21-trade-incoming');
    await recv.page.click('[data-testid=accept-trade]');
    await expect.poll(async () => (await st(A)).match!.phase).toMatch(/PRE_ROLL|POST_ROLL/);
  }

  // --- Ghost (dev shortcut for the screenshot; real bankruptcy is covered by core/server tests) ---
  await cheat(D, 'ghost');
  await expect(D.page.locator('[data-testid=ghost-notice]')).toBeVisible();
  await shot(D, '22-ghost-notice-portrait');
  await D.page.click('[data-testid=ghost-notice] .btn');
  await shot(A, '23-ghost-on-board-desktop');

  // --- Finish: last round, then results and rematch ---
  await cheat(A, 'endSoon');
  await playUntil(players, (x) => x.match!.phase === 'FINISHED', 300);
  for (const p of players) await expect(p.page.locator('[data-testid=finished]')).toBeVisible();
  await shot(A, '24-finished-desktop');
  await shot(B, '25-finished-portrait');
  const oldMatch = (await st(A)).match!.matchId;
  for (const p of players) await p.page.click('[data-testid=rematch]');
  await expect.poll(async () => (await st(A)).match!.matchId).not.toBe(oldMatch);
  s = await st(A);
  expect(s.match!.round).toBe(1);
  expect(s.match!.players.every((p) => p.role === 'alive' && p.cash === 1500)).toBe(true);

  // --- Desktop 1920×1080 ---
  await A.page.setViewportSize({ width: 1920, height: 1080 });
  await A.page.waitForTimeout(1200);
  await shot(A, '26-match-desktop-1920');

  for (const p of players) expect(p.errors, `${p.name} console errors`).toEqual([]);
});
