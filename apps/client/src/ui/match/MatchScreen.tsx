import { useEffect, useRef } from 'react';
import { MEGAPOLIS } from '@pb/content';
import { Scene } from '../../render/Scene';
import { useStore } from '../../state/store';
import { MinigameOverlay } from '../minigames/MinigameOverlay';
import { Sheets } from '../sheets/Sheets';
import { playSound } from '../sound';
import { currentSeat, useMatch } from '../hooks';
import { ActionBar, TileSummary } from './ActionBar';
import { Banner } from './Banner';
import { ChanceCardPopup, FinishedOverlay, GhostNotice, PendingItemModal } from './Overlays';
import { PlayerCards } from './PlayerCards';
import { Prompt } from './Prompt';

function TopBar() {
  const m = useMatch();
  const conn = useStore((s) => s.conn);
  return (
    <header className="topbar">
      <div className="badge-title">
        <span className="logo-mark">▦</span> {MEGAPOLIS.name.toUpperCase()}
      </div>
      <div className="badge-round" data-testid="round">
        Раунд <b>{Math.min(m.round, m.settings.maxRounds)}</b> / {m.settings.maxRounds}
      </div>
      <span className={`net ${conn}`} title={conn === 'online' ? 'Связь в порядке' : 'Нет связи'} />
    </header>
  );
}

/** Sound cue when it becomes my turn. */
function useTurnCue() {
  const m = useMatch();
  const me = useStore((s) => s.seat);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== m.turn.seq && currentSeat(m) === me && m.phase === 'PRE_ROLL') playSound('turn');
    prev.current = m.turn.seq;
  }, [m, me]);
}

export function MatchScreen() {
  useTurnCue();
  return (
    <div className="match">
      <TopBar />
      <aside className="side">
        <PlayerCards />
        <div className="side-tile">
          <TileSummary />
        </div>
      </aside>
      <main className="stage">
        <Scene />
        <Banner />
        <Prompt />
        <ChanceCardPopup />
      </main>
      <ActionBar />
      <Sheets />
      <MinigameOverlay />
      <PendingItemModal />
      <GhostNotice />
      <FinishedOverlay />
    </div>
  );
}
