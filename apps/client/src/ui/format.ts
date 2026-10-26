import { CHANCE_CARDS, ITEM_INFO, MEGAPOLIS } from '@pb/content';
import type { MatchEvent, MoneyReason, PublicMatch, SeatId, TradeSide } from '@pb/game-core';

export const tileName = (i: number) => MEGAPOLIS.tiles[i]?.name ?? `#${i}`;

export const money = (n: number) => n.toLocaleString('ru-RU');

export function seatName(m: PublicMatch | null, seat: SeatId | null, me?: SeatId | null): string {
  if (seat === null) return 'банк';
  if (me && seat === me) return 'Вы';
  return m?.players.find((p) => p.seat === seat)?.name ?? seat;
}

const REASON: Record<MoneyReason, string> = {
  rent: 'аренда',
  tax: 'налог',
  chance: 'Шанс',
  salary: 'зарплата за «Старт»',
  purchase: 'покупка',
  auction: 'аукцион',
  upgrade: 'улучшение',
  sellUpgrade: 'продажа улучшения',
  mortgage: 'залог',
  unmortgage: 'выкуп',
  trade: 'сделка',
  duel: 'дуэль',
  trap: 'ловушка',
  minigame: 'приз мини-игры',
  bankruptcy: 'банкротство',
};

export const reasonText = (r: MoneyReason) => REASON[r];

export function sideText(side: TradeSide): string {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(`${money(side.cash)} монет`);
  for (const t of side.tiles) parts.push(`«${tileName(t)}»`);
  return parts.length ? parts.join(', ') : 'ничего';
}

/** Journal line for an event (null — not shown). */
export function eventText(m: PublicMatch, e: MatchEvent, me: SeatId | null): string | null {
  const n = (s: SeatId | null) => seatName(m, s, me);
  switch (e.t) {
    case 'turnStart':
      return `— Раунд ${e.round}: ход ${n(e.seat)} —`;
    case 'rolled':
      return `${n(e.seat)}: кубики ${e.dice[0]} + ${e.dice[1]}`;
    case 'moved':
      return `${n(e.seat)} → «${tileName(e.to)}»`;
    case 'money':
      if (['purchase', 'upgrade', 'mortgage', 'unmortgage', 'sellUpgrade', 'auction'].includes(e.reason)) return null;
      if (e.from && e.to) return `${n(e.from)} → ${n(e.to)}: ${money(e.amount)} (${REASON[e.reason]})`;
      if (e.from) return `${n(e.from)} платит ${money(e.amount)} (${REASON[e.reason]})`;
      return `${n(e.to)} получает ${money(e.amount)} (${REASON[e.reason]})`;
    case 'bought':
      return `${n(e.seat)} покупает «${tileName(e.tile)}» за ${money(e.price)}`;
    case 'chance': {
      const c = CHANCE_CARDS.find((x) => x.id === e.card);
      return `${n(e.seat)}: Шанс — ${c?.text ?? ''}`;
    }
    case 'item':
      return { gained: `${n(e.seat)} получает предмет «${ITEM_INFO[e.item].name}»`, used: `${n(e.seat)} использует «${ITEM_INFO[e.item].name}»`, dropped: `${n(e.seat)}: предмет «${ITEM_INFO[e.item].name}» не поместился`, blocked: null }[e.action];
    case 'trap':
      return {
        placed: `Поставлена ловушка на «${tileName(e.tile)}»`,
        triggered: `${n(e.seat)} попадает в ловушку на «${tileName(e.tile)}»`,
        shielded: `Щит ${n(e.seat) === 'Вы' ? 'вас' : n(e.seat)} отразил ловушку`,
      }[e.action];
    case 'auctionStart':
      return `Аукцион: «${tileName(e.tile)}»`;
    case 'bid':
      return `${n(e.seat)} ставит ${money(e.amount)}`;
    case 'auctionEnd':
      return e.winner ? `«${tileName(e.tile)}» уходит ${n(e.winner)} за ${money(e.price)}` : `«${tileName(e.tile)}» остаётся у банка`;
    case 'upgraded':
      return `${n(e.seat)}: «${tileName(e.tile)}» — уровень ${e.level}`;
    case 'mortgaged':
      return `${n(e.seat)} ${e.mortgaged ? 'закладывает' : 'выкупает'} «${tileName(e.tile)}»`;
    case 'trade':
      if (e.result === 'proposed') return `${n(e.offer.from)} предлагает сделку ${n(e.offer.to)}`;
      return `Сделка ${n(e.offer.from)} ⇄ ${n(e.offer.to)}: ${{ accepted: 'принята', rejected: 'отклонена', cancelled: 'отозвана', expired: 'истекла', invalid: 'устарела', proposed: '' }[e.result]}`;
    case 'duel': {
      const who = `${n(e.offer.buyer)} ⚔ ${n(e.offer.seller)} за «${tileName(e.offer.tile)}»`;
      return {
        proposed: `Вызов на дуэль: ${who}`,
        accepted: `Дуэль принята: ${who}`,
        declined: `Вызов отклонён: ${who}`,
        cancelled: `Вызов отозван: ${who}`,
        expired: `Вызов истёк: ${who}`,
        buyerWon: `Дуэль: победил ${n(e.offer.buyer)}, цена ${money(e.offer.priceIfBuyerWins)}`,
        sellerWon: `Дуэль: победил ${n(e.offer.seller)}, цена ${money(e.offer.priceIfSellerWins)}`,
        draw: `Дуэль: ничья, сделки нет`,
        void: `Дуэль отменена`,
      }[e.result];
    }
    case 'debt':
      return `${n(e.seat)}: не хватает ${money(e.amount)} — продажа и залог`;
    case 'bankrupt':
      return `💥 ${n(e.seat)} — банкрот и становится призраком`;
    case 'left':
      return `${n(e.seat)} покидает игру`;
    case 'ghost':
      return e.action === 'trap' ? `👻 ${n(e.seat)} ставит ловушку` : e.blocked ? `👻 Щит ${n(e.target ?? null)} отразил проделку` : `👻 ${n(e.seat)} мешает ${n(e.target ?? null)} улучшать «${tileName(e.tile)}»`;
    case 'minigame':
      return e.stage === 'intro' ? (e.context === 'group' ? '🎮 Общая мини-игра!' : '⚔ Дуэль начинается') : null;
    case 'roundEnd':
      return `Раунд ${e.round} завершён`;
    case 'finished':
      return '🏁 Партия окончена';
  }
}

