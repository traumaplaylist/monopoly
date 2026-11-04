// Plays sounds for fresh game events by watching the store (effects, cards, auctions, mini-games).
// Effects carry a start time (after the token has walked), so the sound lands with the visual.
import { useStore } from '../state/store';
import type { Fx } from '../state/store';
import { playSound, setMusicMood } from './sound';
import type { Sound } from './sound';

const played = new Set<number>();

function soundFor(f: Fx, me: string | null): Sound | null {
  if (f.kind === 'bought') return 'buy';
  if (f.kind === 'upgraded') return 'upgrade';
  if (f.kind === 'money') {
    if (f.seat !== me) return null; // only your own money makes noise; others' is the coin flight
    return (f.amount ?? 0) > 0 ? 'receive' : 'pay';
  }
  if (f.kind === 'coin') return 'coin';
  return null;
}

useStore.subscribe((s, prev) => {
  if (s.fx !== prev.fx) {
    for (const f of s.fx) {
      if (played.has(f.id)) continue;
      played.add(f.id);
      const snd = soundFor(f, s.seat);
      if (!snd) continue;
      setTimeout(() => playSound(snd), Math.max(0, f.start - performance.now()));
    }
    if (played.size > 500) played.clear();
  }
  if (s.worldCard && s.worldCard !== prev.worldCard) playSound('event');
  if (s.chanceCard && s.chanceCard !== prev.chanceCard) playSound('card');
  if (s.match?.auction && !prev.match?.auction) playSound('gavel');
  const mg = s.match?.phase === 'MINIGAME' || s.match?.phase === 'DUEL';
  const wasMg = prev.match?.phase === 'MINIGAME' || prev.match?.phase === 'DUEL';
  if (mg !== wasMg) {
    setMusicMood(mg ? 'game' : 'calm');
    if (mg) playSound('minigame');
  }
});
