import { purchasePrice } from '@pb/game-core';
import { useEffect } from 'react';
import { GROUPS, ITEM_INFO, WORLD, RULESET, groupTiles } from '@pb/content';
import type { ItemKind } from '@pb/content';
import { rentFor } from '@pb/game-core';
import type { MatchState } from '@pb/game-core';
import { send } from '../../net/connection';
import { set, useStore } from '../../state/store';
import { money, seatName } from '../format';
import { currentSeat, useMatch, useMe } from '../hooks';
import { specialColor } from '../../render/tileArt';
import { TileIcon } from '../TileIcon';

const ITEM_ICON: Record<ItemKind, string> = { shield: '🛡️', discount: '🏷️', cone: '🚧', ticket: '🎫' };

/** Main contextual action: roll / end turn / buy / pay. */
function usePrimary() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const mine = currentSeat(m) === me;
  const meP = useMe();
  if (meP?.role === 'ghost') return { label: 'Вы — призрак', cmd: null, testId: 'wait' } as const;
  if (mine && m.phase === 'PRE_ROLL') return { label: 'Бросить кубики', cmd: { type: 'ROLL' }, testId: 'roll' } as const;
  if (mine && m.phase === 'POST_ROLL') return { label: 'Завершить ход', cmd: { type: 'END_TURN' }, testId: 'end-turn' } as const;
  if (mine && m.phase === 'PURCHASE' && m.purchaseTile !== null)
    return { label: `Купить ${money(purchasePrice(m as unknown as MatchState, m.purchaseTile))}`, cmd: { type: 'BUY' }, testId: 'buy-main' } as const;
  if (m.phase === 'DEBT' && m.debt?.payer === me) return { label: `Оплатить ${money(m.debt.amount)}`, cmd: { type: 'PAY_DEBT' }, testId: 'pay' } as const;
  const who = seatName(m, currentSeat(m), me);
  return { label: m.phase === 'MINIGAME' ? 'Мини-игра' : m.phase === 'AUCTION' ? 'Идёт аукцион' : `Ходит ${who}…`, cmd: null, testId: 'wait' } as const;
}

export function TileSummary() {
  const m = useMatch();
  const selected = useStore((s) => s.selectedTile);
  const index = selected ?? m.players.find((p) => p.seat === currentSeat(m))!.position;
  const t = WORLD.tiles[index]!;
  const o = m.tiles[index];
  const g = t.group ? GROUPS[t.group] : null;
  const owned = g && o?.owner ? groupTiles(WORLD, t.group!).filter((i) => m.tiles[i]?.owner === o.owner).length : 0;
  return (
    <button className="tile-summary" onClick={() => set({ selectedTile: index, sheet: { kind: 'tile', tile: index } })} data-testid="tile-summary">
      <span className="ts-icon" style={{ background: specialColor(t) ?? '#5b4c86' }}>
        <TileIcon visual={t.visual} size={26} />
      </span>
      <span className="ts-text">
        <b>{t.name}</b>
        <span>
          {o?.owner ? (
            <>
              {o.mortgaged ? 'Заложено' : (
                <>
                  Аренда <i className="coin" />
                  {money(rentFor(m as unknown as MatchState, index))}
                </>
              )}
              {g && ` · ${seatName(m, o.owner)} ${owned}/${groupTiles(WORLD, t.group!).length}`}
            </>
          ) : t.price ? (
            <>
              Цена <i className="coin" />
              {money(t.price)}
            </>
          ) : (
            t.description
          )}
        </span>
      </span>
      <span className="ts-caret">›</span>
    </button>
  );
}

