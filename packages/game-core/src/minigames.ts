// Shared mini-game engines used both for group episodes and duels.
// The server owns all timing; clients only send taps (signal id / stop index).
import { RULESET } from '@pb/content';
import { RuleError, emit, ensure } from './ctx';
import type { Ctx } from './ctx';
import type { MemoryGame, Minigame, MinigameKind, MinigameResult, ReactionGame, SeatId } from './types';

export const MINIGAME_INFO: Record<MinigameKind, { title: string; rules: string }> = {
  reaction: {
    title: 'Касса закрывается',
    rules:
      'Наверху — заказ. Нажимайте только покупателей с этим заказом и пропускайте остальных. Верно: +2 (быстро: +3). Ошибка: −2.',
  },
  memory: {
    title: 'Курьер без навигатора',
    rules:
      'Запомните маршрут по остановкам, затем повторите его нажатиями. Каждая верная остановка: +1, весь маршрут: +2. Маршрут удлиняется.',
  },
};

export const REACTION = {
  durationMs: 30_000,
  signalEveryMs: 1_100,
  ttlMs: 1_700,
  slots: 6,
  orderEveryMs: 10_000,
  icons: ['☕', '🥐', '🍕', '🍦', '🥤', '🍔'],
  hit: 2,
  fastBonus: 1,
  mistake: -2,
  spam: -1,
  /** Allowed network/clock skew around a signal window. */
  earlyToleranceMs: 150,
  lateToleranceMs: 400,
  maxInputsPerSecond: 6,
};

export const MEMORY = {
  stops: ['🏠', '🏫', '🏥', '🏦', '🏪', '🏭', '🏟️', '🌳', '⛲'],
  lengths: [3, 4, 5, 6],
  leadMs: 900,
  perStopShowMs: 650,
  inputBaseMs: 4_000,
  inputPerStopMs: 900,
  pause: 700,
  stepPoint: 1,
  completeBonus: 2,
};

function createReaction(ctx: Ctx, participants: SeatId[]): ReactionGame {
  const { rng } = ctx;
  const icons = REACTION.icons;
  const orders: ReactionGame['orders'] = [];
  let lastOrder = -1;
  for (let from = 0; from < REACTION.durationMs; from += REACTION.orderEveryMs) {
    let k = rng.int(0, icons.length - 1);
    if (k === lastOrder) k = (k + 1) % icons.length;
    lastOrder = k;
    orders.push({ from, icon: icons[k]! });
  }
  const signals: ReactionGame['signals'] = [];
  let id = 1;
  for (let at = 1_200; at < REACTION.durationMs - REACTION.ttlMs; at += REACTION.signalEveryMs + rng.int(-200, 200)) {
    const order = [...orders].reverse().find((o) => o.from <= at)!;
    const target = rng.float() < 0.5;
    let icon = order.icon;
    if (!target) {
      const others = icons.filter((x) => x !== order.icon);
      icon = others[rng.int(0, others.length - 1)]!;
    }
    signals.push({ id: id++, at, ttl: REACTION.ttlMs, slot: rng.int(0, REACTION.slots - 1), icon, target });
  }
  const players: ReactionGame['players'] = {};
  for (const p of participants) players[p] = { answered: [], score: 0, hits: 0, mistakes: 0, inputs: 0, recent: [] };
  return { kind: 'reaction', playStart: 0, playEnd: 0, orders, signals, players };
}

function createMemory(ctx: Ctx, participants: SeatId[]): MemoryGame {
  const sequences = MEMORY.lengths.map((len) => {
    const seq: number[] = [];
    while (seq.length < len) {
      const k = ctx.rng.int(0, MEMORY.stops.length - 1);
      if (seq[seq.length - 1] !== k) seq.push(k);
    }
    return seq;
  });
  const players: MemoryGame['players'] = {};
  for (const p of participants) players[p] = { pos: 0, failed: false, done: false, score: 0, inputs: 0, roundsCompleted: 0 };
  return { kind: 'memory', stops: MEMORY.stops, rounds: [], round: 0, revealed: null, sequences, players };
}

