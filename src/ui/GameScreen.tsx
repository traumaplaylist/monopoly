import { useState } from 'react';
import { useGame } from '../game/store';
import { useBotRunner } from '../game/useBotRunner';
import { Scene } from '../render/Scene';
import { ActionPanel } from './ActionPanel';
import { AssetsPanel } from './AssetsPanel';
import { LogPanel } from './LogPanel';
import { AuctionModal, CardPopup, ErrorToast, GameOverModal, IncomingTradeModal } from './Modals';
import { PlayersPanel } from './PlayersPanel';
import { TileInfo } from './TileInfo';
import { TradeModal } from './TradeModal';
import { useGameState } from './hooks';

export function GameScreen() {
  useBotRunner();
  const state = useGameState();
  const quit = useGame((s) => s.quitToMenu);
  const botDelay = useGame((s) => s.botDelay);
  const setBotDelay = useGame((s) => s.setBotDelay);
  const [tab, setTab] = useState<'assets' | 'log'>('log');
  return (
    <div className="game">
      <div className="stage">
        <Scene />
        <CardPopup />
        <ErrorToast />
        <div className="stage-top">
          <button className="btn small ghost" onClick={quit} title="Партия сохранена">
            ☰ Меню
          </button>
          <span className="turn-no">Ход {state.turn}</span>
          <select className="speed" value={botDelay} onChange={(e) => setBotDelay(Number(e.target.value))} title="Скорость ботов">
            <option value={1200}>🐢</option>
            <option value={700}>▶</option>
            <option value={250}>⏩</option>
          </select>
        </div>
      </div>
      <aside className="hud">
        <PlayersPanel />
        <ActionPanel />
        <TileInfo />
        <div className="tabs">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
            Журнал
          </button>
          <button className={tab === 'assets' ? 'on' : ''} onClick={() => setTab('assets')} data-testid="tab-assets">
            Мои активы
          </button>
        </div>
        <div className="tab-body">{tab === 'log' ? <LogPanel /> : <AssetsPanel />}</div>
      </aside>
      <AuctionModal />
      <IncomingTradeModal />
      <TradeModal />
      <GameOverModal />
    </div>
  );
}
