// World events: one is drawn at the start of every round from round 2 and lasts that round.
// Texts are own; numbers here are rule data (see docs/RULES_V1.md).
export type WorldEventKind = 'tourism' | 'storm' | 'sale' | 'festival' | 'taxHoliday' | 'crisis' | 'buildBoom' | 'lottery' | 'calm';

export interface WorldEventDef {
  kind: WorldEventKind;
  title: string;
  /** `{country}` is replaced by the country of a «tourism» event. */
  text: string;
  icon: string;
  weight: number;
}

export const WORLD_EVENTS: readonly WorldEventDef[] = [
  { kind: 'tourism', title: 'Сезон туризма', text: 'Все едут в страну «{country}»: аренда там ×2 весь раунд.', icon: '🧳', weight: 3 },
  { kind: 'storm', title: 'Шторм', text: 'Аэропорты закрыты: аренду за аэропорты в этом раунде не платят.', icon: '🌪️', weight: 2 },
  { kind: 'sale', title: 'Распродажа', text: 'Свободные объекты в этом раунде продаются на 25% дешевле.', icon: '🏷️', weight: 2 },
  { kind: 'festival', title: 'Фестиваль', text: 'За проход «Старта» в этом раунде — двойная зарплата.', icon: '🎉', weight: 2 },
  { kind: 'taxHoliday', title: 'Налоговые каникулы', text: 'Налоговые клетки в этом раунде ничего не стоят.', icon: '🏖️', weight: 1 },
  { kind: 'crisis', title: 'Кризис', text: 'Туристов мало: вся аренда в этом раунде вдвое меньше.', icon: '📉', weight: 2 },
  { kind: 'buildBoom', title: 'Строительный бум', text: 'Улучшения в этом раунде стоят вдвое дешевле.', icon: '🏗️', weight: 2 },
  { kind: 'lottery', title: 'Лотерея', text: 'Каждый живой игрок получает 50 монет.', icon: '🎟️', weight: 1 },
  { kind: 'calm', title: 'Спокойный день', text: 'Ничего особенного. Самое время договориться о сделке.', icon: '☕', weight: 2 },
];

export const WORLD_EVENT_NUMBERS = {
  tourismMultiplier: 2,
  saleRate: 0.75,
  festivalMultiplier: 2,
  crisisRate: 0.5,
  buildBoomRate: 0.5,
  lotteryAmount: 50,
} as const;
