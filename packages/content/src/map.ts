// Map «Мегаполис»: 32 tiles, corners at 0/8/16/24, seven tiles per side. Index order is canonical
// on every client; layouts only change coordinates.

export type TileKind = 'start' | 'auction' | 'pause' | 'parking' | 'property' | 'chance' | 'tax' | 'minigame' | 'duel';

export type GroupId = 'cozy' | 'fun' | 'night' | 'trade' | 'culture' | 'green' | 'port' | 'prestige';

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
  cozy: { id: 'cozy', name: 'Уют', color: '#c8743c', upgradeCost: 50 },
  fun: { id: 'fun', name: 'Досуг', color: '#d9434b', upgradeCost: 50 },
  night: { id: 'night', name: 'Ночная жизнь', color: '#2a9d9a', upgradeCost: 100 },
  trade: { id: 'trade', name: 'Торговля', color: '#e8b931', upgradeCost: 100 },
  culture: { id: 'culture', name: 'Культура', color: '#8a52c9', upgradeCost: 120 },
  green: { id: 'green', name: 'Зелёный квартал', color: '#3f9d4e', upgradeCost: 120 },
  port: { id: 'port', name: 'Транспорт', color: '#3a6fc4', upgradeCost: 150 },
  prestige: { id: 'prestige', name: 'Престиж', color: '#d6487f', upgradeCost: 150 },
};

export const GROUP_ORDER: GroupId[] = ['cozy', 'fun', 'night', 'trade', 'culture', 'green', 'port', 'prestige'];

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
  description: `Объект группы «${GROUPS[group].name}». Владелец получает аренду, полный комплект удваивает её.`,
});

