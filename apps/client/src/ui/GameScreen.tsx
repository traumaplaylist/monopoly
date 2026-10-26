import { useState } from 'react';
import { useBotRunner } from '../game/useBotRunner';
import { Scene } from '../render/Scene';
import { BoardOverlays } from './BoardOverlays';
import { BottomBar } from './BottomBar';
import type { DrawerTab } from './BottomBar';
import { Drawer } from './Drawer';
import { AuctionModal, CardPopup, ErrorToast, GameOverModal, IncomingTradeModal } from './Modals';
import { PlayerCards } from './PlayerCards';
import { TradeModal } from './TradeModal';

export function GameScreen() {
  useBotRunner();
  const [drawer, setDrawer] = useState<DrawerTab | null>(null);
  return (
    <div className="game">
      <div className="stage">
        <Scene />
        <BoardOverlays />
        <CardPopup />
        <ErrorToast />
      </div>
      <aside className="side">
        <PlayerCards />
        <button className="gear" onClick={() => setDrawer('settings')} title="Настройки" aria-label="Настройки">
          ⚙
        </button>
      </aside>
      <BottomBar onOpen={setDrawer} />
      {drawer && <Drawer tab={drawer} onTab={setDrawer} onClose={() => setDrawer(null)} />}
      <AuctionModal />
      <IncomingTradeModal />
      <TradeModal />
      <GameOverModal />
      <div className="rotate-hint">📱↻ Поверните телефон горизонтально — так поле крупнее</div>
    </div>
  );
}
