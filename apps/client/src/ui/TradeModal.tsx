import { useMemo, useState } from 'react';
import { GROUPS, isTradeableTile, ownedTiles, tile } from '../engine';
import type { Action, PlayerId, TradeSide } from '../engine';
import { useGame } from '../game/store';
import { errorText, money } from './format';
import { useGameState, useMe } from './hooks';
import { validate } from '../engine';

function TileChecklist({ owner, picked, toggle }: { owner: PlayerId; picked: number[]; toggle: (t: number) => void }) {
  const state = useGameState();
  const tiles = ownedTiles(state, owner);
  if (tiles.length === 0) return <p className="hint">Нет имущества</p>;
  return (
    <div className="checklist">
      {tiles.map((i) => {
        const t = tile(i);
        const allowed = isTradeableTile(state, owner, i);
        const color = t.group ? GROUPS[t.group].color : '#9aa7c7';
        return (
          <label key={i} className={allowed ? '' : 'disabled'} title={allowed ? '' : 'В группе есть постройки'}>
            <input type="checkbox" disabled={!allowed} checked={picked.includes(i)} onChange={() => toggle(i)} />
            <span className="swatch" style={{ background: color }} />
            {t.name}
            {state.ownership[i]!.mortgaged && <small> (залог)</small>}
          </label>
        );
      })}
    </div>
  );
}

const emptySide = (): TradeSide => ({ cash: 0, tiles: [], jailCards: 0 });

export function TradeModal() {
  const state = useGameState();
  const me = useMe();
  const open = useGame((s) => s.tradeOpen);
  const setOpen = useGame((s) => s.setTradeOpen);
  const dispatch = useGame((s) => s.dispatch);
  const others = state.players.filter((p) => !p.bankrupt && p.id !== me.id);
  const [partner, setPartner] = useState<PlayerId>(others[0]?.id ?? '');
  const [give, setGive] = useState<TradeSide>(emptySide);
  const [get, setGet] = useState<TradeSide>(emptySide);
  const partnerP = state.players.find((p) => p.id === partner) ?? others[0];

  const action: Action | null = partnerP ? { type: 'PROPOSE_TRADE', player: me.id, to: partnerP.id, give, get } : null;
  const error = useMemo(() => (action ? validate(state, action) : 'badTradePartner'), [state, action]);
  if (!open || !partnerP) return null;

  const toggle = (side: TradeSide, set: (s: TradeSide) => void) => (t: number) =>
    set({ ...side, tiles: side.tiles.includes(t) ? side.tiles.filter((x) => x !== t) : [...side.tiles, t] });

  return (
    <div className="modal-layer">
      <div className="modal trade" data-testid="trade-modal">
        <h3>Предложить сделку</h3>
        <div className="row">
          <span>С кем:</span>
          <select
            value={partnerP.id}
            onChange={(e) => {
              setPartner(e.target.value);
              setGet(emptySide());
            }}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({money(p.cash)})
              </option>
            ))}
          </select>
        </div>
        <div className="trade-cols">
          <div>
            <h4>Вы отдаёте</h4>
            <TileChecklist owner={me.id} picked={give.tiles} toggle={toggle(give, setGive)} />
            <label className="cash-input">
              Деньги
              <input
                type="number"
                min={0}
                max={me.cash}
                step={10}
                value={give.cash}
                onChange={(e) => setGive({ ...give, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
            </label>
            {me.jailCards.length > 0 && (
              <label className="cash-input">
                Карты выхода
                <input
                  type="number"
                  min={0}
                  max={me.jailCards.length}
                  value={give.jailCards}
                  onChange={(e) => setGive({ ...give, jailCards: Math.floor(Number(e.target.value) || 0) })}
                />
              </label>
            )}
          </div>
          <div>
            <h4>Вы получаете</h4>
            <TileChecklist owner={partnerP.id} picked={get.tiles} toggle={toggle(get, setGet)} />
            <label className="cash-input">
              Деньги
              <input
                type="number"
                min={0}
                max={partnerP.cash}
                step={10}
                value={get.cash}
                onChange={(e) => setGet({ ...get, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
            </label>
            {partnerP.jailCards.length > 0 && (
              <label className="cash-input">
                Карты выхода
                <input
                  type="number"
                  min={0}
                  max={partnerP.jailCards.length}
                  value={get.jailCards}
                  onChange={(e) => setGet({ ...get, jailCards: Math.floor(Number(e.target.value) || 0) })}
                />
              </label>
            )}
          </div>
        </div>
        {error && <p className="hint warn">{errorText(error)}</p>}
        <div className="row">
          <button
            className="btn primary"
            disabled={!!error}
            onClick={() => {
              if (action && dispatch(action)) {
                setGive(emptySide());
                setGet(emptySide());
                setOpen(false);
              }
            }}
          >
            Предложить
          </button>
          <button className="btn" onClick={() => setOpen(false)}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
