// Extra boards. Every map is a «reskin» of «Вокруг света»: the same 40 tile kinds, groups, prices,
// rents and corners (the economy and its balance tests stay valid), with its own names, icons,
// facts, words (airport → station → spaceport) and look. The match stores only `settings.mapId`.
import { RULESET } from './ruleset';
import { CORNERS, GROUP_ORDER, GROUPS, WORLD } from './map';
import type { GroupId, MapDef, MapTheme, MapVocab, TileDef } from './map';

interface Place {
  id: string;
  name: string;
  short: string;
  visual: string;
  fact: string;
}

interface Skin {
  id: string;
  name: string;
  tagline: string;
  groups: Record<GroupId, string>;
  /** Property tiles by index (all 28 must be present). */
  places: Record<number, Place>;
  /** Optional renames of special tiles: index → [name, shortLabel, visual?, description?]. */
  specials?: Record<number, readonly [string, string, string?, string?]>;
  vocab: MapVocab;
  theme: MapTheme;
  cards?: Record<string, readonly [string, string]>;
}

function reskin(skin: Skin): MapDef {
  const groups = Object.fromEntries(GROUP_ORDER.map((g) => [g, { name: skin.groups[g], color: GROUPS[g].color }])) as MapDef['groups'];
  const tiles: TileDef[] = WORLD.tiles.map((t) => {
    if (t.kind === 'property') {
      const p = skin.places[t.index];
      if (!p) throw new Error(`map ${skin.id}: no place for tile ${t.index}`);
      const rent =
        t.group === 'air'
          ? `Аренда растёт с числом объектов «${skin.vocab.hubs}» у владельца: ${RULESET.airportRent.join(' / ')}. Не улучшается.`
          : `Аренда: 2 из 3 мест группы «${skin.groups[t.group!]}» — ×1,5, все 3 — ×2.`;
      return { ...t, id: p.id, name: p.name, shortLabel: p.short, visual: p.visual, description: `${p.fact} ${rent}` };
    }
    const sp = skin.specials?.[t.index];
    if (!sp) return t;
    const [name, shortLabel, visual, description] = sp;
    return { ...t, id: `${skin.id}-${t.id}`, name, shortLabel, visual: visual ?? t.visual, description: description ?? t.description };
  });
  return { id: skin.id, name: skin.name, tagline: skin.tagline, tiles, corners: CORNERS, groups, vocab: skin.vocab, theme: skin.theme, cards: skin.cards };
}

const P = (id: string, name: string, short: string, visual: string, fact: string): Place => ({ id, name, short, visual, fact });

// ------------------------------------------------------------------ «По России»

