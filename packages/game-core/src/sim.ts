// Whole-match simulation with debug bots and a simulated clock (tests and balance probes only).
import { GROUP_ORDER, groupTiles } from '@pb/content';
import { botCommand } from './bot';
import { advance, applyCommand, createMatch, nextDeadline } from './engine';
import { MAP } from './rules';
import type { MatchSettings, MatchState } from './types';

export function simulate(seed: number, seats = 4, extra: Partial<MatchSettings> = {}): { s: MatchState; steps: number } {
  let s = createMatch({
    matchId: `sim${seed}`,
    seed,
    seats: Array.from({ length: seats }, (_, i) => ({ seat: `s${i}`, name: `B${i}`, avatar: i })),
    settings: { minigameEvery: 2, debug: seats !== 4, ...extra },
    now: 0,
  });
  let now = 0;
  let steps = 0;
  for (; steps < 40000 && s.phase !== 'FINISHED'; steps++) {
    let acted = false;
    for (const p of s.players) {
      const cmd = botCommand(s, p.seat, now);
      if (!cmd) continue;
      const r = applyCommand(s, p.seat, cmd, now);
      if (r.ok) {
        s = r.state;
        acted = true;
        break;
      }
    }
    for (const p of s.players) if (p.cash < 0) throw new Error(`negative cash ${p.seat}`);
    if (acted) {
      now += 250;
      continue;
    }
    const d = nextDeadline(s);
    if (d === null) throw new Error(`stuck in ${s.phase}`);
    now = Math.max(now + 250, Math.min(d, now + 250));
    const a = advance(s, now);
    if (a) s = a.state;
  }
  return { s, steps };
}

export interface BalanceStats {
  games: number;
  bankruptPerGame: number;
  gamesWithBankruptcy: number;
  fullSetsAtEnd: number;
  upgradeLevels: number;
  ownedTiles: number;
  trades: number;
  avgCashAtEnd: number;
  winnerLead: number;
  simMinutes: number;
}

/** Aggregated statistics of `games` bot matches (seeds 1..games). */
export function balanceStats(games: number, extra: Partial<MatchSettings> = {}): BalanceStats {
  let bankrupt = 0, withB = 0, sets = 0, levels = 0, owned = 0, trades = 0, cash = 0, lead = 0, ms = 0;
  for (let seed = 1; seed <= games; seed++) {
    const { s } = simulate(seed, 4, extra);
    const ghosts = s.players.filter((p) => p.role === 'ghost').length;
    bankrupt += ghosts;
    if (ghosts) withB++;
    for (const g of GROUP_ORDER) {
      const t = groupTiles(MAP, g);
      const o = s.tiles[t[0]!]?.owner;
      if (o && t.every((i) => s.tiles[i]?.owner === o)) sets++;
    }
    levels += s.tiles.reduce((a, o) => a + (o?.level ?? 0), 0);
    owned += s.tiles.filter((o) => o?.owner).length;
    trades += s.stats.tradesAccepted ?? 0;
    const alive = s.players.filter((p) => p.role === 'alive');
    cash += alive.reduce((a, p) => a + p.cash, 0) / Math.max(1, alive.length);
    const vals = (s.standings ?? []).filter((x) => x.rank !== null).map((x) => x.value).sort((a, b) => b - a);
    if (vals.length >= 2) lead += (vals[0]! - vals[1]!) / Math.max(1, vals[1]!);
    ms += s.now;
  }
  const r = (x: number) => Math.round((x / games) * 100) / 100;
  return {
    games,
    bankruptPerGame: r(bankrupt),
    gamesWithBankruptcy: r(withB),
    fullSetsAtEnd: r(sets),
    upgradeLevels: r(levels),
    ownedTiles: r(owned),
    trades: r(trades),
    avgCashAtEnd: Math.round(cash / games),
    winnerLead: r(lead),
    simMinutes: r(ms / 60000),
  };
}
