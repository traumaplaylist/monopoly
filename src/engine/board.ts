// Поле «Орбитального капитала»: 40 клеток, тема — колонизация Солнечной системы.
import type { GroupDef, GroupId, TileDef } from './types';

export const BOARD_SIZE = 40;
export const JAIL_INDEX = 10;
export const GO_TO_JAIL_INDEX = 30;

export const GROUPS: Record<GroupId, GroupDef> = {
  brown: { id: 'brown', name: 'Лунные окраины', color: '#9c6b4e', tiles: [1, 3] },
  ice: { id: 'ice', name: 'Ледяные колонии', color: '#7fd3f0', tiles: [6, 8, 9] },
  mars: { id: 'mars', name: 'Марсианские каньоны', color: '#e0609e', tiles: [11, 13, 14] },
  belt: { id: 'belt', name: 'Пояс астероидов', color: '#f29a38', tiles: [16, 18, 19] },
  venus: { id: 'venus', name: 'Облака Венеры', color: '#e2483d', tiles: [21, 23, 24] },
  jupiter: { id: 'jupiter', name: 'Спутники Юпитера', color: '#f1d43a', tiles: [26, 27, 29] },
  saturn: { id: 'saturn', name: 'Кольца Сатурна', color: '#3fae5a', tiles: [31, 32, 34] },
  rim: { id: 'rim', name: 'Дальний рубеж', color: '#3b5fd1', tiles: [37, 39] },
};

export const GROUP_ORDER: GroupId[] = ['brown', 'ice', 'mars', 'belt', 'venus', 'jupiter', 'saturn', 'rim'];

const P = (index: number, name: string, group: GroupId, price: number, houseCost: number, rent: number[]): TileDef => ({
  index,
  kind: 'property',
  name,
  group,
  price,
  houseCost,
  rent,
});

export const TRANSPORT_TILES = [5, 15, 25, 35] as const;
export const UTILITY_TILES = [12, 28] as const;

export const TILES: readonly TileDef[] = [
  { index: 0, kind: 'start', name: 'Старт' },
  P(1, 'Пыльный кратер', 'brown', 60, 50, [2, 10, 30, 90, 160, 250]),
  { index: 2, kind: 'card', name: 'Совет колонии', deck: 'council' },
  P(3, 'Реголитовый двор', 'brown', 60, 50, [4, 20, 60, 180, 320, 450]),
  { index: 4, kind: 'tax', name: 'Налог на кислород', tax: 200 },
  { index: 5, kind: 'transport', name: 'Орбитальный лифт', price: 200 },
  P(6, 'Ледник Сольвейг', 'ice', 100, 50, [6, 30, 90, 270, 400, 550]),
  { index: 7, kind: 'card', name: 'Сигнал', deck: 'signal' },
  P(8, 'Криогенный порт', 'ice', 100, 50, [6, 30, 90, 270, 400, 550]),
  P(9, 'Аврора-Сити', 'ice', 120, 50, [8, 40, 100, 300, 450, 600]),
  { index: 10, kind: 'jail', name: 'Карантин' },
  P(11, 'Ржавый каньон', 'mars', 140, 100, [10, 50, 150, 450, 625, 750]),
  { index: 12, kind: 'utility', name: 'Солнечная ферма', price: 150 },
  P(13, 'Красная терраса', 'mars', 140, 100, [10, 50, 150, 450, 625, 750]),
  P(14, 'Купол Ареса', 'mars', 160, 100, [12, 60, 180, 500, 700, 900]),
  { index: 15, kind: 'transport', name: 'Космодром «Фобос»', price: 200 },
  P(16, 'Рудный узел', 'belt', 180, 100, [14, 70, 200, 550, 750, 950]),
  { index: 17, kind: 'card', name: 'Совет колонии', deck: 'council' },
  P(18, 'Обломок-7', 'belt', 180, 100, [14, 70, 200, 550, 750, 950]),
  P(19, 'Цитадель Паллады', 'belt', 200, 100, [16, 80, 220, 600, 800, 1000]),
  { index: 20, kind: 'rest', name: 'Дрейф' },
  P(21, 'Облачный рынок', 'venus', 220, 150, [18, 90, 250, 700, 875, 1050]),
  { index: 22, kind: 'card', name: 'Сигнал', deck: 'signal' },
  P(23, 'Сернистая гавань', 'venus', 220, 150, [18, 90, 250, 700, 875, 1050]),
  P(24, 'Небесный бульвар', 'venus', 240, 150, [20, 100, 300, 750, 925, 1100]),
  { index: 25, kind: 'transport', name: 'Станция «Церера»', price: 200 },
  P(26, 'Ледовая Европа', 'jupiter', 260, 150, [22, 110, 330, 800, 975, 1150]),
  P(27, 'Вулканы Ио', 'jupiter', 260, 150, [22, 110, 330, 800, 975, 1150]),
  { index: 28, kind: 'utility', name: 'Водный конденсатор', price: 150 },
  P(29, 'Ганимед-Центр', 'jupiter', 280, 150, [24, 120, 360, 850, 1025, 1200]),
  { index: 30, kind: 'goToJail', name: 'Санконтроль' },
  P(31, 'Кольцевой порт', 'saturn', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  P(32, 'Титановая верфь', 'saturn', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  { index: 33, kind: 'card', name: 'Совет колонии', deck: 'council' },
  P(34, 'Сады Энцелада', 'saturn', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
  { index: 35, kind: 'transport', name: 'Гиперпортал «Рубеж»', price: 200 },
  { index: 36, kind: 'card', name: 'Сигнал', deck: 'signal' },
  P(37, 'Тритон-Резиденс', 'rim', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
  { index: 38, kind: 'tax', name: 'Сбор за терраформинг', tax: 100 },
  P(39, 'Корона Плутона', 'rim', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
];

export const TRANSPORT_RENT = [0, 25, 50, 100, 200] as const;
export const UTILITY_MULTIPLIER = [0, 4, 10] as const;

export function tile(index: number): TileDef {
  const t = TILES[index];
  if (!t) throw new Error(`Нет клетки ${index}`);
  return t;
}

export function isOwnable(index: number): boolean {
  const k = tile(index).kind;
  return k === 'property' || k === 'transport' || k === 'utility';
}

export function mortgageValue(index: number): number {
  return Math.floor((tile(index).price ?? 0) / 2);
}

/** Стоимость выкупа из залога: залоговая сумма + 10%. */
export function unmortgageCost(index: number): number {
  return Math.ceil(mortgageValue(index) * 1.1);
}
