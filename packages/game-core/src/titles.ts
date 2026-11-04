// End-of-game titles: fun awards from per-seat counters (s.stats.players). Pure, read-only.
import type { MatchState, PlayerStats, SeatId } from './types';

export interface TitleDef {
  key: keyof PlayerStats;
  icon: string;
  name: string;
  /** Text with the value: `{n}`. */
  text: string;
}

export const TITLES: readonly TitleDef[] = [
  { key: 'rentReceived', icon: '🏨', name: 'Король аренды', text: 'собрал {n} монет аренды' },
  { key: 'rentPaid', icon: '💸', name: 'Щедрая душа', text: 'заплатил {n} монет аренды' },
  { key: 'bought', icon: '🛍️', name: 'Шопоголик', text: 'купил {n} объектов' },
  { key: 'auctionsWon', icon: '🔨', name: 'Гроза аукционов', text: 'выиграл {n} аукционов' },
  { key: 'tilesWalked', icon: '🧭', name: 'Турист года', text: 'прошёл {n} клеток' },
  { key: 'chanceCards', icon: '🍀', name: 'Искатель удачи', text: 'вытянул {n} карт «Шанс»' },
  { key: 'minigameWins', icon: '🎮', name: 'Чемпион мини-игр', text: 'победил в {n} мини-играх' },
  { key: 'duelsWon', icon: '⚔️', name: 'Дуэлянт', text: 'выиграл {n} дуэлей' },
  { key: 'trades', icon: '🤝', name: 'Дипломат', text: 'заключил {n} сделок' },
  { key: 'taxesPaid', icon: '🧾', name: 'Честный налогоплательщик', text: 'отдал {n} монет налогов' },
];

export interface AwardedTitle {
  seat: SeatId;
  title: TitleDef;
  value: number;
  text: string;
}

/** One award per title to the seat with the highest counter (> 0); ties share the title. */
export function matchTitles(s: { stats: MatchState['stats']; players: readonly { seat: SeatId }[] }): AwardedTitle[] {
  const stats = s.stats.players ?? {};
  const res: AwardedTitle[] = [];
  for (const t of TITLES) {
    let best = 0;
    for (const p of s.players) best = Math.max(best, stats[p.seat]?.[t.key] ?? 0);
    if (best <= 0) continue;
    for (const p of s.players) {
      if ((stats[p.seat]?.[t.key] ?? 0) === best) res.push({ seat: p.seat, title: t, value: best, text: t.text.replace('{n}', String(best)) });
    }
  }
  return res;
}
