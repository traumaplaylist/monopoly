// Map «Вокруг света»: 40 tiles, corners at 0/10/20/30, nine tiles per side. Index order is canonical
// on every client; layouts only change coordinates. Groups are countries (3 cities each) plus four
// airports (one per side). City names are public geography; no tile list is copied from any game.

import { RULESET } from './ruleset';

export type TileKind = 'start' | 'auction' | 'pause' | 'parking' | 'property' | 'chance' | 'tax' | 'minigame' | 'duel';

export type GroupId = 'egypt' | 'india' | 'mexico' | 'turkey' | 'air' | 'spain' | 'italy' | 'france' | 'japan';

export interface GroupDef {
  id: GroupId;
  name: string;
  color: string;
  /** Cost of one upgrade level for every tile of the group. */
  upgradeCost: number;
}

export interface TileDef {
  id: string;
  index: number;
  kind: TileKind;
  name: string;
  shortLabel: string;
  description: string;
  /** Visual key for icons/models (renderer only). */
  visual: string;
  group?: GroupId;
  price?: number;
  baseRent?: number;
  tax?: number;
}

export const GROUPS: Record<GroupId, GroupDef> = {
  egypt: { id: 'egypt', name: 'Египет', color: '#ff8a1f', upgradeCost: 50 },
  india: { id: 'india', name: 'Индия', color: '#f23d5c', upgradeCost: 50 },
  mexico: { id: 'mexico', name: 'Мексика', color: '#13b5a6', upgradeCost: 100 },
  turkey: { id: 'turkey', name: 'Турция', color: '#ffc21a', upgradeCost: 100 },
  air: { id: 'air', name: 'Аэропорты', color: '#5b6b8c', upgradeCost: 100 },
  spain: { id: 'spain', name: 'Испания', color: '#8b55e6', upgradeCost: 150 },
  italy: { id: 'italy', name: 'Италия', color: '#58c22c', upgradeCost: 150 },
  france: { id: 'france', name: 'Франция', color: '#2f7ff0', upgradeCost: 200 },
  japan: { id: 'japan', name: 'Япония', color: '#ff4fa8', upgradeCost: 200 },
};

export const GROUP_ORDER: GroupId[] = ['egypt', 'india', 'mexico', 'turkey', 'air', 'spain', 'italy', 'france', 'japan'];


/** Short travel facts shown on the tile sheet. */
export const CITY_FACTS: Record<string, string> = {
  'cairo': 'Столица Египта и крупнейший город арабского мира; пирамиды Гизы — на окраине.',
  'luxor': 'Город-музей на месте древних Фив: Карнакский храм и Долина царей.',
  'hurghada': 'Курорт на Красном море, известный коралловыми рифами и дайвингом.',
  'goa': 'Самый маленький штат Индии: пляжи, пальмы и португальские церкви.',
  'delhi': 'Столица Индии; в Старом Дели — шумные базары и Красный форт.',
  'mumbai': 'Финансовая столица Индии и родина Болливуда.',
  'cancun': 'Курорт на Карибском море с бирюзовой водой и белым песком.',
  'tulum': 'Руины города майя прямо на берегу океана.',
  'mexico-city': 'Один из самых больших городов мира, построен на месте ацтекской столицы.',
  'antalya': 'Турецкая Ривьера: море, горы и старый город Калеичи.',
  'izmir': 'Третий по величине город Турции и большой порт на Эгейском море.',
  'istanbul': 'Город на двух континентах — Европе и Азии — по берегам Босфора.',
  'valencia': 'Родина паэльи и апельсиновых садов.',
  'seville': 'Столица фламенко и самый жаркий большой город Испании.',
  'barcelona': 'Город Гауди: Саграда Фамилия строится уже больше века.',
  'naples': 'Здесь придумали пиццу «Маргарита»; рядом — вулкан Везувий.',
  'milan': 'Столица моды и дизайна; знаменитый готический собор Дуомо.',
  'rome': '«Вечный город»: Колизей, Форум и фонтан Треви.',
  'nice': 'Жемчужина Лазурного берега с Английской набережной.',
  'lyon': 'Гастрономическая столица Франции и город шёлка.',
  'paris': 'Город света: Эйфелева башня, Лувр и круассаны на завтрак.',
  'osaka': '«Кухня Японии»: уличная еда, такояки и окономияки.',
  'kyoto': 'Древняя столица Японии: храмы, сады и цветение сакуры.',
  'tokyo': 'Самая населённая агломерация мира; символ — телебашня и неон Синдзюку.',
};

