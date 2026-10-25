import { useEffect } from 'react';
import { getActor, tile } from '../engine';
import type { Action } from '../engine';
import { useGame } from '../game/store';
import { money, playerName } from './format';
import { canDo, useGameState, useMe, useMyTurnReady } from './hooks';

export function ActionPanel() {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const dispatch = useGame((s) => s.dispatch);
  const setTradeOpen = useGame((s) => s.setTradeOpen);
  const actor = getActor(state);
  const act = (a: Action) => dispatch(a);
  const can = (a: Action) => ready && canDo(state, a);

  const roll: Action = { type: 'ROLL', player: me.id };
  const end: Action = { type: 'END_TURN', player: me.id };

  // Пробел — главное действие (бросок или завершение хода).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (canDo(state, roll) && ready) {
        e.preventDefault();
        dispatch(roll);
      } else if (canDo(state, end) && ready) {
        e.preventDefault();
        dispatch(end);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (state.phase === 'gameOver') return null;

  if (state.trade && state.trade.from === me.id) {
    return (
      <div className="actions">
        <p className="status">Ждём ответа {playerName(state, state.trade.to)} на вашу сделку…</p>
        <button className="btn" onClick={() => act({ type: 'CANCEL_TRADE', player: me.id })}>
          Отозвать предложение
        </button>
      </div>
    );
  }

  if (actor !== me.id) {
    const who = playerName(state, actor);
    const what =
      state.phase === 'auction'
        ? 'торгуется на аукционе'
        : state.phase === 'debt'
          ? 'ищет деньги на долг'
          : state.trade
            ? 'обдумывает сделку'
            : 'ходит';
    return (
      <div className="actions">
        <p className="status" data-testid="status">
          <span className="pulse" /> {who} {what}…
        </p>
      </div>
    );
  }

  if (state.phase === 'debt') {
    const d = state.debts[0]!;
    return (
      <div className="actions debt">
        <p className="status">
          Долг {money(d.amount)} → {playerName(state, d.creditor)}. Наличные: {money(me.cash)}.
        </p>
        <p className="hint">Продайте постройки или заложите клетки (выберите клетку на поле или в списке активов).</p>
        <div className="row">
          <button
            className="btn primary"
            disabled={!can({ type: 'PAY_DEBT', player: me.id })}
            onClick={() => act({ type: 'PAY_DEBT', player: me.id })}
          >
            Оплатить {money(d.amount)}
          </button>
          <button className="btn danger" disabled={!ready} onClick={() => act({ type: 'DECLARE_BANKRUPTCY', player: me.id })}>
            Объявить банкротство
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'buy') {
    const t = tile(me.position);
    const buy: Action = { type: 'BUY', player: me.id };
    return (
      <div className="actions">
        <p className="status">
          Свободно: <b>«{t.name}»</b> за {money(t.price!)}
        </p>
        <div className="row">
          <button className="btn primary" disabled={!can(buy)} onClick={() => act(buy)} data-testid="buy">
            Купить
          </button>
          <button
            className="btn"
            disabled={!ready}
            onClick={() => act({ type: 'DECLINE_BUY', player: me.id })}
            data-testid="decline"
          >
            На аукцион
          </button>
        </div>
        {!canDo(state, buy) && <p className="hint">Не хватает наличных — можно заложить имущество или отправить на аукцион.</p>}
      </div>
    );
  }

  if (state.phase === 'auction') return <p className="status">Ваша ставка на аукционе…</p>;

  const fine: Action = { type: 'PAY_JAIL_FINE', player: me.id };
  const card: Action = { type: 'USE_JAIL_CARD', player: me.id };
  return (
    <div className="actions">
      {me.inJail && state.phase === 'roll' && (
        <p className="status">Вы в карантине (попыток: {me.jailTurns}/3). Выбросьте дубль, заплатите или используйте карту.</p>
      )}
      {state.phase === 'roll' && state.extraRoll && <p className="status">Дубль! Бросайте ещё раз.</p>}
      <div className="row">
        {state.phase === 'roll' ? (
          <button className="btn primary big" disabled={!can(roll)} onClick={() => act(roll)} data-testid="roll">
            🎲 Бросить кубики
          </button>
        ) : (
          <button className="btn primary big" disabled={!can(end)} onClick={() => act(end)} data-testid="end-turn">
            Завершить ход
          </button>
        )}
      </div>
      <div className="row">
        {me.inJail && state.phase === 'roll' && (
          <>
            <button className="btn" disabled={!can(fine)} onClick={() => act(fine)}>
              Штраф {money(state.settings.jailFine)}
            </button>
            <button className="btn" disabled={!can(card)} onClick={() => act(card)}>
              Карта выхода
            </button>
          </>
        )}
        <button
          className="btn"
          disabled={!ready || state.tradesThisTurn >= state.settings.maxTradesPerTurn}
          onClick={() => setTradeOpen(true)}
          data-testid="trade"
        >
          🤝 Сделка
        </button>
      </div>
      <p className="hint">Пробел — бросок / конец хода. Клик по клетке — информация и управление.</p>
    </div>
  );
}
