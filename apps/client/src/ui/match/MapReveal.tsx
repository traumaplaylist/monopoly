// Start of a match: the board is announced. With «Случайная» the names spin like a roulette first.
// Shown once per match (sessionStorage), only in round 1; purely visual.
import { useEffect, useState } from 'react';
import { MAPS } from '@pb/content';
import { useStore } from '../../state/store';
import { useMapDef } from '../mapNow';
import { playSound } from '../sound';

const ICON: Record<string, string> = { world: 'plane', russia: 'dolls', space: 'saturn' };
const SPIN_MS = 1700;
const HOLD_MS = 2300;

/** matchId → reveal state; module-level so React StrictMode double effects do not restart it. */
const runs = new Map<string, { elapsed: number; last: number; born: number; settledSound: boolean; closed: boolean }>();
/** Hard wall-clock limit: on a slow device the frame-based timer must not keep the board covered. */
const WALL_MAX_MS = 6000;
/** Longest step counted per tick: time the page spent frozen (loading the 3D board) does not count. */
const MAX_STEP = 100;

function seenBefore(id: string): boolean {
  try {
    if (sessionStorage.getItem(`pb-map-${id}`) === '1') return true;
    sessionStorage.setItem(`pb-map-${id}`, '1');
  } catch {
    /* private mode: may show again after a reload — harmless */
  }
  return false;
}

export function MapReveal() {
  const matchId = useStore((s) => s.match?.matchId ?? null);
  const round = useStore((s) => s.match?.round ?? 0);
  const random = useStore((s) => (s.room?.settings.map ?? 'random') === 'random');
  const map = useMapDef();
  const [, tick] = useState(0);

  if (matchId && round === 1 && !runs.has(matchId)) {
    const fresh = !seenBefore(matchId);
    runs.set(matchId, { elapsed: 0, last: performance.now(), born: performance.now(), settledSound: !fresh, closed: !fresh });
    if (fresh) playSound(random ? 'roulette' : 'event');
  }
  const run = matchId ? runs.get(matchId) : undefined;
  if (run && !run.closed) {
    const now = performance.now();
    run.elapsed += Math.min(MAX_STEP, now - run.last);
    run.last = now;
    if (now - run.born > WALL_MAX_MS) run.closed = true;
  }
  const elapsed = run ? run.elapsed : Infinity;
  const spinMs = random ? SPIN_MS : 0;
  const show = !!run && !run.closed && elapsed < spinMs + HOLD_MS;

  useEffect(() => {
    if (!show) return;
    const t = setInterval(() => tick((n) => n + 1), 60);
    return () => clearInterval(t);
  }, [show]);

  const settled = elapsed >= spinMs;
  if (show && settled && run && !run.settledSound) {
    run.settledSound = true;
    playSound('event');
  }
  // Decelerating spin: index grows like sqrt of time.
  const spin = Math.floor(Math.sqrt(Math.max(0, elapsed)) / 3);
  const close = () => {
    if (run) run.closed = true;
    tick((n) => n + 1);
  };

  if (!show) return null;
  const shown = settled ? map : MAPS[spin % MAPS.length]!;
  return (
    <div className="map-reveal" onClick={close} data-testid="map-reveal">
      <div className={`mr-card ${settled ? 'settled' : 'spinning'}`}>
        <div className="mr-kicker">{random ? (settled ? 'Выпала карта' : 'Выбираем карту…') : 'Карта'}</div>
        <img src={`icons/fluent/${ICON[shown.id] ?? 'dice'}.png`} alt="" />
        <div className="mr-name">{shown.name}</div>
        {settled && <div className="mr-tag">{map.tagline}</div>}
      </div>
    </div>
  );
}