function Items() {
  const m = useMatch();
  const me = useMe();
  const mine = currentSeat(m) === me?.seat;
  const calm = mine && (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL');
  if (!me) return null;
  if (me.role === 'ghost') {
    const canPrank = (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL') && me.ghostEnergy >= 1 && me.ghostPrankRound !== m.round;
    const why = me.ghostEnergy < 1 ? 'Нет энергии (+1 каждый раунд)' : me.ghostPrankRound === m.round ? 'Одна проделка за раунд' : !canPrank ? 'Только между ходами' : '';
    return (
      <div className="items ghost-actions">
        <button className="slot" disabled={!canPrank} title={why || 'Поставить ловушку: следующий игрок на клетке платит банку 30'} onClick={() => set({ placing: 'ghostTrap', sheet: null })} data-testid="ghost-trap">
          <span>🚧</span>
          <small>Ловушка</small>
        </button>
        <button className="slot" disabled={!canPrank} title={why || 'Запретить владельцу улучшать объект на его следующий ход'} onClick={() => set({ placing: 'ghostBlock', sheet: null })}>
          <span>🚫</span>
          <small>Запрет</small>
        </button>
        <span className="energy" title="Энергия призрака">
          {'⚡'.repeat(me.ghostEnergy) || '—'}
        </span>
      </div>
    );
  }
  const preRoll = currentSeat(m) === me.seat && m.phase === 'PRE_ROLL';
  const slots = Array.from({ length: RULESET.inventorySlots }, (_, i) => me.items[i] ?? null);
  return (
    <div className="items">
      {slots.map((it, i) =>
        it ? (
          <button
            key={i}
            className="slot"
            title={`${ITEM_INFO[it].name}: ${ITEM_INFO[it].description}${it === 'cone' && !calm ? ' (ставится в свой ход)' : ''}`}
            disabled={it === 'cone' ? !calm : it === 'ticket' ? !preRoll : true}
            onClick={() => (it === 'cone' || it === 'ticket') && set({ placing: it, sheet: null })}
            data-testid={`item-${it}`}
          >
            <img className="slot-icon" src={`icons/fluent/item-${it}.png`} alt={ITEM_ICON[it]} />
            <small>{ITEM_INFO[it].name}</small>
          </button>
        ) : (
          <span key={i} className="slot empty" title="Пустой слот" />
        ),
      )}
    </div>
  );
}

function Duels() {
  const m = useMatch();
  const me = useMe();
  if (!me || me.role !== 'alive') return null;
  const calm = currentSeat(m) === me.seat && (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL');
  return (
    <button
      className="duels"
      disabled={!calm || me.duelTokens === 0}
      title={me.duelTokens === 0 ? 'Жетоны вызова закончились' : calm ? 'Вызвать соперника на дуэль за его объект' : 'Вызов — только в свой ход'}
      onClick={() => set({ sheet: { kind: 'duel' } })}
      data-testid="duel"
    >
      <span>⚔️</span>
      <span className="duels-label">Дуэли {me.duelTokens}</span>
      <span className="tokens">
        {Array.from({ length: RULESET.duelTokens }, (_, i) => (
          <i key={i} className={i < me.duelTokens ? 'on' : ''} />
        ))}
      </span>
    </button>
  );
}

export function ActionBar() {
  const m = useMatch();
  const me = useMe();
  const primary = usePrimary();
  const pending = useStore((s) => s.pending);
  const calm = currentSeat(m) === me?.seat && me?.role === 'alive' && (m.phase === 'PRE_ROLL' || m.phase === 'POST_ROLL');
  const canTrade = calm && m.turn.tradeOffers < RULESET.maxTradeOffersPerTurn;

  // Space = primary action (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement)?.tagName)) return;
      if (primary.cmd && (primary.testId === 'roll' || primary.testId === 'end-turn')) {
        e.preventDefault();
        void send(primary.cmd);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="actionbar">
      <div className="ab-row ab-info">
        <TileSummary />
        <Items />
        <Duels />
      </div>
      <div className="ab-row ab-main">
        <button className={`btn primary main-btn ${primary.cmd ? '' : 'idle'}`} disabled={!primary.cmd || pending > 0} onClick={() => primary.cmd && send(primary.cmd)} data-testid={primary.testId}>
          <span className="die-ico">🎲</span> {primary.label}
        </button>
        <button className="btn bar-btn" disabled={!canTrade} title={canTrade ? 'Предложить обмен' : 'Сделки — в спокойное окно своего хода (до 2 за ход)'} onClick={() => set({ sheet: { kind: 'trade' } })} data-testid="trade" aria-label="Сделка">
          🤝 <span>Сделка</span>
        </button>
        <button className="btn bar-btn wide-only" onClick={() => set({ sheet: { kind: 'assets' } })} data-testid="assets" aria-label="Улучшить">
          🏠 <span>Улучшить</span>
        </button>
        <button className="btn bar-btn" onClick={() => set({ sheet: { kind: 'menu' } })} data-testid="more" aria-label="Ещё">
          ⋯ <span>Ещё</span>
        </button>
      </div>
    </div>
  );
}
