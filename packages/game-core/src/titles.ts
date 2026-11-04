// End-of-game titles: fun awards from per-seat counters (s.stats.players). Pure, read-only.
import type { MatchState, PlayerStats, SeatId } from './types';

export interface TitleDef {
  key: keyof PlayerStats;
  icon: string;
  name: string;
  /** Text with the value: `{n}`. */
  text: string;
}

/** Russian plural: 1 сделку / 2 сделки / 5 сделок. */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const TITLES: readonly (TitleDef & { forms: readonly [string, string, string] })[] = [
  { key: 'rentReceived', icon: '🏨', name: 'Король аренды', text: 'собрал {n} аренды', forms: ['монету', 'монеты', 'монет'] },
  { key: 'rentPaid', icon: '💸', name: 'Щедрая душа', text: 'заплатил {n} аренды', forms: ['монету', 'монеты', 'монет'] },
  { key: 'bought', icon: '🛍️', name: 'Шопоголик', text: 'купил {n}', forms: ['объект', 'объекта', 'объектов'] },
  { key: 'auctionsWon', icon: '🔨', name: 'Гроза аукционов', text: 'выиграл {n}', forms: ['аукцион', 'аукциона', 'аукционов'] },
  { key: 'tilesWalked', icon: '🧭', name: 'Турист года', text: 'прошёл {n}', forms: ['клетку', 'клетки', 'клеток'] },
  { key: 'chanceCards', icon: '🍀', name: 'Искатель удачи', text: 'вытянул {n} «Шанс»', forms: ['карту', 'карты', 'карт'] },
  { key: 'minigameWins', icon: '🎮', name: 'Чемпион мини-игр', text: 'победил в {n}', forms: ['мини-игре', 'мини-играх', 'мини-играх'] },
  { key: 'duelsWon', icon: '⚔️', name: 'Дуэлянт', text: 'выиграл {n}', forms: ['дуэль', 'дуэли', 'дуэлей'] },
  { key: 'trades', icon: '🤝', name: 'Дипломат', text: 'заключил {n}', forms: ['сделку', 'сделки', 'сделок'] },
  { key: 'taxesPaid', icon: '🧾', name: 'Честный налогоплательщик', text: 'отдал {n} налогов', forms: ['монету', 'монеты', 'монет'] },
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
      if ((stats[p.seat]?.[t.key] ?? 0) === best) res.push({ seat: p.seat, title: t, value: best, text: t.text.replace('{n}', `${best} ${plural(best, t.forms)}`) });
    }
  }
  return res;
}