const prop = (
  index: number,
  id: string,
  name: string,
  shortLabel: string,
  group: GroupId,
  price: number,
  baseRent: number,
  visual: string,
): TileDef => ({
  id,
  index,
  kind: 'property',
  name,
  shortLabel,
  group,
  price,
  baseRent,
  visual,
  description:
    (CITY_FACTS[id] ? `${CITY_FACTS[id]} ` : '') +
    (group === 'air'
      ? `Аренда растёт с числом аэропортов у владельца: ${RULESET.airportRent.join(' / ')}. Не улучшается.`
      : `Аренда: 2 города страны «${GROUPS[group].name}» — ×1,5, все 3 — ×2.`),
});

const special = (index: number, id: string, kind: TileKind, name: string, shortLabel: string, visual: string, description: string, tax?: number): TileDef =>
  tax ? { id, index, kind, name, shortLabel, visual, description, tax } : { id, index, kind, name, shortLabel, visual, description };

const CHANCE = 'Возьмите карту «Шанс».';
const MINIGAME = 'Ставит общую мини-игру на ближайшую границу раунда.';

export const WORLD_TILES: readonly TileDef[] = [
  special(0, 'start', 'start', 'Старт', 'Старт', 'flag', `+${RULESET.startSalary} монет за каждое прохождение или попадание.`),
  // --- side 1: Египет, аэропорт, Индия
  prop(1, 'cairo', 'Каир', 'Каир', 'egypt', 100, 20, 'pyramid'),
  special(2, 'chance-1', 'chance', 'Шанс', 'Шанс', 'question', CHANCE),
  prop(3, 'luxor', 'Луксор', 'Луксор', 'egypt', 100, 20, 'columns'),
  special(4, 'tax-tourist', 'tax', 'Туристический сбор', 'Сбор', 'receipt', 'Заплатите банку 100 монет.', 100),
  prop(5, 'hurghada', 'Хургада', 'Хургада', 'egypt', 120, 24, 'fish'),
  prop(6, 'air-south', 'Аэропорт «Юг»', 'Аэропорт', 'air', 200, 25, 'plane'),
  prop(7, 'goa', 'Гоа', 'Гоа', 'india', 140, 28, 'palm'),
  prop(8, 'delhi', 'Дели', 'Дели', 'india', 140, 28, 'landmark'),
  prop(9, 'mumbai', 'Мумбаи', 'Мумбаи', 'india', 160, 32, 'film'),
  special(10, 'auction', 'auction', 'Аукцион', 'Аукцион', 'gavel', 'Торги за случайный свободный объект.'),
  // --- side 2: Мексика, аэропорт, Турция
  prop(11, 'cancun', 'Канкун', 'Канкун', 'mexico', 180, 36, 'sun'),
  special(12, 'minigame-1', 'minigame', 'Мини-игра', 'Мини-игра', 'gamepad', MINIGAME),
  prop(13, 'tulum', 'Тулум', 'Тулум', 'mexico', 180, 36, 'cactus'),
  prop(14, 'mexico-city', 'Мехико', 'Мехико', 'mexico', 200, 40, 'guitar'),
  prop(15, 'air-east', 'Аэропорт «Восток»', 'Аэропорт', 'air', 200, 25, 'plane'),
  prop(16, 'antalya', 'Анталья', 'Анталья', 'turkey', 220, 44, 'umbrella'),
  special(17, 'chance-2', 'chance', 'Шанс', 'Шанс', 'question', CHANCE),
  prop(18, 'izmir', 'Измир', 'Измир', 'turkey', 220, 44, 'ship'),
  prop(19, 'istanbul', 'Стамбул', 'Стамбул', 'turkey', 240, 48, 'moon'),
  special(20, 'pause', 'pause', 'Пауза', 'Пауза', 'coffee', 'Безопасная клетка, ничего не происходит.'),
  // --- side 3: Испания, аэропорт, Италия
  prop(21, 'valencia', 'Валенсия', 'Валенсия', 'spain', 260, 52, 'citrus'),
  special(22, 'duel', 'duel', 'Дуэль', 'Дуэль', 'swords', 'Можно бросить вызов за объект соперника (тратит жетон вызова).'),
  prop(23, 'seville', 'Севилья', 'Севилья', 'spain', 260, 52, 'music'),
  prop(24, 'barcelona', 'Барселона', 'Барселона', 'spain', 280, 56, 'ferris'),
  prop(25, 'air-north', 'Аэропорт «Север»', 'Аэропорт', 'air', 200, 25, 'plane'),
  prop(26, 'naples', 'Неаполь', 'Неаполь', 'italy', 300, 60, 'pizza'),
  prop(27, 'milan', 'Милан', 'Милан', 'italy', 300, 60, 'shirt'),
  special(28, 'minigame-2', 'minigame', 'Мини-игра', 'Мини-игра', 'gamepad', MINIGAME),
  prop(29, 'rome', 'Рим', 'Рим', 'italy', 320, 64, 'columns'),
  special(30, 'parking', 'parking', 'Парковка', 'Парковка', 'car', 'Безопасная клетка, ничего не происходит.'),
  // --- side 4: Франция, аэропорт, Япония
  prop(31, 'nice', 'Ницца', 'Ницца', 'france', 340, 68, 'sailboat'),
  special(32, 'chance-3', 'chance', 'Шанс', 'Шанс', 'question', CHANCE),
  prop(33, 'lyon', 'Лион', 'Лион', 'france', 340, 68, 'wine'),
  prop(34, 'paris', 'Париж', 'Париж', 'france', 360, 72, 'bread'),
  prop(35, 'air-west', 'Аэропорт «Запад»', 'Аэропорт', 'air', 200, 25, 'plane'),
  prop(36, 'osaka', 'Осака', 'Осака', 'japan', 380, 76, 'utensils'),
  special(37, 'tax-lux', 'tax', 'Налог на роскошь', 'Налог', 'receipt', 'Заплатите банку 150 монет.', 150),
  prop(38, 'kyoto', 'Киото', 'Киото', 'japan', 380, 76, 'sakura'),
  prop(39, 'tokyo', 'Токио', 'Токио', 'japan', 400, 80, 'tower'),
];

