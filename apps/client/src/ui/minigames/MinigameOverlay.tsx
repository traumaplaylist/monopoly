import { useEffect, useRef, useState } from 'react';
import { MEMORY, MINIGAME_INFO, REACTION } from '@pb/game-core';
import type { PublicMatch, PublicMinigame } from '@pb/game-core';
import { send } from '../../net/connection';
import { serverNow, useStore } from '../../state/store';
import { money, seatName, tileName } from '../format';
import { useMatch } from '../hooks';
import { Portrait } from '../Portrait';
import { playSound } from '../sound';

/** Fast server-synchronised clock for real-time mini-games. */
function useFastNow(): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

function Intro({ mg, m, me }: { mg: PublicMinigame; m: PublicMatch; me: string | null }) {
  const now = useFastNow();
  const left = Math.max(0, Math.ceil((mg.stageEndsAt - now) / 1000));
  const info = MINIGAME_INFO[mg.kind];
  const ready = me ? mg.ready.includes(me) : false;
  return (
    <div className="mg-intro">
      <h2>{info.title}</h2>
      {mg.context === 'duel' && m.duel && (
        <p className="duel-terms">
          ⚔ {seatName(m, m.duel.offer.buyer, me)} против {seatName(m, m.duel.offer.seller, me)} за «{tileName(m.duel.offer.tile)}»
        </p>
      )}
      <p>{info.rules}</p>
      {mg.context === 'group' && <p className="muted">Призы живым игрокам: 120 / 80 / 40 / 20. Призраки получают энергию.</p>}
      <div className="mg-ready-list">
        {mg.participants.map((s) => {
          const p = m.players.find((x) => x.seat === s)!;
          return (
            <span key={s} className={`chip ${mg.ready.includes(s) ? 'on' : ''}`}>
              <Portrait avatar={p.avatar} color={p.color} ghost={p.role === 'ghost'} size={22} /> {seatName(m, s, me)}
            </span>
          );
        })}
      </div>
      {me && mg.participants.includes(me) ? (
        <button className="btn primary big" disabled={ready} onClick={() => send({ type: 'MG_READY', minigameId: mg.id })} data-testid="mg-ready">
          {ready ? `Ждём остальных… ${left}` : `Готов! (${left})`}
        </button>
      ) : (
        <p className="muted">Вы зритель. Старт через {left} с.</p>
      )}
    </div>
  );
}

function Reaction({ mg, me }: { mg: PublicMinigame; me: string | null }) {
  const g = mg.game.kind === 'reaction' ? mg.game : null;
  const now = useFastNow();
  const [local, setLocal] = useState<Record<number, 'ok' | 'bad'>>({});
  if (!g) return null;
  const t = now - g.playStart;
  const order = [...g.orders].reverse().find((o) => o.from <= t) ?? g.orders[0]!;
  const active = g.signals.filter((s) => t >= s.at && t <= s.at + s.ttl);
  const myState = me ? g.players[me] : undefined;
  const participant = !!me && mg.participants.includes(me);
  const left = Math.max(0, Math.ceil((g.playEnd - now) / 1000));
  const tap = (id: number, target: boolean) => {
    if (!participant || local[id] || myState?.answered.includes(id)) return;
    setLocal((x) => ({ ...x, [id]: target ? 'ok' : 'bad' }));
    playSound(target ? 'tap' : 'error');
    void send({ type: 'MG_INPUT', minigameId: mg.id, value: id }, { quiet: true });
  };
  return (
    <div className="reaction">
      <div className="mg-top">
        <div className="order">
          Заказ: <span className="order-icon">{order.icon}</span>
        </div>
        <div className="mg-score">
          Очки: <b>{myState?.score ?? 0}</b>
        </div>
        <div className="timer">⏱ {left}</div>
      </div>
      <div className="slots" data-testid="reaction-slots">
        {Array.from({ length: REACTION.slots }, (_, slot) => {
          const sig = active.find((s) => s.slot === slot);
          const answered = sig && (local[sig.id] || myState?.answered.includes(sig.id));
          return (
            <button
              key={slot}
              className={`customer ${sig ? 'on' : ''} ${answered ? (local[sig!.id] ?? 'ok') : ''}`}
              disabled={!sig || !participant}
              onPointerDown={() => sig && tap(sig.id, sig.target)}
              data-target={sig?.target ? '1' : '0'}
              data-signal={sig?.id ?? ''}
            >
              {sig ? sig.icon : ''}
            </button>
          );
        })}
      </div>
      <p className="hint center">Нажимайте только «{order.icon}». Остальных пропускайте.</p>
    </div>
  );
}