export const MEGAPOLIS_TILES: readonly TileDef[] = [
  {
    id: 'start',
    index: 0,
    kind: 'start',
    name: 'Старт',
    shortLabel: 'Старт',
    visual: 'flag',
    description: '+200 монет за каждое прохождение или попадание.',
  },
  prop(1, 'cafe', 'Кофейня', 'Кафе', 'cozy', 100, 10, 'cup'),
  {
    id: 'chance-1',
    index: 2,
    kind: 'chance',
    name: 'Шанс',
    shortLabel: 'Шанс',
    visual: 'question',
    description: 'Возьмите карту «Шанс».',
  },
  prop(3, 'bakery', 'Пекарня', 'Пекарня', 'cozy', 120, 12, 'bread'),
  {
    id: 'tax-city',
    index: 4,
    kind: 'tax',
    name: 'Городской сбор',
    shortLabel: 'Сбор',
    tax: 100,
    visual: 'receipt',
    description: 'Заплатите банку 100 монет.',
  },
  prop(5, 'arcade', 'Аркада', 'Аркада', 'fun', 140, 14, 'gamepad'),
  {
    id: 'minigame-1',
    index: 6,
    kind: 'minigame',
    name: 'Мини-игра',
    shortLabel: 'Мини-игра',
    visual: 'gamepad',
    description: 'Ставит общую мини-игру на ближайшую границу раунда.',
  },
  prop(7, 'cinema', 'Кинотеатр', 'Кино', 'fun', 160, 16, 'film'),
  {
    id: 'auction',
    index: 8,
    kind: 'auction',
    name: 'Аукцион',
    shortLabel: 'Аукцион',
    visual: 'gavel',
    description: 'Торги за случайный свободный объект.',
  },
  prop(9, 'hotel', 'Отель', 'Отель', 'night', 180, 18, 'bed'),
  prop(10, 'club', 'Клуб', 'Клуб', 'night', 180, 18, 'disco'),
  {
    id: 'chance-2',
    index: 11,
    kind: 'chance',
    name: 'Шанс',
    shortLabel: 'Шанс',
    visual: 'question',
    description: 'Возьмите карту «Шанс».',
  },
  prop(12, 'studio', 'Студия', 'Студия', 'night', 200, 20, 'palette'),
  prop(13, 'market', 'Рынок', 'Рынок', 'trade', 200, 20, 'stall'),
  prop(14, 'pharmacy', 'Аптека', 'Аптека', 'trade', 220, 22, 'cross'),
  prop(15, 'shop', 'Универмаг', 'Магазин', 'trade', 220, 22, 'basket'),
  {
    id: 'pause',
    index: 16,
    kind: 'pause',
    name: 'Пауза',
    shortLabel: 'Пауза',
    visual: 'coffee',
    description: 'Безопасная клетка, ничего не происходит.',
  },
  prop(17, 'museum', 'Музей', 'Музей', 'culture', 240, 24, 'columns'),
  {
    id: 'duel',
    index: 18,
    kind: 'duel',
    name: 'Дуэль',
    shortLabel: 'Дуэль',
    visual: 'swords',
    description: 'Можно бросить вызов за объект соперника (тратит жетон вызова).',
  },
  prop(19, 'gallery', 'Галерея', 'Галерея', 'culture', 240, 24, 'frame'),
  prop(20, 'theatre', 'Театр', 'Театр', 'culture', 260, 26, 'masks'),
  {
    id: 'minigame-2',
    index: 21,
    kind: 'minigame',
    name: 'Мини-игра',
    shortLabel: 'Мини-игра',
    visual: 'gamepad',
    description: 'Ставит общую мини-игру на ближайшую границу раунда.',
  },
  prop(22, 'park', 'Парк', 'Парк', 'green', 260, 26, 'tree'),
  prop(23, 'library', 'Библиотека', 'Книги', 'green', 280, 28, 'book'),
  {
    id: 'parking',
    index: 24,
    kind: 'parking',
    name: 'Парковка',
    shortLabel: 'Парковка',
    visual: 'car',
    description: 'Безопасная клетка, ничего не происходит.',
  },
  prop(25, 'university', 'Университет', 'Универ', 'green', 280, 28, 'cap'),
  {
    id: 'tax-lux',
    index: 26,
    kind: 'tax',
    name: 'Налог на роскошь',
    shortLabel: 'Налог',
    tax: 150,
    visual: 'receipt',
    description: 'Заплатите банку 150 монет.',
  },
  prop(27, 'port', 'Морской порт', 'Порт', 'port', 300, 36, 'anchor'),
  prop(28, 'station', 'Вокзал', 'Вокзал', 'port', 300, 36, 'train'),
  {
    id: 'chance-3',
    index: 29,
    kind: 'chance',
    name: 'Шанс',
    shortLabel: 'Шанс',
    visual: 'question',
    description: 'Возьмите карту «Шанс».',
  },
  prop(30, 'concert', 'Концерт-холл', 'Концерт', 'prestige', 310, 42, 'note'),
  prop(31, 'tower', 'Небоскрёб', 'Небоскрёб', 'prestige', 320, 48, 'tower'),
];

export interface MapDef {
  id: string;
  name: string;
  tiles: readonly TileDef[];
  corners: readonly number[];
}

export const MEGAPOLIS: MapDef = { id: 'megapolis', name: 'Мегаполис', tiles: MEGAPOLIS_TILES, corners: [0, 8, 16, 24] };

export function groupTiles(map: MapDef, group: GroupId): number[] {
  return map.tiles.filter((t) => t.group === group).map((t) => t.index);
}

/** Validates map invariants; returns a list of problems (empty if valid). */
export function validateMap(map: MapDef): string[] {
  const errors: string[] = [];
  const n = map.tiles.length;
  if (n !== 32) errors.push(`expected 32 tiles, got ${n}`);
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
  if (JSON.stringify(map.corners) !== JSON.stringify([0, 8, 16, 24])) errors.push('corners must be 0,8,16,24');
  if (JSON.stringify(cornerKinds) !== JSON.stringify(['start', 'auction', 'pause', 'parking']))
    errors.push(`corner kinds wrong: ${cornerKinds}`);
  const sizes = GROUP_ORDER.map((g) => groupTiles(map, g).length);
  if (JSON.stringify(sizes) !== JSON.stringify([2, 2, 3, 3, 3, 3, 2, 2])) errors.push(`group sizes ${sizes}`);
  const count = (k: TileKind) => map.tiles.filter((t) => t.kind === k).length;
  if (count('property') !== 20) errors.push('need 20 properties');
  if (count('chance') !== 3 || count('tax') !== 2 || count('minigame') !== 2 || count('duel') !== 1)
    errors.push('special tile counts wrong');
  return errors;
}