export function createMinigame(ctx: Ctx, kind: MinigameKind, context: 'group' | 'duel', participants: SeatId[]): Minigame {
  const s = ctx.s;
  const id = s.nextId++;
  const game = kind === 'reaction' ? createReaction(ctx, participants) : createMemory(ctx, participants);
  const mg: Minigame = {
    id,
    kind,
    context,
    participants,
    stage: 'intro',
    stageEndsAt: ctx.now + RULESET.minigameIntroMs,
    ready: [],
    game,
    results: null,
    applied: false,
  };
  emit(ctx, { t: 'minigame', id, kind, context, stage: 'intro' });
  return mg;
}

function scheduleMemoryRound(g: MemoryGame, round: number, from: number): void {
  const len = MEMORY.lengths[round]!;
  const showStart = from + MEMORY.leadMs;
  const showEnd = showStart + len * MEMORY.perStopShowMs;
  g.rounds[round] = { length: len, showStart, showEnd, inputEnd: showEnd + MEMORY.inputBaseMs + len * MEMORY.inputPerStopMs };
  g.round = round;
  g.revealed = round;
  for (const p of Object.values(g.players)) {
    p.pos = 0;
    p.failed = false;
    p.done = false;
  }
}

function startPlay(ctx: Ctx, mg: Minigame): void {
  mg.stage = 'play';
  const g = mg.game;
  if (g.kind === 'reaction') {
    g.playStart = ctx.now;
    g.playEnd = ctx.now + REACTION.durationMs;
    mg.stageEndsAt = g.playEnd;
  } else {
    scheduleMemoryRound(g, 0, ctx.now);
    mg.stageEndsAt = g.rounds[0]!.inputEnd;
  }
  emit(ctx, { t: 'minigame', id: mg.id, kind: mg.kind, context: mg.context, stage: 'play' });
}

export function minigameReady(ctx: Ctx, mg: Minigame, seat: SeatId): void {
  ensure(mg.stage === 'intro', 'wrongStage');
  if (!mg.ready.includes(seat)) mg.ready.push(seat);
  if (mg.participants.every((p) => mg.ready.includes(p))) startPlay(ctx, mg);
}

export function minigameInput(ctx: Ctx, mg: Minigame, seat: SeatId, value: number): void {
  ensure(mg.stage === 'play', 'wrongStage');
  ensure(Number.isInteger(value), 'badInput');
  const now = ctx.now;
  const g = mg.game;
  if (g.kind === 'reaction') {
    const p = g.players[seat]!;
    p.recent = p.recent.filter((t) => now - t < 1000);
    p.recent.push(now);
    p.inputs += 1;
    if (p.recent.length > REACTION.maxInputsPerSecond) {
      p.score += REACTION.spam;
      p.mistakes += 1;
      throw new RuleError('tooFast');
    }
    const sig = g.signals.find((x) => x.id === value);
    ensure(sig, 'badInput');
    ensure(!p.answered.includes(sig.id), 'alreadyAnswered');
    const shown = g.playStart + sig.at;
    ensure(now >= shown - REACTION.earlyToleranceMs && now <= shown + sig.ttl + REACTION.lateToleranceMs, 'late');
    p.answered.push(sig.id);
    if (sig.target) {
      p.hits += 1;
      p.score += REACTION.hit + (now - shown <= sig.ttl / 2 + REACTION.earlyToleranceMs ? REACTION.fastBonus : 0);
    } else {
      p.mistakes += 1;
      p.score += REACTION.mistake;
    }
    return;
  }
  const r = g.rounds[g.round]!;
  ensure(now >= r.showEnd - 100 && now <= r.inputEnd + 300, 'notInputTime');
  ensure(value >= 0 && value < g.stops.length, 'badInput');
  const p = g.players[seat]!;
  ensure(!p.done && !p.failed, 'roundOver');
  p.inputs += 1;
  if (g.sequences[g.round]![p.pos] === value) {
    p.pos += 1;
    p.score += MEMORY.stepPoint;
    if (p.pos === r.length) {
      p.done = true;
      p.roundsCompleted += 1;
      p.score += MEMORY.completeBonus;
    }
  } else {
    p.failed = true;
  }
  // Everybody finished the round early → move on.
  if (Object.values(g.players).every((x) => x.done || x.failed)) advanceMemoryRound(ctx, mg);
}

