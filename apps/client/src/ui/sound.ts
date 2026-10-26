// Short synthesized sounds (no third-party audio). Start only after a user gesture.
import { get } from '../state/store';

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
}

type Sound = 'dice' | 'coin' | 'error' | 'turn' | 'tap' | 'win';

const SHAPES: Record<Sound, { f: number[]; d: number; type: OscillatorType }> = {
  dice: { f: [220, 330, 260], d: 0.06, type: 'square' },
  coin: { f: [880, 1320], d: 0.08, type: 'triangle' },
  error: { f: [200, 150], d: 0.12, type: 'sawtooth' },
  turn: { f: [523, 659, 784], d: 0.09, type: 'triangle' },
  tap: { f: [660], d: 0.04, type: 'square' },
  win: { f: [523, 659, 784, 1046], d: 0.12, type: 'triangle' },
};

export function playSound(name: Sound): void {
  const { muted, volume } = get().prefs;
  if (!ctx || muted || volume <= 0) return;
  const s = SHAPES[name];
  let t = ctx.currentTime;
  for (const f of s.f) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.08 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + s.d);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + s.d);
    t += s.d * 0.9;
  }
}
