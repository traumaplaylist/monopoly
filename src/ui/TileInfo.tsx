import { GROUPS, mortgageValue, tile, unmortgageCost } from '../engine';
import type { Action } from '../engine';
import { useGame } from '../game/store';
import { money, playerName } from './format';
import { canDo, useGameState, useMe, useMyTurnReady } from './hooks';

const KIND_LABEL: Record<string, string> = {
  start: 'Старт',
  transport: 'Транспортный узел',
  utility: 'Энергостанция',
  tax: 'Налог',
  card: 'Карточка',
  jail: 'Карантин',
  rest: 'Отдых',
  goToJail: 'Санконтроль',
};

export function TileInfo() {
  const state = useGameState();
  const me = useMe();
  const ready = useMyTurnReady();
  const selected = useGame((s) => s.selectedTile);
  const selectTile = useGame((s) => s.selectTile);
  const dispatch = useGame((s) => s.dispatch);
  if (selected === null) return null;
  const t = tile(selected);
  const o = state.ownership[selected];
  const group = t.group ? GROUPS[t.group] : null;
  const mine = o?.owner === me.id;
  const btn = (label: string, action: Action, title?: string) => (
    <button className="btn small" disabled={!ready || !canDo(state, action)} onClick={() => dispatch(action)} title={title}>
      {label}
    </button>
  );

  return (
    <div className="tile-info" data-testid="tile-info">
      <div className={`tile-head ${group ? '' : 'plain'}`} style={{ background: group?.color ?? '#2a3a6a' }}>
        <span>{t.name}</span>
        <button className="close" onClick={() => selectTile(null)} aria-label="Закрыть">
          ×
        </button>
      </div>
      <div className="tile-body">
        <div className="muted">{group ? group.name : KIND_LABEL[t.kind]}</div>
        {t.price !== undefined && (
          <div className="kv">
            <span>Цена</span>
            <b>{money(t.price)}</b>
          </div>
        )}
        {t.kind === 'property' && (
          <table className="rent">
            <tbody>
              <tr className={o?.houses === 0 ? 'on' : ''}>
                <td>Аренда (полная группа ×2)</td>
                <td>{money(t.rent![0]!)}</td>
              </tr>
              {[1, 2, 3, 4].map((h) => (
                <tr key={h} className={o?.houses === h ? 'on' : ''}>
                  <td>С модулями: {h}</td>
                  <td>{money(t.rent![h]!)}</td>
                </tr>
              ))}
              <tr className={o?.houses === 5 ? 'on' : ''}>
                <td>Со станцией</td>
                <td>{money(t.rent![5]!)}</td>
              </tr>
              <tr>
                <td>Модуль / станция стоят</td>
                <td>{money(t.houseCost!)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {t.kind === 'transport' && <p className="muted">Аренда: 25 / 50 / 100 / 200 за 1–4 узла у владельца.</p>}
        {t.kind === 'utility' && <p className="muted">Аренда: 4× сумма кубиков, при обеих станциях — 10×.</p>}
        {t.kind === 'tax' && <p className="muted">Заплатите {money(t.tax!)} банку.</p>}
        {o && (
          <>
            <div className="kv">
              <span>Залог / выкуп</span>
              <b>
                {money(mortgageValue(selected))} / {money(unmortgageCost(selected))}
              </b>
            </div>
            <div className="kv">
              <span>Владелец</span>
              <b>{o.owner ? playerName(state, o.owner) : 'банк (свободно)'}</b>
            </div>
            {o.mortgaged && <div className="tag">Заложено</div>}
          </>
        )}
        {mine && o && (
          <div className="row wrap">
            {t.kind === 'property' &&
              btn(
                o.houses === 4 ? 'Построить станцию' : 'Построить модуль',
                { type: 'BUILD', player: me.id, tile: selected },
                `−${money(t.houseCost!)}`,
              )}
            {t.kind === 'property' &&
              o.houses > 0 &&
              btn('Продать постройку', { type: 'SELL_BUILDING', player: me.id, tile: selected }, `+${money(t.houseCost! / 2)}`)}
            {!o.mortgaged &&
              btn(`Заложить +${money(mortgageValue(selected))}`, { type: 'MORTGAGE', player: me.id, tile: selected })}
            {o.mortgaged &&
              btn(`Выкупить −${money(unmortgageCost(selected))}`, { type: 'UNMORTGAGE', player: me.id, tile: selected })}
          </div>
        )}
      </div>
    </div>
  );
}
