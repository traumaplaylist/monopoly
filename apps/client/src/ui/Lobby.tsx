import { useState } from 'react';
import { MAPS, RULESET } from '@pb/content';
import type { RoomSettings } from '@pb/protocol';
import { api } from '../net/connection';
import { toast, useStore } from '../state/store';
import { Portrait } from './Portrait';
import { useRestoreAppearance } from './Wardrobe';
import { set as setUi } from '../state/store';

const SEAT_COLORS = ['#e2574c', '#2a9d9a', '#e8a33a', '#8a52c9'];
const MAP_ICON: Record<string, string> = { random: 'dice', world: 'plane', russia: 'dolls', space: 'saturn' };

export function Lobby() {
  const room = useStore((s) => s.room)!;
  const seat = useStore((s) => s.seat);
  const me = room.seats.find((s) => s.seat === seat);
  const isHost = !!me?.isHost;
  const humans = room.seats.filter((s) => !s.isBot);
  const allReady = humans.every((s) => s.ready);
  const allOnline = humans.every((s) => s.connected);
  const debug = !!room.settings.bots || (!!room.settings.debugBots && room.devMode);
  const [copied, setCopied] = useState(false);
  const quick = room.settings.length === 'quick';

  const startReason = !isHost
    ? 'Начать игру может хозяин комнаты'
    : !debug && room.seats.length < RULESET.seats
      ? `Ждём игроков: ${room.seats.length} из ${RULESET.seats} — или включите ботов`
      : !allReady
        ? 'Не все нажали «Готов»'
        : !allOnline
          ? 'Кто-то из игроков не в сети'
          : null;

  const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(`Ссылка: ${link}`);
    }
  }
  const setSettings = (patch: Partial<RoomSettings>) => api.settings({ ...room.settings, ...patch });
  useRestoreAppearance(me?.appearance);

  return (
    <div className="lobby">
      <div className="lobby-card panel">
        <div className="lobby-head">
          <div>
            <div className="muted">Код комнаты</div>
            <div className="room-code" data-testid="room-code">
              {room.code}
            </div>
          </div>
          <button className="btn" onClick={copy}>
            {copied ? 'Скопировано ✓' : 'Скопировать ссылку'}
          </button>
        </div>

        <div className="seats">
          {[0, 1, 2, 3].map((i) => {
            const s = room.seats.find((x) => x.seat === `s${i}`);
            return (
              <div key={i} className={`seat-card ${s ? '' : 'empty'} ${s?.seat === seat ? 'me' : ''}`}>
                {s ? (
                  <>
                    <Portrait avatar={s.avatar} color={SEAT_COLORS[i]!} size={52} appearance={s.appearance} />
                    <div className="seat-info">
                      <b>
                        {s.name}
                        {s.isHost && <span title="Хозяин комнаты"> 👑</span>}
                      </b>
                      <span className={s.ready ? 'ok' : 'muted'}>{s.isBot ? '🤖 бот' : s.ready ? 'готов' : 'не готов'}</span>
                    </div>
                    <span className={`dot ${s.connected ? 'on' : 'off'}`} title={s.connected ? 'в сети' : 'не в сети'} />
                  </>
                ) : (
                  <span className="muted">Свободное место — отправьте другу код или ссылку</span>
                )}
              </div>
            );
          })}
        </div>

        {me && (
          <div className="section">
            <div className="muted">Ваш персонаж на поле</div>
            <button className="btn big wd-open" onClick={() => setUi({ wardrobe: true })} data-testid="open-wardrobe">
              👕 Открыть гардероб
            </button>
          </div>
        )}

        <div className="section">
          <div className="muted">Карта {isHost ? '' : '(выбирает хозяин)'}</div>
          <div className="map-pick" data-testid="map-pick">
            {[{ id: 'random', name: 'Случайная', tagline: 'выпадет при старте' }, ...MAPS].map((mp) => (
              <button
                key={mp.id}
                className={`map-opt map-${mp.id} ${(room.settings.map ?? 'random') === mp.id ? 'on' : ''}`}
                disabled={!isHost}
                onClick={() => setSettings({ map: mp.id })}
                data-testid={`map-${mp.id}`}
              >
                <img src={`icons/fluent/${MAP_ICON[mp.id] ?? 'dice'}.png`} alt="" />
                <b>{mp.name}</b>
                <small>{mp.tagline}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="muted">Длина партии</div>
          <div className="seg">
            <button className={room.settings.length !== 'quick' ? 'on' : ''} disabled={!isHost} onClick={() => setSettings({ length: 'normal' })} data-testid="length-normal">
              Обычная · {RULESET.maxRounds} раундов
            </button>
            <button className={room.settings.length === 'quick' ? 'on' : ''} disabled={!isHost} onClick={() => setSettings({ length: 'quick' })} data-testid="length-quick">
              ⚡ Быстрая · {RULESET.quick.maxRounds} раундов
            </button>
          </div>
        </div>

        <div className="section">
          <div className="muted">Общая мини-игра {isHost ? '' : '(настраивает хозяин)'}</div>
          <div className="seg">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={room.settings.minigameEvery === n ? 'on' : ''} disabled={!isHost} onClick={() => setSettings({ minigameEvery: n })}>
                каждый {n === 1 ? '' : n === 2 ? '2-й ' : '3-й '}раунд
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={!!room.settings.bots} disabled={!isHost} onChange={(e) => setSettings({ bots: e.target.checked })} data-testid="fill-bots" />
            <span>🤖 Добавить ботов на свободные места (можно играть вдвоём или втроём)</span>
          </label>
          <p className="hint">Если кто-то выйдет из партии или пропадёт со связью больше чем на 45 с, за него сыграет бот, пока он не вернётся.</p>
          <p className="hint">
            Партия: {quick ? RULESET.quick.maxRounds : RULESET.maxRounds} раундов (~{quick ? '20–25' : '40–50'} мин), старт {quick ? RULESET.quick.startCash : RULESET.startCash} монет{quick ? ` и по ${RULESET.quick.dealTiles} случайных объекта` : ''}, 3 жетона дуэли, щит у каждого.
          </p>
        </div>

        <div className="lobby-actions">
          <button className={`btn big ${me?.ready ? '' : 'primary'}`} onClick={() => api.ready(!me?.ready)} data-testid="ready">
            {me?.ready ? 'Не готов' : 'Готов'}
          </button>
          <button className="btn big primary" disabled={!!startReason} title={startReason ?? ''} onClick={() => api.start()} data-testid="start">
            Начать игру
          </button>
        </div>
        {startReason && <p className="hint center">{startReason}</p>}
        <button className="btn ghost-btn" onClick={() => api.leave()}>
          Выйти из комнаты
        </button>
      </div>
    </div>
  );
}
