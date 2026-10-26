import { useEffect, useState } from 'react';
import { api } from '../net/connection';
import { storage } from '../net/util';
import { useStore } from '../state/store';
import { unlockAudio } from './sound';

function codeFromUrl(): string {
  try {
    return (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  } catch {
    return '';
  }
}

export function Home() {
  const conn = useStore((s) => s.conn);
  const [name, setName] = useState(storage.name() || '');
  const [code, setCode] = useState(codeFromUrl());
  const [busy, setBusy] = useState(false);
  const online = conn === 'online';
  const nameOk = name.trim().length >= 1;

  useEffect(() => {
    // Invite link with a saved name: join right away.
    if (online && code && storage.name()) void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  async function withName(fn: () => Promise<unknown>) {
    unlockAudio();
    setBusy(true);
    try {
      await api.setName(name.trim().slice(0, 16));
      await fn();
    } finally {
      setBusy(false);
    }
  }
  const create = () => withName(() => api.create({ minigameEvery: 2 }));
  const join = () => withName(() => api.join(code));

  return (
    <div className="home">
      <div className="home-card panel">
        <div className="logo">
          <span className="logo-mark">▦</span>
          <div>
            <h1>МЕГАПОЛИС</h1>
            <p>Party Board · онлайн-стол на четверых</p>
          </div>
        </div>
        <label className="field">
          <span>Ваше имя</span>
          <input value={name} maxLength={16} placeholder="Как вас зовут?" onChange={(e) => setName(e.target.value)} data-testid="name" autoComplete="nickname" />
        </label>
        <button className="btn primary big" disabled={!online || !nameOk || busy} onClick={create} data-testid="create">
          Создать комнату
        </button>
        <div className="divider">или войти по коду</div>
        <div className="row">
          <input
            className="code-input"
            value={code}
            maxLength={6}
            placeholder="КОД"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            data-testid="code"
            autoCapitalize="characters"
          />
          <button className="btn" disabled={!online || !nameOk || code.length < 4 || busy} onClick={join} data-testid="join">
            Войти
          </button>
        </div>
        {!nameOk && <p className="hint">Введите имя, чтобы создать комнату или войти.</p>}
        {!online && <p className="hint warn">{conn === 'connecting' ? 'Подключаемся к серверу…' : 'Нет связи с сервером. Проверьте, что сервер запущен.'}</p>}
      </div>
    </div>
  );
}