export const RUSSIA: MapDef = reskin({
  id: 'russia',
  name: 'По России',
  tagline: '8 регионов, от Калининграда до Камчатки, и 4 вокзала',
  groups: {
    egypt: 'Урал', india: 'Сибирь', mexico: 'Поволжье', turkey: 'Юг', air: 'Вокзалы',
    spain: 'Дальний Восток', italy: 'Золотое кольцо', france: 'Север', japan: 'Две столицы',
  },
  places: {
    1: P('perm', 'Пермь', 'Пермь', 'bear', 'Пермский медведь на гербе и одна из самых длинных набережных страны.'),
    3: P('chelyabinsk', 'Челябинск', 'Челябинск', 'comet', 'В 2013 году над городом взорвался метеорит — его обломок теперь в музее.'),
    5: P('yekaterinburg', 'Екатеринбург', 'Екб', 'gem', 'Столица Урала на границе Европы и Азии; уральские самоцветы.'),
    6: P('st-kursky', 'Курский вокзал', 'Вокзал', 'train', 'Поезда на юг: Крым, Кавказ и Чёрное море.'),
    7: P('tomsk', 'Томск', 'Томск', 'books', 'Студенческая столица Сибири с деревянным кружевом домов.'),
    8: P('krasnoyarsk', 'Красноярск', 'Красноярск', 'spruce', 'Енисей, тайга и скалы заповедника «Столбы».'),
    9: P('baikal', 'Байкал', 'Байкал', 'seal', 'Самое глубокое озеро планеты; здесь живёт байкальская нерпа.'),
    11: P('samara', 'Самара', 'Самара', 'rocket', 'Здесь собирают ракеты «Союз»; ракета-памятник стоит прямо в городе.'),
    13: P('nizhny', 'Нижний Новгород', 'Нижний', 'castle', 'Кремль на слиянии Оки и Волги и самая длинная лестница — Чкаловская.'),
    14: P('kazan', 'Казань', 'Казань', 'mosque', 'Кремль, мечеть Кул-Шариф и чак-чак — третья столица России.'),
    15: P('st-kazansky', 'Казанский вокзал', 'Вокзал', 'train', 'Самый большой вокзал Москвы: поезда на восток и юго-восток.'),
    16: P('anapa', 'Анапа', 'Анапа', 'umbrella', 'Детский курорт с песчаными пляжами Чёрного моря.'),
    18: P('krasnodar', 'Краснодар', 'Краснодар', 'sunflower', 'Кубань: подсолнухи до горизонта и знаменитый парк «Галицкого».'),
    19: P('sochi', 'Сочи', 'Сочи', 'mountain', 'Море и горнолыжная Красная Поляна в часе езды друг от друга.'),
    21: P('khabarovsk', 'Хабаровск', 'Хабаровск', 'tiger', 'Город на Амуре; в окрестной тайге живёт амурский тигр.'),
    23: P('kamchatka', 'Камчатка', 'Камчатка', 'volcano', 'Край вулканов и гейзеров: их здесь больше трёхсот.'),
    24: P('vladivostok', 'Владивосток', 'Владик', 'anchor', 'Порт на Тихом океане и конечная Транссиба — 9288 км от Москвы.'),
    25: P('st-leningradsky', 'Ленинградский вокзал', 'Вокзал', 'train', 'Самый старый вокзал Москвы: «Сапсаны» в Петербург.'),
    26: P('suzdal', 'Суздаль', 'Суздаль', 'bell', 'Город-музей: больше пятидесяти храмов и колокольный звон.'),
    27: P('sergiev-posad', 'Сергиев Посад', 'Посад', 'dolls', 'Здесь сделали первую русскую матрёшку.'),
    29: P('yaroslavl', 'Ярославль', 'Ярославль', 'church', 'Старейший город на Волге; центр — под охраной ЮНЕСКО.'),
    31: P('kizhi', 'Кижи', 'Кижи', 'wood', 'Деревянная церковь с 22 главами, построенная без единого гвоздя.'),
    33: P('murmansk', 'Мурманск', 'Мурманск', 'snowflake', 'Крупнейший город за Полярным кругом: полярная ночь и полярный день.'),
    34: P('teriberka', 'Териберка', 'Териберка', 'whale', 'Посёлок на Баренцевом море: киты, северное сияние и край земли.'),
    35: P('st-yaroslavsky', 'Ярославский вокзал', 'Вокзал', 'train', 'Отсюда начинается Транссиб — самая длинная железная дорога мира.'),
    36: P('peterhof', 'Петергоф', 'Петергоф', 'fountain', 'Столица фонтанов: больше 150 фонтанов работают без единого насоса.'),
    38: P('spb', 'Санкт-Петербург', 'Питер', 'bridge', 'Белые ночи и разводные мосты над Невой.'),
    39: P('moscow', 'Москва', 'Москва', 'tower', 'Столица: Кремль, Красная площадь и небоскрёбы Сити.'),
  },
  specials: {
    4: ['Курортный сбор', 'Сбор', undefined, 'Заплатите банку 100 монет.'],
  },
  vocab: {
    hub: 'Вокзал',
    hubs: 'Вокзалы',
    hubGen: 'вокзала',
    hubAcc: 'вокзал',
    hubCount: ['1 вокзал', '2 вокзала', '3 вокзала', '4 вокзала'],
    setRows: ['Одно место', '2 места из 3', 'Весь регион'],
    rentHint: '2 из 3 мест ×1,5, весь регион ×2',
    setTo: (n) => `в регион «${n}»`,
  },
  theme: { bg: ['#2f5a6e', '#20414f', '#132a35'], paper: 'taiga', decor: 'spruce' },
  cards: {
    'to-paris': ['Северное сияние', 'Езжайте в Териберку смотреть на сияние. Если пройдёте «Старт» — получите зарплату.'],
  },
});

