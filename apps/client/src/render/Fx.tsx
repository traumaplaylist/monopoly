// Board effects from fresh events: floating «+150 / −80» over a player's figure, a coin flying from
// payer to owner on rent, a «КУПЛЕНО» stamp on purchase, a star on upgrade. Pure visuals: they never
// touch game state, and with `reduceMotion` the store does not create them at all.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, MeshPhysicalMaterial, SRGBColorSpace, SpriteMaterial, TextureLoader } from 'three';
import type { Texture } from 'three';
import type { Emote } from '@pb/content';
import type { EmoteFx } from '../state/store';
import { EMOTE_LIFE, emoteUrl } from '../ui/match/Emotes';
import type { Group, Mesh, Sprite } from 'three';
import { useStore } from '../state/store';
import type { Fx } from '../state/store';
import { TILE_HEIGHT, tileRect } from './layout';
import type { Profile } from './layout';
import { tileSpot } from './Tokens';
import { DISPLAY_FONT, DISPLAY_WEIGHT } from './tileArt';

const LIFE = 1600;
const COIN_LIFE = 750;

const texCache = new Map<string, CanvasTexture>();
function textTexture(text: string, fill: string, stroke: string, size = 96, rotate = 0): CanvasTexture {
  const key = `${text}|${fill}|${stroke}|${size}|${rotate}`;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const x = c.getContext('2d')!;
  x.translate(256, 96);
  x.rotate(rotate);
  x.font = `${DISPLAY_WEIGHT} ${size}px ${DISPLAY_FONT}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = size * 0.16;
  x.strokeStyle = stroke;
  x.strokeText(text, 0, 4);
  x.fillStyle = fill;
  x.fillText(text, 0, 4);
  t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const coinMat = new MeshPhysicalMaterial({ color: '#ffc21a', metalness: 0.7, roughness: 0.25, emissive: '#ffb300', emissiveIntensity: 0.4, clearcoat: 1 });

function spotOf(seat: string | undefined, profile: Profile): [number, number, number] | null {
  const m = useStore.getState().match;
  if (!m || !seat) return null;
  const i = m.players.findIndex((p) => p.seat === seat);
  const p = m.players[i];
  if (!p) return null;
  return tileSpot(p.position, i, profile);
}

function FloatText({ fx, profile }: { fx: Fx; profile: Profile }) {
  const ref = useRef<Sprite>(null);
  const mat = useMemo(() => {
    let map: CanvasTexture;
    if (fx.kind === 'money') {
      const v = fx.amount ?? 0;
      map = textTexture(`${v > 0 ? '+' : '−'}${Math.abs(v)}`, v > 0 ? '#3ee08a' : '#ff5a5f', '#1d1a2e');
    } else if (fx.kind === 'bought') map = textTexture('КУПЛЕНО', '#ffffff', '#db3f2b', 80, -0.15);
    else map = textTexture('★ УЛУЧШЕНО', '#ffd84a', '#5a3a00', 70);
    return new SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false });
  }, [fx]);
  const base = useMemo(() => {
    if (fx.tile !== undefined) {
      const r = tileRect(fx.tile, profile);
      return [r.x, TILE_HEIGHT + 0.6, r.z] as [number, number, number];
    }
    const s = spotOf(fx.seat, profile);
    return s ? ([s[0], 1.5, s[2]] as [number, number, number]) : null;
  }, [fx, profile]);
  useFrame(() => {
    const sp = ref.current;
    if (!sp || !base) return;
    const k = (performance.now() - fx.start) / LIFE;
    sp.visible = k >= 0 && k <= 1;
    if (!sp.visible) return;
    const pop = Math.min(1, k * 6);
    sp.position.set(base[0], base[1] + k * 0.9, base[2]);
    const w = fx.kind === 'money' ? 1.6 : 2.2;
    sp.scale.set(w * pop, (w / 2.67) * pop, 1);
    mat.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  });
  if (!base) return null;
  return <sprite ref={ref} material={mat} renderOrder={10} visible={false} />;
}

function Coin({ fx, profile }: { fx: Fx; profile: Profile }) {
  const ref = useRef<Mesh>(null);
  const ends = useMemo(() => [spotOf(fx.seat, profile), spotOf(fx.to, profile)] as const, [fx, profile]);
  useFrame(() => {
    const m = ref.current;
    const [a, b] = ends;
    if (!m || !a || !b) return;
    const k = (performance.now() - fx.start) / COIN_LIFE;
    m.visible = k >= 0 && k <= 1;
    if (!m.visible) return;
    const e = k * k * (3 - 2 * k);
    m.position.set(a[0] + (b[0] - a[0]) * e, 0.9 + Math.sin(k * Math.PI) * 2.2, a[2] + (b[2] - a[2]) * e);
    m.rotation.set(Math.PI / 2, 0, k * 14);
  });
  return (
    <mesh ref={ref} material={coinMat} visible={false} castShadow>
      <cylinderGeometry args={[0.18, 0.18, 0.05, 24]} />
    </mesh>
  );
}

const emoteTex = new Map<Emote, Texture>();
function emoteTexture(e: Emote, onLoad: () => void): Texture {
  let t = emoteTex.get(e);
  if (!t) {
    t = new TextureLoader().load(emoteUrl(e), onLoad);
    t.colorSpace = SRGBColorSpace;
    emoteTex.set(e, t);
  }
  return t;
}

/** Reaction over the sender's figure: pops in, bobs, floats up and fades. */
function EmoteSprite({ fx, profile }: { fx: EmoteFx; profile: Profile }) {
  const ref = useRef<Sprite>(null);
  const invalidate = useThree((s) => s.invalidate);
  const mat = useMemo(() => new SpriteMaterial({ map: emoteTexture(fx.emote, () => invalidate()), transparent: true, depthTest: false, depthWrite: false }), [fx, invalidate]);
  useFrame(() => {
    const sp = ref.current;
    const at = spotOf(fx.seat, profile);
    if (!sp || !at) return;
    const k = (performance.now() - fx.start) / EMOTE_LIFE;
    sp.visible = k >= 0 && k <= 1;
    if (!sp.visible) return;
    const pop = k < 0.1 ? (k / 0.1) * 1.25 : k < 0.18 ? 1.25 - ((k - 0.1) / 0.08) * 0.25 : 1;
    const size = 1.0 * pop;
    // The camera looks almost straight down: lift the bubble «up the screen» (−z), not just up in y.
    // Top row: no room above (screen edge), so the bubble goes below, into the board.
    const dir = at[2] < -profile.height / 2 + 1.6 ? 1 : -1;
    sp.position.set(at[0], 1.8, at[2] + dir * (1.0 + k * 0.5) + Math.sin(k * 18) * 0.04);
    sp.scale.set(size, size, 1);
    mat.opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
  });
  return <sprite ref={ref} material={mat} renderOrder={11} visible={false} />;
}

/** All live effects; keeps frames coming only while something is animating. */
export function FxLayer({ profile }: { profile: Profile }) {
  const fx = useStore((s) => s.fx);
  const emotes = useStore((s) => s.emotes);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  useFrame(() => {
    const now = performance.now();
    if (fx.some((f) => now - f.start < LIFE + 100) || emotes.some((e) => now - e.start < EMOTE_LIFE + 100)) invalidate();
  });
  useEffect(() => invalidate(), [emotes, invalidate]);
  return (
    <group ref={group}>
      {fx.map((f) => (f.kind === 'coin' ? <Coin key={f.id} fx={f} profile={profile} /> : <FloatText key={f.id} fx={f} profile={profile} />))}
      {emotes.map((e) => (
        <EmoteSprite key={e.id} fx={e} profile={profile} />
      ))}
    </group>
  );
}