export interface MapDef {
  id: string;
  name: string;
  tiles: readonly TileDef[];
  corners: readonly number[];
}

export const BOARD_SIZE_TILES = 40;
export const CORNERS = [0, 10, 20, 30] as const;

export const WORLD: MapDef = { id: 'world', name: 'Вокруг света', tiles: WORLD_TILES, corners: CORNERS };

export function groupTiles(map: MapDef, group: GroupId): number[] {
  return map.tiles.filter((t) => t.group === group).map((t) => t.index);
}

/** Expected tiles per group in GROUP_ORDER. */
export const GROUP_SIZES = [3, 3, 3, 3, 4, 3, 3, 3, 3];

/** Validates map invariants; returns a list of problems (empty if valid). */
export function validateMap(map: MapDef): string[] {
  const errors: string[] = [];
  const n = map.tiles.length;
  if (n !== BOARD_SIZE_TILES) errors.push(`expected ${BOARD_SIZE_TILES} tiles, got ${n}`);
  map.tiles.forEach((t, i) => {
    if (t.index !== i) errors.push(`tile ${t.id} has index ${t.index} at position ${i}`);
    if (!t.shortLabel || t.shortLabel.length > 10) errors.push(`tile ${t.id} shortLabel must be 1..10 chars`);
    if (t.kind === 'property') {
      if (!t.group || !GROUPS[t.group]) errors.push(`tile ${t.id} has invalid group`);
      if (!t.price || !t.baseRent) errors.push(`tile ${t.id} lacks price/rent`);
    }
    if (t.kind === 'tax' && !t.tax) errors.push(`tile ${t.id} lacks tax`);
  });
  const ids = new Set(map.tiles.map((t) => t.id));
  if (ids.size !== n) errors.push('tile ids are not unique');
  const cornerKinds = map.corners.map((c) => map.tiles[c]?.kind);
  if (JSON.stringify(map.corners) !== JSON.stringify(CORNERS)) errors.push(`corners must be ${CORNERS.join(',')}`);
  if (JSON.stringify(cornerKinds) !== JSON.stringify(['start', 'auction', 'pause', 'parking']))
    errors.push(`corner kinds wrong: ${cornerKinds}`);
  const sizes = GROUP_ORDER.map((g) => groupTiles(map, g).length);
  if (JSON.stringify(sizes) !== JSON.stringify(GROUP_SIZES)) errors.push(`group sizes ${sizes}`);
  const count = (k: TileKind) => map.tiles.filter((t) => t.kind === k).length;
  if (count('property') !== 28) errors.push('need 28 properties');
  if (count('chance') !== 3 || count('tax') !== 2 || count('minigame') !== 2 || count('duel') !== 1)
    errors.push('special tile counts wrong');
  return errors;
}
