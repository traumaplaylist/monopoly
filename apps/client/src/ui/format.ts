import { DECK_NAMES, card, tile } from '../engine';
import type { GameEvent, GameState, MoneyReason, PlayerId, TradeSide } from '../engine';

export const money = (n: number) => `₡${n.toLocaleString('ru-RU')}`;

export function playerName(s: GameState, id: PlayerId | null): string {
  if (id === null) return 'Банк';
  return s.players.find((p) => p.id === id)?.name ?? id;
}

const REASON: Record<MoneyReason, string> = {
  rent: 'аренда',
  tax: 'налог',
  card: 'карта',
  jailFine: 'штраф карантина',
  purchase: 'покупка',
  auction: 'аукцион',
  build: 'строительство',
  sellBuilding: 'продажа постройки',
  mortgage: 'залог',
  unmortgage: 'выкуп',
  start: 'бонус «Старта»',
  trade: 'сделка',
  bankruptcy: 'банкротство',
};

export function sideText(side: TradeSide): string {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(money(side.cash));
  for (const t of side.tiles) parts.push(`«${tile(t).name}»`);
  if (side.jailCards > 0) parts.push(`карта выхода ×${side.jailCards}`);
  return parts.length ? parts.join(', ') : 'ничего';
}

/** Текст события для журнала. null — событие не показываем. */
export function eventText(s: GameState, e: GameEvent): string | null {
  const n = (id: PlayerId | null) => playerName(s, id);
  switch (e.t) {
    case 'turnStart':
      return `— Ход ${e.turn}: ${n(e.player)} —`;
    case 'rolled':
      return `${n(e.player)} бросает ${e.dice[0]} и ${e.dice[1]}${e.doubles ? ' — дубль!' : ''}`;
    case 'moved':
      return e.direct ? null : `${n(e.player)} → «${tile(e.to).name}»`;
    case 'money':
      if (
        e.reason === 'purchase' ||
        e.reason === 'build' ||
        e.reason === 'mortgage' ||
        e.reason === 'unmortgage' ||
        e.reason === 'sellBuilding' ||
        e.reason === 'auction'
      )
        return null;
      if (e.from && e.to) return `${n(e.from)} платит ${n(e.to)} ${money(e.amount)} (${REASON[e.reason]})`;
      if (e.from) return `${n(e.from)} платит ${money(e.amount)} (${REASON[e.reason]})`;
      return `${n(e.to)} получает ${money(e.amount)} (${REASON[e.reason]})`;
    case 'bought':
      return `${n(e.player)} покупает «${tile(e.tile).name}» за ${money(e.price)}`;
    case 'card':
      return `${n(e.player)} тянет «${DECK_NAMES[e.deck]}»: ${card(e.deck, e.card).text}`;
    case 'jailed':
      return `${n(e.player)} отправляется в карантин`;
    case 'leftJail':
      return `${n(e.player)} выходит из карантина (${{ doubles: 'дубль', fine: 'штраф', card: 'карта', forcedFine: 'обязательный штраф' }[e.how]})`;
    case 'jailStay':
      return `${n(e.player)} остаётся в карантине (попытка ${e.attempt} из 3)`;
    case 'auctionStart':
      return `Аукцион: «${tile(e.tile).name}»`;
    case 'bid':
      return `${n(e.player)} ставит ${money(e.amount)}`;
    case 'auctionPass':
      return `${n(e.player)} пасует`;
    case 'auctionEnd':
      return e.winner
        ? `«${tile(e.tile).name}» уходит ${n(e.winner)} за ${money(e.price)}`
        : `«${tile(e.tile).name}» остаётся у банка`;
    case 'built':
      return `${n(e.player)} строит на «${tile(e.tile).name}» (${e.houses === 5 ? 'станция' : `модулей: ${e.houses}`})`;
    case 'soldBuilding':
      return `${n(e.player)} продаёт постройку на «${tile(e.tile).name}»`;
    case 'mortgaged':
      return `${n(e.player)} закладывает «${tile(e.tile).name}»`;
    case 'unmortgaged':
      return `${n(e.player)} выкупает «${tile(e.tile).name}»`;
    case 'tradeProposed':
      return `${n(e.offer.from)} предлагает ${n(e.offer.to)}: ${sideText(e.offer.give)} ⇄ ${sideText(e.offer.get)}`;
    case 'tradeResolved':
      return `Сделка ${n(e.offer.from)} ⇄ ${n(e.offer.to)}: ${{ accepted: 'принята', rejected: 'отклонена', cancelled: 'отозвана' }[e.result]}`;
    case 'debt':
      return `${n(e.debtor)} должен ${n(e.creditor)} ${money(e.amount)} — не хватает наличных`;
    case 'bankrupt':
      return `💥 ${n(e.player)} — банкрот${e.creditor ? `, имущество переходит ${n(e.creditor)}` : ''}`;
    case 'gameOver':
      return e.winner ? `🏆 Победитель: ${n(e.winner)}` : 'Игра окончена';
  }
}

const ERRORS: Record<string, string> = {
  noCash: 'Не хватает денег',
  notYourTurn: 'Сейчас не ваш ход',
  wrongPhase: 'Сейчас это действие недоступно',
  notNow: 'Сейчас это действие недоступно',
  tradePending: 'Сначала дождитесь ответа на сделку',
  needFullGroup: 'Нужна вся цветовая группа',
  groupMortgaged: 'В группе есть заложенные клетки',
  buildEvenly: 'Стройте равномерно по группе',
  sellEvenly: 'Продавайте равномерно по группе',
  maxBuilt: 'Уже построена станция',
  noHousesInBank: 'В банке закончились модули',
  noHotelsInBank: 'В банке закончились станции',
  sellBuildingsFirst: 'Сначала продайте постройки группы',
  alreadyMortgaged: 'Уже заложено',
  notMortgaged: 'Не заложено',
  bidTooLow: 'Ставка должна быть выше текущей',
  tradeTiles: 'Эти клетки нельзя передать',
  tradeCash: 'Неверная сумма в сделке',
  emptyTrade: 'Пустая сделка',
  tooManyTrades: 'Лимит предложений за ход исчерпан',
  noJailCard: 'Нет карты выхода',
};

export function errorText(code: string): string {
  return ERRORS[code] ?? `Действие недоступно (${code})`;
}
