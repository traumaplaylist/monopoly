import { useState } from 'react';
import { RULESET } from '@pb/content';
import type { RoomSettings } from '@pb/protocol';
import { api } from '../net/connection';
import { AVATAR_NAMES, AVATARS } from '../render/pixelArt';
import { toast, useStore } from '../state/store';
import { Portrait } from './Portrait';

const SEAT_COLORS = ['#e2574c', '#2a9d9a', '#e8a33a', '#8a52c9'];

export function Lobby() {
  const room = useStore((s) => s.room)!;
  const seat = useStore((s) => s.seat);
  const me = room.seats.find((s) => s.seat === seat);
  const isHost = !!me?.isHost;
  const humans = room.seats.filter((s) => !s.isBot);
  const allReady = humans.every((s) => s.ready);
  const allOnline = humans.every((s) => s.connected);
  const debug = !!room.settings.debugBots && room.devMode;
  const [copied, setCopied] = useState(false);

  const startReason = !isHost
    ? 'Начать игру может хозяин комнаты'
    : !debug && room.seats.length < RULESET.seats
      ? `Ждём игроков: ${room.seats.length} из ${RULESET.seats}`
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
  const takenAvatars = new Set(room.seats.filter((s) => s.seat !== seat).map((s) => s.avatar));

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
                    <Portrait avatar={s.avatar} color={SEAT_COLORS[i]!} size={52} />
                    <div className="seat-info">
                      <b>
                        {s.name}
                        {s.isHost && <span title="Хозяин комнаты"> 👑</span>}
                      </b>
                      <span className={s.ready ? 'ok' : 'muted'}>{s.isBot ? 'бот (отладка)' : s.ready ? 'готов' : 'не готов'}</span>
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

        <div className="section">
          <div className="muted">Ваш персонаж</div>
          <div className="avatar-row">
            {AVATARS.map((_, a) => (
              <button
                key={a}
                className={`avatar-pick ${me?.avatar === a ? 'on' : ''}`}
                disabled={takenAvatars.has(a)}
                title={takenAvatars.has(a) ? 'Занят' : AVATAR_NAMES[a]}
                onClick={() => api.avatar(a)}
              >
                <Portrait avatar={a} color="#6b5aa0" size={44} />
              </button>
            ))}
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
          {room.devMode && (
            <label className="check">
              <input type="checkbox" checked={!!room.settings.debugBots} disabled={!isHost} onChange={(e) => setSettings({ debugBots: e.target.checked })} data-testid="debug-bots" />
              <span>Отладка: заполнить пустые места ботами (только режим разработки)</span>
            </label>
          )}
          <p className="hint">Партия: {RULESET.maxRounds} раундов, старт {RULESET.startCash} монет, 3 жетона дуэли, щит у каждого.</p>
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
