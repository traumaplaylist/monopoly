// Chance deck. Effects are data; the engine interprets them.
export type ItemKind = 'shield' | 'discount' | 'cone';

export type ChanceEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'moveTo'; index: number }
  | { kind: 'moveBy'; steps: number }
  | { kind: 'moveToNearest'; group: 'air' }
  | { kind: 'collectEach'; amount: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'item'; item: ItemKind }
  | { kind: 'repairs'; perLevel: number };

export interface ChanceCard {
  id: string;
  title: string;
  text: string;
  effect: ChanceEffect;
}

// Travel-themed deck for «Вокруг света» (own texts). Indices refer to WORLD tiles (checked by tests).
export const CHANCE_CARDS: readonly ChanceCard[] = [
  // --- money in
  { id: 'grant', title: 'Грант на туризм', text: 'Министерство туризма поддержало ваш проект: +100.', effect: { kind: 'money', amount: 100 } },
  { id: 'tips', title: 'Щедрые туристы', text: 'Экскурсия прошла на ура, чаевые: +50.', effect: { kind: 'money', amount: 50 } },
  { id: 'lottery', title: 'Лотерея в самолёте', text: 'Ваш билет выиграл: +150.', effect: { kind: 'money', amount: 150 } },
  { id: 'cashback', title: 'Кэшбэк за мили', text: 'Авиакомпания вернула мили деньгами: +80.', effect: { kind: 'money', amount: 80 } },
  { id: 'blog', title: 'Блог о путешествиях', text: 'Ваш ролик набрал миллион просмотров: +120.', effect: { kind: 'money', amount: 120 } },
  { id: 'souvenir', title: 'Удачные сувениры', text: 'Магниты на холодильник разошлись: +40.', effect: { kind: 'money', amount: 40 } },
  // --- money out
  { id: 'fine', title: 'Штраф за парковку', text: 'Арендованная машина стояла не там: заплатите 50.', effect: { kind: 'money', amount: -50 } },
  { id: 'luggage', title: 'Перевес багажа', text: 'Чемодан тяжелее нормы: заплатите 60.', effect: { kind: 'money', amount: -60 } },
  { id: 'visa', title: 'Срочная виза', text: 'Оформление за один день: заплатите 100.', effect: { kind: 'money', amount: -100 } },
  { id: 'lost-passport', title: 'Потерянный паспорт', text: 'Консульство поможет, но не бесплатно: заплатите 80.', effect: { kind: 'money', amount: -80 } },
  { id: 'taxi-meter', title: 'Таксист «знает короткую дорогу»', text: 'Счётчик накрутил: заплатите 40.', effect: { kind: 'money', amount: -40 } },
  // --- movement
  { id: 'to-start', title: 'Домой на выходные', text: 'Отправляйтесь на «Старт» и получите зарплату.', effect: { kind: 'moveTo', index: 0 } },
  { id: 'to-paris', title: 'Романтический уикенд', text: 'Летите в Париж. Если пройдёте «Старт» — получите зарплату.', effect: { kind: 'moveTo', index: 34 } },
  { id: 'to-cairo', title: 'Тур к пирамидам', text: 'Отправляйтесь в Каир. Если пройдёте «Старт» — получите зарплату.', effect: { kind: 'moveTo', index: 1 } },
  { id: 'to-rome', title: 'Все дороги ведут…', text: '…в Рим. Если пройдёте «Старт» — получите зарплату.', effect: { kind: 'moveTo', index: 29 } },
  { id: 'to-auction', title: 'Аукцион редкостей', text: 'Идите на «Аукцион».', effect: { kind: 'moveTo', index: 10 } },
  { id: 'to-airport', title: 'Пересадка', text: 'Идите вперёд до ближайшего аэропорта.', effect: { kind: 'moveToNearest', group: 'air' } },
  { id: 'to-airport-2', title: 'Горящий билет', text: 'Идите вперёд до ближайшего аэропорта.', effect: { kind: 'moveToNearest', group: 'air' } },
  { id: 'shortcut', title: 'Попутный ветер', text: 'Пройдите вперёд на 3 клетки.', effect: { kind: 'moveBy', steps: 3 } },
  { id: 'detour', title: 'Забыли зарядку', text: 'Вернитесь на 3 клетки назад.', effect: { kind: 'moveBy', steps: -3 } },
  // --- players
  { id: 'birthday', title: 'День рождения в пути', text: 'Каждый игрок дарит вам 20.', effect: { kind: 'collectEach', amount: 20 } },
  { id: 'guide', title: 'Вы — гид', text: 'Провели экскурсию для всех: каждый платит вам 30.', effect: { kind: 'collectEach', amount: 30 } },
  { id: 'treat', title: 'Угощаю всех!', text: 'Вы платите каждому игроку 20.', effect: { kind: 'payEach', amount: 20 } },
  { id: 'gifts', title: 'Подарки из поездки', text: 'Вы привезли всем сувениры: заплатите каждому 15.', effect: { kind: 'payEach', amount: 15 } },
  // --- upgrades
  { id: 'repairs', title: 'Ремонт отелей', text: 'Заплатите 25 за каждый уровень улучшений.', effect: { kind: 'repairs', perLevel: 25 } },
  { id: 'inspection', title: 'Санитарная проверка', text: 'Заплатите 15 за каждый уровень улучшений.', effect: { kind: 'repairs', perLevel: 15 } },
  // --- items
  { id: 'item-shield', title: 'Туристическая страховка', text: 'Получите щит.', effect: { kind: 'item', item: 'shield' } },
  { id: 'item-discount', title: 'Купон', text: 'Получите скидку на аренду.', effect: { kind: 'item', item: 'discount' } },
  { id: 'item-cone', title: 'Дорожный конус', text: 'Получите конус-ловушку.', effect: { kind: 'item', item: 'cone' } },
  { id: 'item-discount-2', title: 'Карта лояльности отелей', text: 'Получите скидку на аренду.', effect: { kind: 'item', item: 'discount' } },
  { id: 'item-shield-2', title: 'Оберег из лавки', text: 'Получите щит.', effect: { kind: 'item', item: 'shield' } },
];

export const ITEM_INFO: Record<ItemKind, { name: string; description: string }> = {
  shield: {
    name: 'Щит',
    description: 'Автоматически отражает следующую ловушку или проделку против вас. Аренду и налоги не отменяет.',
  },
  discount: { name: 'Скидка', description: 'Перед оплатой аренды можно уменьшить её на 50%.' },
  cone: { name: 'Конус', description: 'Поставьте на обычную клетку: следующий соперник, вставший на неё, платит банку 30.' },
};
