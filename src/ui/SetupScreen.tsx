import { useState } from 'react';
import { useGame } from '../game/store';
import { loadGame } from '../game/persistence';

export function SetupScreen() {
  const newGame = useGame((s) => s.newGame);
  const continueSaved = useGame((s) => s.continueSaved);
  const [name, setName] = useState('Капитан');
  const [bots, setBots] = useState(3);
  const [startCash, setStartCash] = useState(1500);
  const [maxTurns, setMaxTurns] = useState(0);
  const [botDelay, setBotDelay] = useState(700);
  const [seed, setSeed] = useState('');
  const hasSave = loadGame() !== null;

  const start = () => {
    const parsed = Number.parseInt(seed, 10);
    newGame({
      playerName: name,
      bots,
      startCash,
      maxTurns,
      botDelay,
      seed: Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 1e9),
    });
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>
          Орбитальный <span>капитал</span>
        </h1>
        <p className="tagline">Экономическая стратегия о колонизации Солнечной системы</p>
        {hasSave && (
          <button className="btn primary wide" onClick={() => continueSaved()} data-testid="continue">
            Продолжить сохранённую партию
          </button>
        )}
        <div className="form">
          <label>
            Ваше имя
            <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Соперники-боты: <b>{bots}</b>
            <input
              type="range"
              min={1}
              max={5}
              value={bots}
              onChange={(e) => setBots(Number(e.target.value))}
              data-testid="bots"
            />
          </label>
          <label>
            Стартовый капитал
            <select value={startCash} onChange={(e) => setStartCash(Number(e.target.value))}>
              <option value={1000}>₡1 000 — быстрая игра</option>
              <option value={1500}>₡1 500 — стандарт</option>
              <option value={2000}>₡2 000 — долгая игра</option>
            </select>
          </label>
          <label>
            Лимит ходов
            <select value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))}>
              <option value={0}>Без лимита — до последнего</option>
              <option value={120}>120 ходов — побеждает самый богатый</option>
              <option value={240}>240 ходов</option>
            </select>
          </label>
          <label>
            Скорость ботов
            <select value={botDelay} onChange={(e) => setBotDelay(Number(e.target.value))}>
              <option value={1200}>Медленно</option>
              <option value={700}>Нормально</option>
              <option value={250}>Быстро</option>
            </select>
          </label>
          <label>
            Seed партии (необязательно)
            <input
              value={seed}
              inputMode="numeric"
              placeholder="случайный"
              onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <button className="btn primary wide big" onClick={start} data-testid="start">
          Новая партия
        </button>
      </div>
    </div>
  );
}
