import { useState } from 'react';
import { GROUPS, getActor, rentFor, tile } from '../engine';
import type { Action } from '../engine';
import { useGame } from '../game/store';
import { anchorRef } from '../render/BoardAnchor';
import { money, playerName } from './format';
import { canDo, useGameState, useMe, useMyTurnReady } from './hooks';
import { TileInfo } from './TileInfo';

function Banner() {
  const state = useGameState();
  const me = useMe();
  const actor = getActor(state);
  const max = state.settings.maxRounds;
  const text =
    state.phase === 'gameOver'
      ? 'ИГРА ОКОНЧЕНА'
      : actor === me.id
        ? state.phase === 'auction'
          ? 'ТВОЯ СТАВКА'
          : state.trade
            ? 'ОТВЕТЬ НА СДЕЛКУ'
            : 'ТВОЙ ХОД'
        : `ХОДИТ ${playerName(state, actor).toUpperCase()}`;
  return (
    <div className="banner" data-testid="banner">
      <div className="round">
        Раунд <b>{state.round}</b>
        {max > 0 && (
          <>
            {' '}
            / <b>{max}</b>
          </>
        )}
      </div>
      <div className="title">{text}</div>
    </div>
  );
}

/** Подсказка в центре поля: покупка, долг, карантин, ожидание ответа. */
function Prompt() {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const dispatch = useGame((s) => s.dispatch);
  const act = (a: Action) => dispatch(a);
  const can = (a: Action) => ready && canDo(state, a);

  if (state.trade && state.trade.from === me.id) {
    return (
      <div className="prompt">
        <div>Ждём ответа {playerName(state, state.trade.to)}…</div>
        <button className="btn small" onClick={() => act({ type: 'CANCEL_TRADE', player: me.id })}>
          Отозвать
        </button>
      </div>
    );
  }
  if (!ready) return null;

  if (state.phase === 'buy') {
    const t = tile(me.position);
    return (
      <div className="prompt">
        <div className="prompt-title">«{t.name}» свободна</div>
        <div className="muted">Купить за {money(t.price!)} или отправить на аукцион</div>
        <div className="row">
          <button
            className="btn primary"
            disabled={!can({ type: 'BUY', player: me.id })}
            onClick={() => act({ type: 'BUY', player: me.id })}
            data-testid="buy"
          >
            Купить {money(t.price!)}
          </button>
          <button className="btn" onClick={() => act({ type: 'DECLINE_BUY', player: me.id })} data-testid="decline">
            Аукцион
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === 'debt') {
    const d = state.debts[0]!;
    return (
      <div className="prompt danger">
        <div className="prompt-title">
          Долг {money(d.amount)} → {playerName(state, d.creditor)}
        </div>
        <div className="muted">Не хватает наличных. Продайте постройки или заложите клетки (клик по своей клетке).</div>
        <div className="row">
          <button
            className="btn primary"
            disabled={!can({ type: 'PAY_DEBT', player: me.id })}
            onClick={() => act({ type: 'PAY_DEBT', player: me.id })}
          >
            Оплатить
          </button>
          <button className="btn danger" onClick={() => act({ type: 'DECLARE_BANKRUPTCY', player: me.id })}>
            Банкротство
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === 'roll' && me.inJail && !state.trade) {
    return (
      <div className="prompt">
        <div className="prompt-title">Вы в карантине ({me.jailTurns}/3)</div>
        <div className="muted">Выбросьте дубль, заплатите штраф или используйте карту.</div>
        <div className="row">
          <button
            className="btn"
            disabled={!can({ type: 'PAY_JAIL_FINE', player: me.id })}
            onClick={() => act({ type: 'PAY_JAIL_FINE', player: me.id })}
          >
            Штраф {money(state.settings.jailFine)}
          </button>
          <button
            className="btn"
            disabled={!can({ type: 'USE_JAIL_CARD', player: me.id })}
            onClick={() => act({ type: 'USE_JAIL_CARD', player: me.id })}
          >
            Карта выхода
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === 'roll' && state.extraRoll) return <div className="prompt slim">Дубль! Бросай ещё раз</div>;
  return null;
}

/** Плашка клетки: выбранной или той, где стоит ходящий игрок. Раскрывается в полную карточку. */
function TileBar() {
  const state = useGameState();
  const selected = useGame((s) => s.selectedTile);
  const selectTile = useGame((s) => s.selectTile);
  const [open, setOpen] = useState(false);
  const index = selected ?? state.players[state.current]!.position;
  const t = tile(index);
  const o = state.ownership[index];
  const color = t.group ? GROUPS[t.group].color : '#cbbfa8';
  let info = '';
  if (o?.owner) info = o.mortgaged ? 'Заложено' : `Аренда ${money(rentFor(state, index, 7))}`;
  else if (t.price) info = `Цена ${money(t.price)}`;
  else if (t.tax) info = `Налог ${money(t.tax)}`;
  return (
    <div className="tilebar-wrap">
      {open && (
        <div className="tile-pop">
          <TileInfo index={index} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        className="tilebar"
        onClick={() => {
          if (selected === null) selectTile(index);
          setOpen(!open);
        }}
        data-testid="tilebar"
      >
        <span className="tb-swatch" style={{ background: color }} />
        <b>{t.name}</b>
        {info && <span className="tb-info">· {info}</span>}
        <span className="tb-caret">{open ? '▾' : '▴'}</span>
      </button>
    </div>
  );
}

export function BoardOverlays() {
  return (
    <>
      <div className="anchor" ref={anchorRef('banner')}>
        <Banner />
      </div>
      <div className="anchor" ref={anchorRef('prompt')}>
        <Prompt />
      </div>
      <div className="anchor" ref={anchorRef('tileBar')}>
        <TileBar />
      </div>
    </>
  );
}
