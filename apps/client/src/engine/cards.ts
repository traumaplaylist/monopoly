// Собственные карточки двух колод: «Сигнал» (движение, риск) и «Совет колонии» (деньги).
import type { DeckId } from './types';

export type CardEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'moveTo'; tile: number }
  | { kind: 'moveBack'; steps: number }
  | { kind: 'nearest'; target: 'transport' | 'utility' }
  | { kind: 'jail' }
  | { kind: 'jailCard' }
  | { kind: 'repairs'; house: number; hotel: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'collectEach'; amount: number };

export interface CardDef {
  id: number;
  title: string;
  text: string;
  effect: CardEffect;
}

export const DECK_NAMES: Record<DeckId, string> = {
  signal: 'Сигнал',
  council: 'Совет колонии',
};

export const CARDS: Record<DeckId, readonly CardDef[]> = {
  signal: [
    {
      id: 0,
      title: 'Солнечный ветер',
      text: 'Попутный солнечный ветер. Летите на «Старт».',
      effect: { kind: 'moveTo', tile: 0 },
    },
    {
      id: 1,
      title: 'Облачная биржа',
      text: 'Приглашение на биржу. Летите на «Небесный бульвар».',
      effect: { kind: 'moveTo', tile: 24 },
    },
    { id: 2, title: 'Геологоразведка', text: 'Срочный вызов на «Ржавый каньон».', effect: { kind: 'moveTo', tile: 11 } },
    {
      id: 3,
      title: 'Пересадка',
      text: 'Летите до ближайшего транспортного узла. Если он чей-то — заплатите двойной тариф.',
      effect: { kind: 'nearest', target: 'transport' },
    },
    {
      id: 4,
      title: 'Экспресс-рейс',
      text: 'Летите до ближайшего транспортного узла. Если он чей-то — заплатите двойной тариф.',
      effect: { kind: 'nearest', target: 'transport' },
    },
    {
      id: 5,
      title: 'Перегрузка сети',
      text: 'Летите к ближайшей энергостанции. Если она чья-то — заплатите 10× сумму кубиков.',
      effect: { kind: 'nearest', target: 'utility' },
    },
    {
      id: 6,
      title: 'Спонсор трансляции',
      text: 'Спонсор оплатил вашу трансляцию: получите 50.',
      effect: { kind: 'money', amount: 50 },
    },
    {
      id: 7,
      title: 'Дипломатический иммунитет',
      text: 'Сохраните карту: она выпускает из карантина бесплатно.',
      effect: { kind: 'jailCard' },
    },
    {
      id: 8,
      title: 'Сбой навигации',
      text: 'Автопилот ошибся: отступите на 3 клетки назад.',
      effect: { kind: 'moveBack', steps: 3 },
    },
    {
      id: 9,
      title: 'Споры в трюме',
      text: 'В грузе нашли споры. Прямо в карантин, «Старт» не проходите.',
      effect: { kind: 'jail' },
    },
    {
      id: 10,
      title: 'Микрометеориты',
      text: 'Ремонт куполов: 25 за каждый модуль и 100 за каждую станцию.',
      effect: { kind: 'repairs', house: 25, hotel: 100 },
    },
    {
      id: 11,
      title: 'Превышение скорости',
      text: 'Штраф орбитального патруля: заплатите 15.',
      effect: { kind: 'money', amount: -15 },
    },
    {
      id: 12,
      title: 'Экскурсия',
      text: 'Летите на «Орбитальный лифт». Проходя «Старт», получите бонус.',
      effect: { kind: 'moveTo', tile: 5 },
    },
    { id: 13, title: 'Светский приём', text: 'Вас ждут в «Короне Плутона».', effect: { kind: 'moveTo', tile: 39 } },
    {
      id: 14,
      title: 'Спикер альянса',
      text: 'Вас избрали спикером. Заплатите каждому игроку по 50.',
      effect: { kind: 'payEach', amount: 50 },
    },
    { id: 15, title: 'Патент на фильтры', text: 'Ваш патент одобрен: получите 150.', effect: { kind: 'money', amount: 150 } },
  ],
  council: [
    { id: 0, title: 'Грузовой рейс', text: 'Колония оплатила перелёт. Летите на «Старт».', effect: { kind: 'moveTo', tile: 0 } },
    {
      id: 1,
      title: 'Перерасчёт пайка',
      text: 'Совет пересчитал выплаты за ресурсы: получите 200.',
      effect: { kind: 'money', amount: 200 },
    },
    {
      id: 2,
      title: 'Медосмотр',
      text: 'Обязательный медосмотр после перелёта: заплатите 50.',
      effect: { kind: 'money', amount: -50 },
    },
    { id: 3, title: 'Старый скафандр', text: 'Вы продали старый скафандр: получите 50.', effect: { kind: 'money', amount: 50 } },
    {
      id: 4,
      title: 'Поручительство Совета',
      text: 'Сохраните карту: она выпускает из карантина бесплатно.',
      effect: { kind: 'jailCard' },
    },
    { id: 5, title: 'Нарушение шлюза', text: 'Вы открыли шлюз без разрешения. Прямо в карантин.', effect: { kind: 'jail' } },
    {
      id: 6,
      title: 'Урожай гидропоники',
      text: 'Отличный урожай в оранжерее: получите 100.',
      effect: { kind: 'money', amount: 100 },
    },
    { id: 7, title: 'Возврат пошлины', text: 'Таможня вернула переплату: получите 20.', effect: { kind: 'money', amount: 20 } },
    {
      id: 8,
      title: 'День основания',
      text: 'Праздник колонии: каждый игрок дарит вам по 10.',
      effect: { kind: 'collectEach', amount: 10 },
    },
    {
      id: 9,
      title: 'Страховка',
      text: 'Страховая выплата за повреждённый шлюз: получите 100.',
      effect: { kind: 'money', amount: 100 },
    },
    {
      id: 10,
      title: 'Обучение кадетов',
      text: 'Взнос в лётную академию: заплатите 100.',
      effect: { kind: 'money', amount: -100 },
    },
    {
      id: 11,
      title: 'Кислородное голодание',
      text: 'Лечение в медотсеке: заплатите 50.',
      effect: { kind: 'money', amount: -50 },
    },
    {
      id: 12,
      title: 'Консультация',
      text: 'Инженеры заплатили за консультацию: получите 25.',
      effect: { kind: 'money', amount: 25 },
    },
    {
      id: 13,
      title: 'Модернизация',
      text: 'Обновление систем жизнеобеспечения: 40 за модуль и 115 за станцию.',
      effect: { kind: 'repairs', house: 40, hotel: 115 },
    },
    {
      id: 14,
      title: 'Конкурс оранжерей',
      text: 'Второе место в конкурсе оранжерей: получите 10.',
      effect: { kind: 'money', amount: 10 },
    },
    {
      id: 15,
      title: 'Наследство',
      text: 'Дальний родственник с Каллисто оставил вам 100.',
      effect: { kind: 'money', amount: 100 },
    },
  ],
};

export function card(deck: DeckId, id: number): CardDef {
  const c = CARDS[deck][id];
  if (!c) throw new Error(`Нет карты ${deck}#${id}`);
  return c;
}
