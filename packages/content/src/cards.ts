// Chance deck. Effects are data; the engine interprets them.
export type ItemKind = 'shield' | 'discount' | 'cone';

export type ChanceEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'moveTo'; index: number }
  | { kind: 'moveBy'; steps: number }
  | { kind: 'item'; item: ItemKind }
  | { kind: 'repairs'; perLevel: number };

export interface ChanceCard {
  id: string;
  title: string;
  text: string;
  effect: ChanceEffect;
}

export const CHANCE_CARDS: readonly ChanceCard[] = [
  { id: 'grant', title: 'Городской грант', text: 'Мэрия поддержала ваш бизнес: +100.', effect: { kind: 'money', amount: 100 } },
  { id: 'tips', title: 'Щедрые чаевые', text: 'Посетители довольны: +50.', effect: { kind: 'money', amount: 50 } },
  { id: 'fine', title: 'Штраф за парковку', text: 'Заплатите банку 50.', effect: { kind: 'money', amount: -50 } },
  { id: 'pipes', title: 'Прорвало трубы', text: 'Срочный ремонт: заплатите 80.', effect: { kind: 'money', amount: -80 } },
  {
    id: 'taxi',
    title: 'Такси до старта',
    text: 'Отправляйтесь на «Старт» и получите зарплату.',
    effect: { kind: 'moveTo', index: 0 },
  },
  { id: 'shortcut', title: 'Короткий путь', text: 'Пройдите вперёд на 3 клетки.', effect: { kind: 'moveBy', steps: 3 } },
  { id: 'detour', title: 'Объезд', text: 'Вернитесь на 2 клетки назад.', effect: { kind: 'moveBy', steps: -2 } },
  {
    id: 'repairs',
    title: 'Капремонт',
    text: 'Заплатите 25 за каждый уровень улучшений.',
    effect: { kind: 'repairs', perLevel: 25 },
  },
  { id: 'item-shield', title: 'Страховой полис', text: 'Получите щит.', effect: { kind: 'item', item: 'shield' } },
  { id: 'item-discount', title: 'Купон', text: 'Получите скидку на аренду.', effect: { kind: 'item', item: 'discount' } },
  { id: 'item-cone', title: 'Дорожный конус', text: 'Получите конус-ловушку.', effect: { kind: 'item', item: 'cone' } },
  {
    id: 'item-discount-2',
    title: 'Клубная карта',
    text: 'Получите скидку на аренду.',
    effect: { kind: 'item', item: 'discount' },
  },
];

export const ITEM_INFO: Record<ItemKind, { name: string; description: string }> = {
  shield: {
    name: 'Щит',
    description: 'Автоматически отражает следующую ловушку или проделку против вас. Аренду и налоги не отменяет.',
  },
  discount: { name: 'Скидка', description: 'Перед оплатой аренды можно уменьшить её на 50%.' },
  cone: { name: 'Конус', description: 'Поставьте на обычную клетку: следующий соперник, вставший на неё, платит банку 30.' },
};