function advanceMemoryRound(ctx: Ctx, mg: Minigame): void {
  const g = mg.game as MemoryGame;
  if (g.round + 1 < MEMORY.lengths.length) {
    scheduleMemoryRound(g, g.round + 1, ctx.now + MEMORY.pause);
    mg.stageEndsAt = g.rounds[g.round]!.inputEnd;
  } else {
    finishPlay(ctx, mg);
  }
}

function finishPlay(ctx: Ctx, mg: Minigame): void {
  mg.stage = 'results';
  mg.stageEndsAt = ctx.now + RULESET.minigameResultsMs;
  mg.results = computeResults(ctx, mg);
  emit(ctx, { t: 'minigame', id: mg.id, kind: mg.kind, context: mg.context, stage: 'results' });
}

/** Ranks participants and assigns prizes once. Ghosts are ranked separately and never take a money place. */
export function computeResults(ctx: Ctx, mg: Minigame): MinigameResult[] {
  const g = mg.game;
  const entries = mg.participants.map((seat) => {
    const pl = g.players[seat]!;
    const role = ctx.s.players.find((p) => p.seat === seat)!.role;
    return { seat, score: pl.score, participated: pl.inputs > 0, ghost: role !== 'alive' };
  });
  const results: MinigameResult[] = entries.map((e) => ({ ...e, place: null, prize: 0 }));
  const ranked = results
    .filter((r) => !r.ghost && r.participated)
    .sort((a, b) => b.score - a.score || a.seat.localeCompare(b.seat));
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1]!.score === ranked[i]!.score) j++;
    const prizes = RULESET.minigamePrizes.slice(i, j + 1) as readonly number[];
    const total = prizes.reduce((a, b) => a + b, 0);
    const share = Math.floor(total / (j - i + 1));
    for (let k = i; k <= j; k++) {
      ranked[k]!.place = i + 1;
      ranked[k]!.prize = mg.context === 'group' ? share : 0;
    }
    i = j + 1;
  }
  return results;
}

/** Advances stage timers. Returns true when the mini-game has fully finished (after results). */
export function tickMinigame(ctx: Ctx, mg: Minigame): boolean {
  for (let guard = 0; guard < 20; guard++) {
    if (mg.stage === 'intro' && ctx.now >= mg.stageEndsAt) {
      ctx.changed = true;
      startPlay(ctx, mg);
      continue;
    }
    if (mg.stage === 'play') {
      const g = mg.game;
      if (g.kind === 'reaction' && ctx.now >= g.playEnd) {
        ctx.changed = true;
        finishPlay(ctx, mg);
        continue;
      }
      if (g.kind === 'memory' && g.revealed !== null && ctx.now >= g.rounds[g.round]!.showEnd) {
        g.revealed = null;
        ctx.changed = true;
      }
      if (g.kind === 'memory' && ctx.now >= g.rounds[g.round]!.inputEnd) {
        ctx.changed = true;
        advanceMemoryRound(ctx, mg);
        continue;
      }
    }
    if (mg.stage === 'results' && ctx.now >= mg.stageEndsAt) {
      ctx.changed = true;
      return true;
    }
    return false;
  }
  return false;
}

/** Next moment the mini-game changes on its own (for server timers and public snapshots). */
export function minigameDeadline(mg: Minigame): number {
  if (mg.stage === 'play' && mg.game.kind === 'memory' && mg.game.revealed !== null) {
    return Math.min(mg.game.rounds[mg.game.round]!.showEnd, mg.stageEndsAt);
  }
  return mg.stageEndsAt;
}

/** Remove a participant who left: they simply stop producing input (DNF). */
export function dropParticipant(mg: Minigame, seat: SeatId): void {
  if (!mg.ready.includes(seat)) mg.ready.push(seat);
}