// ------------------------------------------------------------------ «Космос»

export const SPACE: MapDef = reskin({
  id: 'space',
  name: 'Космос',
  tagline: 'Луна, Марс, кольца Сатурна и чёрная дыра; 4 космопорта',
  groups: {
    egypt: 'Луна', india: 'Марс', mexico: 'Венера', turkey: 'Пояс астероидов', air: 'Космопорты',
    spain: 'Юпитер', italy: 'Сатурн', france: 'Туманности', japan: 'Галактика',
  },
  places: {
    1: P('crater', 'Кратер Тихо', 'Кратер', 'newmoon', 'Самый заметный кратер Луны: лучи от него видны даже в бинокль.'),
    3: P('moonbase', 'Лунная база', 'Лунобаза', 'astronaut', 'Первый посёлок на Луне: теплицы, ангар и вид на Землю.'),
    5: P('lunokhod', 'Луноход', 'Луноход', 'satellite', 'Первый в мире планетоход «Луноход-1» проехал по Луне 10 км в 1970 году.'),
    6: P('port-alpha', 'Космопорт «Альфа»', 'Космопорт', 'rocket', 'Стартовый стол для рейсов к внутренним планетам.'),
    7: P('olympus', 'Гора Олимп', 'Олимп', 'volcano', 'Самый высокий вулкан Солнечной системы: почти 22 км.'),
    8: P('rover', 'Марсоход', 'Марсоход', 'robot', 'Марсоходы катаются по Марсу с 1997 года и ищут следы воды.'),
    9: P('mariner', 'Долина Маринер', 'Долина', 'desert', 'Каньон длиной с Россию с запада на восток — 4000 км.'),
    11: P('clouds', 'Облака Венеры', 'Облака', 'cloud', 'Венеру целиком закрывают облака серной кислоты.'),
    13: P('acid-rain', 'Кислотные ливни', 'Ливни', 'rain', 'Дождь здесь испаряется, не долетев до поверхности.'),
    14: P('heat', 'Вечная жара', 'Жара', 'fire', 'Самая горячая планета: +460 °C, горячее Меркурия.'),
    15: P('port-beta', 'Космопорт «Бета»', 'Космопорт', 'rocket', 'Грузовые рейсы к поясу астероидов.'),
    16: P('mine', 'Шахта', 'Шахта', 'pick', 'Астероиды богаты металлами: одна глыба может стоить больше всей Земли.'),
    18: P('ceres', 'Церера', 'Церера', 'rock', 'Карликовая планета — самое крупное тело пояса астероидов.'),
    19: P('comet', 'Комета', 'Комета', 'comet', 'Ледяная гостья: хвост кометы всегда смотрит от Солнца.'),
    21: P('red-spot', 'Большое пятно', 'Пятно', 'cyclone', 'Шторм на Юпитере, который бушует уже 350 лет; в нём поместится Земля.'),
    23: P('io', 'Ио', 'Ио', 'bolt', 'Самый вулканически активный мир Солнечной системы.'),
    24: P('europa', 'Европа', 'Европа', 'ice', 'Под ледяной коркой — океан, где может быть жизнь.'),
    25: P('port-gamma', 'Космопорт «Гамма»', 'Космопорт', 'rocket', 'Пересадка на рейсы к газовым гигантам.'),
    26: P('titan', 'Титан', 'Титан', 'fog', 'Единственный спутник с плотной атмосферой и метановыми озёрами.'),
    27: P('enceladus', 'Энцелад', 'Энцелад', 'droplet', 'Из трещин во льду бьют гейзеры воды прямо в космос.'),
    29: P('rings', 'Кольца Сатурна', 'Кольца', 'saturn', 'Кольца шириной 280 000 км, а толщиной — меньше километра.'),
    31: P('orion', 'Туманность Ориона', 'Орион', 'sparkles', 'Звёздные ясли: здесь прямо сейчас рождаются звёзды.'),
    33: P('pulsar', 'Пульсар', 'Пульсар', 'dizzy', 'Остаток звезды, который вращается сотни раз в секунду.'),
    34: P('black-hole', 'Чёрная дыра', 'Ч. дыра', 'hole', 'Отсюда не вырывается даже свет. Аренду всё равно платить.'),
    35: P('port-delta', 'Космопорт «Дельта»', 'Космопорт', 'rocket', 'Последний порт перед межзвёздным прыжком.'),
    36: P('andromeda', 'Андромеда', 'Андромеда', 'galaxy', 'Соседняя галактика; через 4 млрд лет она столкнётся с нашей.'),
    38: P('centauri', 'Альфа Центавра', 'Центавр', 'star', 'Ближайшая к Солнцу звёздная система — всего 4,4 световых года.'),
    39: P('edge', 'Край Вселенной', 'Край', 'telescope', 'Дальше телескопы пока не видят. Самый дорогой адрес в игре.'),
  },
  specials: {
    4: ['Топливный сбор', 'Сбор', undefined, 'Заплатите банку 100 монет.'],
    37: ['Налог на звёзды', 'Налог', undefined, 'Заплатите банку 150 монет.'],
    30: ['Стоянка НЛО', 'НЛО', 'ufo', 'Безопасная клетка, ничего не происходит.'],
  },
  vocab: {
    hub: 'Космопорт',
    hubs: 'Космопорты',
    hubGen: 'космопорта',
    hubAcc: 'космопорт',
    hubCount: ['1 космопорт', '2 космопорта', '3 космопорта', '4 космопорта'],
    setRows: ['Одно место', '2 места из 3', 'Вся группа'],
    rentHint: '2 из 3 мест ×1,5, вся группа ×2',
    setTo: (n) => `на «${n}»`,
  },
  theme: { bg: ['#2b2f6e', '#171a45', '#0a0b22'], paper: 'space', decor: 'asteroids' },
  cards: {
    'to-paris': ['Гравитационный манёвр', 'Летите к «Чёрной дыре». Если пройдёте «Старт» — получите зарплату.'],
  },
});

/** All boards, in lobby order. */
export const MAPS: readonly MapDef[] = [WORLD, RUSSIA, SPACE];
export const MAP_IDS = MAPS.map((m) => m.id) as unknown as readonly [string, ...string[]];

/** Board by id (unknown ids fall back to «Вокруг света»). */
export function getMap(id: string | undefined | null): MapDef {
  return MAPS.find((m) => m.id === id) ?? WORLD;
}

/** Fills theme words into shared texts: {hub} {hubs} {Hub} {Hubs} {hubGen} {hubAcc}. */
export function mapText(text: string, map: MapDef): string {
  const v = map.vocab;
  return text
    .replace(/\{Hubs\}/g, v.hubs)
    .replace(/\{hubs\}/g, v.hubs.toLowerCase())
    .replace(/\{Hub\}/g, v.hub)
    .replace(/\{hub\}/g, v.hub.toLowerCase())
    .replace(/\{hubGen\}/g, v.hubGen)
    .replace(/\{hubAcc\}/g, v.hubAcc);
}
