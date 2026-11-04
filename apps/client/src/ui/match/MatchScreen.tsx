import { useEffect, useRef } from 'react';
import { GROUPS, WORLD, WORLD_EVENTS } from '@pb/content';
import { worldEventText } from '../format';
import { Scene } from '../../render/Scene';
import { setCanvasElement, setStageElement } from '../../render/stage';
import { useStore } from '../../state/store';
import { MinigameOverlay } from '../minigames/MinigameOverlay';
import { Sheets } from '../sheets/Sheets';
import { playSound } from '../sound';
import { currentSeat, useMatch } from '../hooks';
import { ActionBar, TileSummary } from './ActionBar';
import { Banner } from './Banner';
import { ChanceCardPopup, FinishedOverlay, GhostNotice, PendingItemModal, WorldEventPopup } from './Overlays';
import { PlayerCards } from './PlayerCards';
import { Prompt } from './Prompt';

/** Current world event as a chip in the top bar (full text in the tooltip). */
function EventChip() {
  const m = useMatch();
  const e = m.worldEvent && m.worldEvent.round === m.round ? m.worldEvent : null;
  const d = e ? WORLD_EVENTS.find((x) => x.kind === e.kind) : null;
  if (!e || !d) return null;
  return (
    <div className="badge-event" title={worldEventText(e.kind, e.group)} data-testid="event-chip">
      {d.icon} {d.title}
      {e.group ? ` · ${GROUPS[e.group].name}` : ''}
    </div>
  );
}

function TopBar() {
  const m = useMatch();
  const conn = useStore((s) => s.conn);
  return (
    <header className="topbar">
      <div className="badge-title">
        <span className="logo-mark">◆</span> {WORLD.name.toUpperCase()}
      </div>
      <EventChip />
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
      <div className="table-layer" ref={setCanvasElement}>
        <Scene />
      </div>
      <TopBar />
      <aside className="side">
        <PlayerCards />
        <div className="side-tile">
          <TileSummary />
        </div>
      </aside>
      <main className="stage" ref={setStageElement}>
        <Banner />
        <Prompt />
        <ChanceCardPopup />
        <WorldEventPopup />
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
