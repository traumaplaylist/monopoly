import { useEffect } from 'react';
import { getActor, tile } from '../engine';
import type { Action } from '../engine';
import { useGame } from '../game/store';
import { money, playerName } from './format';
import { canDo, useGameState, useMe, useMyTurnReady } from './hooks';

export type DrawerTab = 'log' | 'assets' | 'settings';

/** Нижняя панель: главное действие по ситуации + сделка, активы, «ещё». */
export function BottomBar({ onOpen }: { onOpen: (tab: DrawerTab) => void }) {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const dispatch = useGame((s) => s.dispatch);
  const setTradeOpen = useGame((s) => s.setTradeOpen);
  const actor = getActor(state);

  let primary: { label: string; action: Action | null; testId: string } = {
    label: actor && actor !== me.id ? `Ходит ${playerName(state, actor)}…` : '…',
    action: null,
    testId: 'wait',
  };
  if (ready && !state.trade) {
    if (state.phase === 'roll') primary = { label: 'Бросить', action: { type: 'ROLL', player: me.id }, testId: 'roll' };
    else if (state.phase === 'endTurn')
      primary = { label: 'Завершить ход', action: { type: 'END_TURN', player: me.id }, testId: 'end-turn' };
    else if (state.phase === 'buy')
      primary = {
        label: `Купить ${money(tile(me.position).price!)}`,
        action: { type: 'BUY', player: me.id },
        testId: 'buy-main',
      };
    else if (state.phase === 'debt')
      primary = {
        label: `Оплатить ${money(state.debts[0]!.amount)}`,
        action: { type: 'PAY_DEBT', player: me.id },
        testId: 'pay',
      };
  }
  const enabled = !!primary.action && canDo(state, primary.action);

  // Пробел — главное действие.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (primary.action && enabled && (primary.testId === 'roll' || primary.testId === 'end-turn')) {
        e.preventDefault();
        dispatch(primary.action);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const canTrade =
    ready &&
    !state.trade &&
    (state.phase === 'roll' || state.phase === 'endTurn') &&
    state.tradesThisTurn < state.settings.maxTradesPerTurn;

  return (
    <nav className="bar">
      <button
        className={`bar-btn main ${enabled ? '' : 'idle'}`}
        disabled={!enabled}
        onClick={() => primary.action && dispatch(primary.action)}
        data-testid={primary.testId}
      >
        <span className="bar-ico">🎲</span>
        <span>{primary.label}</span>
      </button>
      <button className="bar-btn" disabled={!canTrade} onClick={() => setTradeOpen(true)} data-testid="trade">
        <span className="bar-ico">🤝</span>
        <span>Сделка</span>
      </button>
      <button className="bar-btn" onClick={() => onOpen('assets')} data-testid="tab-assets">
        <span className="bar-ico">🏠</span>
        <span>Активы</span>
      </button>
      <button className="bar-btn" onClick={() => onOpen('log')} data-testid="more">
        <span className="bar-ico">☰</span>
        <span>Ещё</span>
      </button>
    </nav>
  );
}