function Memory({ mg, me }: { mg: PublicMinigame; me: string | null }) {
  const g = mg.game.kind === 'memory' ? mg.game : null;
  const now = useFastNow();
  const lastPos = useRef(-1);
  if (!g) return null;
  const r = g.rounds[g.round]!;
  const showing = now < r.showEnd && g.current;
  const stepIdx = showing ? Math.floor((now - r.showStart) / MEMORY.perStopShowMs) : -1;
  const lit = showing && stepIdx >= 0 && stepIdx < g.current!.length ? g.current![stepIdx] : null;
  const p = me ? g.players[me] : undefined;
  const participant = !!me && mg.participants.includes(me);
  const inputOpen = !showing && now >= r.showEnd && now < r.inputEnd && p && !p.done && !p.failed;
  if (p && p.pos !== lastPos.current) lastPos.current = p.pos;
  return (
    <div className="memory">
      <div className="mg-top">
        <div>
          Маршрут {g.round + 1} из {MEMORY.lengths.length}: <b>{r.length} остановок</b>
        </div>
        <div className="mg-score">
          Очки: <b>{p?.score ?? 0}</b>
        </div>
        <div className="timer">{showing ? 'Запоминайте!' : `⏱ ${Math.max(0, Math.ceil((r.inputEnd - now) / 1000))}`}</div>
      </div>
      <div className="stops" data-testid="memory-stops">
        {g.stops.map((icon, i) => (
          <button
            key={i}
            className={`stop ${lit === i ? 'lit' : ''}`}
            disabled={!participant || !inputOpen}
            onPointerDown={() => {
              playSound('tap');
              void send({ type: 'MG_INPUT', minigameId: mg.id, value: i }, { quiet: true });
            }}
            data-stop={i}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="progress">
        {Array.from({ length: r.length }, (_, k) => (
          <i key={k} className={p && k < p.pos ? 'ok' : ''} />
        ))}
      </div>
      <p className="hint center">
        {showing ? 'Смотрите на подсвеченные остановки по порядку.' : p?.done ? 'Маршрут пройден! Ждём остальных.' : p?.failed ? 'Ошибка — ждите следующий маршрут.' : 'Повторите маршрут.'}
      </p>
    </div>
  );
}

function Results({ mg, m, me }: { mg: PublicMinigame; m: PublicMatch; me: string | null }) {
  const rows = [...(mg.results ?? [])].sort((a, b) => b.score - a.score);
  const duel = mg.context === 'duel' ? m.duel : null;
  useEffect(() => {
    playSound('win');
  }, []);
  return (
    <div className="mg-results" data-testid="mg-results">
      <h2>Результаты</h2>
      {duel && (
        <p className="duel-terms">
          {duel.outcome === 'draw'
            ? 'Ничья — сделки нет, жетон возвращён'
            : duel.outcome === 'buyerWon'
              ? `Победил ${seatName(m, duel.offer.buyer, me)}: «${tileName(duel.offer.tile)}» за ${money(duel.offer.priceIfBuyerWins)}`
              : `Победил ${seatName(m, duel.offer.seller, me)}: «${tileName(duel.offer.tile)}» уходит за ${money(duel.offer.priceIfSellerWins)}`}
        </p>
      )}
      <table className="results">
        <tbody>
          {rows.map((r) => {
            const p = m.players.find((x) => x.seat === r.seat)!;
            return (
              <tr key={r.seat} className={r.seat === me ? 'me' : ''}>
                <td>{r.place ?? (r.ghost ? '👻' : '—')}</td>
                <td>
                  <Portrait avatar={p.avatar} color={p.color} ghost={r.ghost} size={24} /> {seatName(m, r.seat, me)}
                </td>
                <td>{r.participated ? `${r.score} очк.` : 'не играл'}</td>
                <td>{mg.context === 'group' ? (r.ghost ? (r.participated ? '+1 ⚡' : '') : r.prize ? `+${money(r.prize)}` : '') : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MinigameOverlay() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const mg = m.minigame;
  if (!mg) return null;
  const participant = !!me && mg.participants.includes(me);
  return (
    <div className={`mg-layer ${participant ? '' : 'spectator'}`} data-testid="minigame">
      <div className="mg-card panel">
        <div className="mg-label">{mg.context === 'duel' ? '⚔ ДУЭЛЬ' : '🎮 МИНИ-ИГРА'}</div>
        {mg.stage === 'intro' && <Intro mg={mg} m={m} me={me} />}
        {mg.stage === 'play' && (mg.kind === 'reaction' ? <Reaction mg={mg} me={me} /> : <Memory mg={mg} me={me} />)}
        {mg.stage === 'results' && <Results mg={mg} m={m} me={me} />}
        {!participant && mg.stage === 'play' && <p className="muted center">Вы наблюдаете: играют {mg.participants.map((s) => seatName(m, s, me)).join(' и ')}.</p>}
      </div>
    </div>
  );
}
