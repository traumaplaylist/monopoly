import { useEffect, useState } from 'react';
import { CHANCE_CARDS, ITEM_INFO } from '@pb/content';
import { api, reclaim, send } from '../../net/connection';
import { set, useStore } from '../../state/store';
import { money, seatName } from '../format';
import { useMatch, useMe } from '../hooks';
import { Portrait } from '../Portrait';
import { playSound } from '../sound';

export function ChanceCardPopup() {
  const card = useStore((s) => s.chanceCard);
  const m = useStore((s) => s.match);
  const me = useStore((s) => s.seat);
  useEffect(() => {
    if (!card) return;
    playSound('coin');
    const t = setTimeout(() => set({ chanceCard: null }), 3500);
    return () => clearTimeout(t);
  }, [card]);
  if (!card) return null;
  const c = CHANCE_CARDS.find((x) => x.id === card.id);
  if (!c) return null;
  return (
    <div className="chance-card" onClick={() => set({ chanceCard: null })} data-testid="chance-card">
      <div className="cc-deck">Шанс · {seatName(m, card.seat, me)}</div>
      <div className="cc-title">{c.title}</div>
      <div>{c.text}</div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => set({ toast: null }), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status">
      {toast.text}
    </div>
  );
}

export function ConnBanner() {
  const conn = useStore((s) => s.conn);
  if (conn === 'online') return null;
  if (conn === 'replaced') {
    return (
      <div className="conn-banner replaced" role="alert">
        Ваше место открыто на другом устройстве или вкладке.
        <button className="btn" onClick={reclaim}>
          Играть здесь
        </button>
      </div>
    );
  }
  return (
    <div className="conn-banner" role="alert" data-testid="conn-banner">
      {conn === 'connecting' ? 'Подключаемся к серверу…' : 'Связь потеряна — переподключаемся. Ваше место сохраняется, таймеры идут.'}
    </div>
  );
}

/** One-time explanation when the local player becomes a ghost. */
export function GhostNotice() {
  const me = useMe();
  const [seen, setSeen] = useState(false);
  if (!me || me.role !== 'ghost' || seen) return null;
  return (
    <div className="modal-layer">
      <div className="modal panel" data-testid="ghost-notice">
        <Portrait avatar={me.avatar} color={me.color} ghost size={72} />
        <h2>Вы — призрак</h2>
        <p>Деньги закончились, собственность вернулась банку. Но вы остаётесь за столом:</p>
        <ul>
          <li>играете в общие мини-игры (за участие +1 энергии);</li>
          <li>раз в раунд можете поставить ловушку или запретить сопернику улучшение;</li>
          <li>энергия: +1 каждый раунд, максимум 2.</li>
        </ul>
        <p className="muted">Главную экономическую гонку призрак не выигрывает, но его проделки попадут в итог.</p>
        <button className="btn primary big" onClick={() => setSeen(true)}>
          Понятно
        </button>
      </div>
    </div>
  );
}

export function PendingItemModal() {
  const priv = useStore((s) => s.priv);
  const me = useMe();
  const pi = priv?.pendingItem;
  if (!pi || !me) return null;
  return (
    <div className="modal-layer">
      <div className="modal panel">
        <h3>Новый предмет: {ITEM_INFO[pi.item].name}</h3>
        <p className="muted">Инвентарь полон (3 слота). Заменить какой-то предмет?</p>
        <div className="row wrap">
          {me.items.map((it, i) => (
            <button key={i} className="btn" onClick={() => send({ type: 'REPLACE_ITEM', drop: i })}>
              Заменить «{ITEM_INFO[it].name}»
            </button>
          ))}
          <button className="btn" onClick={() => send({ type: 'REPLACE_ITEM', drop: null })}>
            Отказаться
          </button>
        </div>
      </div>
    </div>
  );
}

export function FinishedOverlay() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const room = useStore((s) => s.room);
  useEffect(() => {
    if (m.phase === 'FINISHED') playSound('win');
  }, [m.phase]);
  if (m.phase !== 'FINISHED' || !m.standings) return null;
  const winners = m.standings.filter((s) => s.winner);
  const voted = !!me && !!room?.rematchVotes.includes(me);
  const humans = room?.seats.filter((s) => !s.isBot) ?? [];
  const minutes = m.finishedAt ? Math.round((m.finishedAt - m.startedAt) / 60000) : null;
  return (
    <div className="modal-layer">
      <div className="modal panel finished" data-testid="finished">
        <h2>🏆 {winners.length > 1 ? 'Совместная победа!' : `${seatName(m, winners[0]?.seat ?? null, me)} — победа!`}</h2>
        <table className="results">
          <tbody>
            {m.standings.map((s) => {
              const p = m.players.find((x) => x.seat === s.seat)!;
              return (
                <tr key={s.seat} className={s.seat === me ? 'me' : ''}>
                  <td>{s.rank ?? (s.role === 'ghost' ? '👻' : '—')}</td>
                  <td>
                    <Portrait avatar={p.avatar} color={p.color} ghost={s.role === 'ghost'} size={28} /> {seatName(m, s.seat, me)}
                  </td>
                  <td>{s.role === 'alive' ? `${money(s.value)} монет` : s.role === 'ghost' ? `проделок: ${s.pranks}` : 'вышел'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">
          Итог = деньги + 50% цены незаложенных объектов + 50% стоимости улучшений.
          {minutes !== null && ` Партия длилась ${minutes} мин.`}
        </p>
        <div className="row">
          <button className="btn primary big" disabled={voted} onClick={() => api.rematch()} data-testid="rematch">
            {voted ? `Ждём остальных (${room?.rematchVotes.length}/${humans.length})` : 'Реванш'}
          </button>
          <button className="btn" onClick={() => api.leave()}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
