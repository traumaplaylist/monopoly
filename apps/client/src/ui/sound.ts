// All audio is synthesized with Web Audio (no third-party files, no licences to worry about).
// Effects: short shaped tones and noise bursts. Music: a small procedural loop (chords, pluck
// melody, soft hats) scheduled ahead of time; faster during mini-games. Starts after a user gesture.
import { get, useStore } from '../state/store';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function unlockAudio(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(ctx.destination);
    musicBus.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    useStore.subscribe((s, prev) => {
      if (s.prefs !== prev.prefs) applyVolumes();
    });
    startMusic();
  } catch {
    ctx = null;
  }
}

function applyVolumes() {
  if (!ctx || !sfxBus || !musicBus) return;
  const { muted, volume, music } = get().prefs;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(muted ? 0 : volume, t, 0.05);
  musicBus.gain.setTargetAtTime(muted ? 0 : (music ?? 0.35) * 0.5, t, 0.2);
}

export type Sound =
  | 'dice' | 'coin' | 'error' | 'turn' | 'tap' | 'win' | 'step' | 'receive' | 'pay' | 'buy' | 'upgrade'
  | 'gavel' | 'card' | 'event' | 'minigame';

/** One tone with an attack/decay envelope. */
function tone(f: number, at: number, dur: number, type: OscillatorType, gain: number, bus: AudioNode, slideTo?: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Filtered noise burst (rattle, whoosh, thump, hats). */
function noise(at: number, dur: number, gain: number, freq: number, bus: AudioNode, q = 1, sweepTo?: number) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

const bell = (f: number, at: number, g = 0.18) => {
  if (!sfxBus) return;
  tone(f, at, 0.5, 'sine', g, sfxBus);
  tone(f * 2.01, at, 0.25, 'sine', g * 0.35, sfxBus);
};

export function playSound(name: Sound): void {
  if (!ctx || !sfxBus || get().prefs.muted) return;
  const t = ctx.currentTime + 0.01;
  const b = sfxBus;
  switch (name) {
    case 'dice':
      for (let i = 0; i < 6; i++) noise(t + i * 0.07 + Math.random() * 0.03, 0.05, 0.35, 1800 + Math.random() * 1500, b, 2);
      break;
    case 'step':
      noise(t, 0.06, 0.12, 500, b, 1.5);
      tone(180, t, 0.07, 'sine', 0.05, b);
      break;
    case 'coin':
      bell(1318, t);
      bell(1760, t + 0.07);
      break;
    case 'receive':
      [1046, 1318, 1568].forEach((f, i) => bell(f, t + i * 0.06, 0.14));
      break;
    case 'pay':
      tone(660, t, 0.18, 'triangle', 0.12, b, 440);
      tone(440, t + 0.12, 0.22, 'triangle', 0.1, b, 330);
      break;
    case 'buy':
      noise(t, 0.05, 0.25, 3000, b, 3);
      bell(1568, t + 0.05, 0.2);
      bell(2093, t + 0.12, 0.14);
      break;
    case 'upgrade':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.05, 0.25, 'triangle', 0.1, b));
      break;
    case 'gavel':
      noise(t, 0.09, 0.5, 300, b, 0.8);
      tone(120, t, 0.12, 'sine', 0.25, b, 70);
      break;
    case 'card':
      noise(t, 0.25, 0.2, 800, b, 0.8, 4000);
      bell(988, t + 0.18, 0.12);
      break;
    case 'event':
      [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'square', 0.05, b));
      tone(1046, t + 0.36, 0.5, 'triangle', 0.1, b);
      break;
    case 'minigame':
      [659, 784, 988, 1318].forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'square', 0.05, b));
      break;
    case 'turn':
      [523, 659, 784].forEach((f, i) => bell(f, t + i * 0.08, 0.12));
      break;
    case 'tap':
      tone(880, t, 0.05, 'triangle', 0.08, b);
      break;
    case 'error':
      tone(220, t, 0.18, 'sawtooth', 0.06, b, 150);
      break;
    case 'win':
      [523, 659, 784, 1046, 1318].forEach((f, i) => bell(f, t + i * 0.1, 0.16));
      [523, 659, 784].forEach((f) => tone(f, t + 0.55, 1.2, 'triangle', 0.06, b));
      break;
  }
}

// ---------------------------------------------------------------- music

/** C major, I–V–vi–IV, 2 bars each chord (beats are 8ths). */
const CHORDS = [
  [261.6, 329.6, 392.0],
  [196.0, 246.9, 293.7],
  [220.0, 261.6, 329.6],
  [174.6, 220.0, 261.6],
];
const SCALE = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5];
let step = 0;
let nextAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let fast = false;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Mini-games make the music a little faster and brighter. */
export function setMusicMood(mood: 'calm' | 'game'): void {
  fast = mood === 'game';
}

function scheduleMusic() {
  if (!ctx || !musicBus) return;
  const bpm = fast ? 132 : 100;
  const eighth = 60 / bpm / 2;
  while (nextAt < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8);
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]!;
    const inBar = step % 8;
    const m = musicBus;
    if (inBar === 0) for (const f of chord) tone(f / 2, nextAt, eighth * 8 * 0.95, 'triangle', 0.05, m); // pad
    if (inBar === 0 || inBar === 4) tone(chord[0]! / 4, nextAt, eighth * 3, 'sine', 0.12, m); // bass
    if (inBar % 2 === 1) noise(nextAt, 0.04, fast ? 0.05 : 0.03, 7000, m, 1.2); // hat
    // Pluck melody: chord tones and pentatonic neighbours, sparse on calm.
    if (rnd() < (fast ? 0.7 : 0.45)) {
      const pick = rnd() < 0.6 ? chord[Math.floor(rnd() * 3)]! * 2 : SCALE[Math.floor(rnd() * SCALE.length)]!;
      tone(pick, nextAt, eighth * 1.6, 'triangle', 0.045, m);
    }
    step++;
    nextAt += eighth;
  }
}

function startMusic() {
  if (!ctx || timer) return;
  nextAt = ctx.currentTime + 0.1;
  timer = setInterval(scheduleMusic, 100);
}