const ERRORS: Record<string, string> = {
  noCash: 'Не хватает свободных денег',
  notYourTurn: 'Сейчас не ваш ход',
  wrongPhase: 'Сейчас это действие недоступно',
  notAlive: 'Призрак не может это делать',
  needFullGroup: 'Нужен весь комплект группы',
  groupMortgaged: 'В группе есть заложенные объекты',
  buildEvenly: 'Улучшайте группу равномерно',
  sellEvenly: 'Продавайте улучшения равномерно',
  maxLevel: 'Максимальный уровень',
  upgradeBlocked: 'Призрак запретил улучшать этот объект на этот ход',
  sellUpgradesFirst: 'Сначала продайте улучшения группы',
  alreadyMortgaged: 'Уже заложено',
  notMortgaged: 'Не заложено',
  locked: 'Объект участвует в сделке или дуэли',
  bidTooLow: 'Ставка должна быть выше текущей хотя бы на 10',
  passed: 'Вы уже вышли из торгов',
  alreadyLeading: 'Ваша ставка и так лидирует',
  leaderCannotPass: 'Лидер торгов не может спасовать',
  tradeCash: 'Неверная сумма в сделке',
  tradeTiles: 'Эти объекты нельзя передать (улучшения в группе)',
  emptyTrade: 'Пустая сделка',
  tooManyOffers: 'Лимит предложений за ход исчерпан',
  badPartner: 'Нельзя выбрать этого игрока',
  noOffer: 'Предложение уже неактуально',
  noDuelTokens: 'Жетоны вызова закончились',
  mortgaged: 'Объект заложен',
  hasUpgrades: 'В группе есть улучшения',
  badPrices: 'Цены: минимум 10, и цена при победе продавца не меньше цены при победе покупателя',
  pairDueledThisRound: 'С этим игроком уже была дуэль в этом раунде',
  notOwned: 'У объекта нет владельца',
  notOwner: 'Это не ваш объект',
  noItem: 'Нет такого предмета',
  badTrapTile: 'Сюда нельзя поставить ловушку (угол, занято или лимит)',
  notGhost: 'Только для призраков',
  noEnergy: 'Не хватает энергии призрака',
  onePrankPerRound: 'Одна проделка за раунд',
  sameTargetTwice: 'Нельзя два раунда подряд мешать одному игроку',
  alreadyBlocked: 'Этому игроку уже мешают',
  badTarget: 'Неверная цель',
  finished: 'Партия окончена',
  noMatch: 'Матч не найден',
  staleMatch: 'Это действие относится к прошлой партии',
  staleRevision: 'Состояние уже изменилось, повторите',
  commandIdConflict: 'Конфликт команды, повторите',
  noSession: 'Нет соединения с сервером',
  rateLimited: 'Слишком часто',
  badRequest: 'Некорректный запрос',
  roomNotFound: 'Комната не найдена — проверьте код',
  roomFull: 'В комнате уже четыре игрока',
  alreadyStarted: 'Игра в этой комнате уже идёт',
  needFourPlayers: 'Нужно четыре игрока',
  notAllReady: 'Не все готовы',
  someoneOffline: 'Кто-то из игроков не в сети',
  notHost: 'Только хозяин комнаты',
  notLobby: 'Игра уже началась',
  avatarTaken: 'Этот персонаж уже занят',
  notFinished: 'Партия ещё идёт',
  noRoom: 'Вы не в комнате',
  offline: 'Нет соединения с сервером',
  timeout: 'Сервер не ответил, попробуйте ещё раз',
  serverError: 'Ошибка сервера',
  protocolMismatch: 'Версия приложения устарела — обновите страницу',
  tooFast: 'Слишком быстро!',
  late: 'Поздно',
  alreadyAnswered: 'Уже отвечено',
  roundOver: 'Этот маршрут уже закончен',
  notInputTime: 'Ещё рано — запоминайте',
};

export function errorText(code: string): string {
  return ERRORS[code] ?? 'Действие недоступно';
}

export function secondsLeft(deadline: number | null, now: number): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
