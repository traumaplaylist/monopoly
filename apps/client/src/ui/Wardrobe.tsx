// Wardrobe (GeoGuessr-style character editor): big rotating character on the left, categories and
// item cards on the right. The look is data (packages/content/src/appearance.ts): remembered on this
// device and, when sitting at a table, sent to the server (validated there).
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import {
  CLOTH_COLORS,
  HAIR_COLORS,
  OUTFITS,
  PACKS,
  PACK_LABELS,
  SKIN_TONES,
  outfitsOf,
  randomAppearance,
  sanitizeAppearance,
} from '@pb/content';
import type { Appearance, Slot } from '@pb/content';
import { api } from '../net/connection';
import { Character, preloadCharacter } from '../render/character';
import { set, useStore } from '../state/store';

const KEY = 'pb.character.v2';

export function savedAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeAppearance(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function remember(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* private mode: the look still applies to this room */
  }
}

/** Applies the remembered look once when this player sits at a table with a different one. */
export function useRestoreAppearance(current: Appearance | undefined) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !current) return;
    done.current = true;
    const saved = savedAppearance();
    if (saved && JSON.stringify(saved) !== JSON.stringify(current)) void api.appearance(saved);
  }, [current]);
}

/** Drag to rotate; the character idles and waves when something changes. */
function Turntable({ a, wave }: { a: Appearance; wave: number }) {
  const ref = useRef<Group>(null);
  const drag = useRef<{ x: number; rot: number } | null>(null);
  const target = useRef(0.35);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!drag.current) target.current += dt * 0.25;
    g.rotation.y += (target.current - g.rotation.y) * Math.min(1, dt * 8);
  });
  return (
    <group
      ref={ref}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, rot: target.current };
        (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) target.current = drag.current.rot + (e.clientX - drag.current.x) * 0.012;
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <Character appearance={a} height={1.7} mode="idle" wave={wave} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.65, 48]} />
        <meshStandardMaterial color="#3b3484" />
      </mesh>
    </group>
  );
}

type Tab = 'pack' | Slot | 'skin' | 'hair' | 'shirt' | 'pants' | 'extra';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'pack', label: 'Фигура', icon: '🧍' },
  { id: 'head', label: 'Голова', icon: '💇' },
  { id: 'body', label: 'Верх', icon: '👕' },
  { id: 'legs', label: 'Низ', icon: '👖' },
  { id: 'feet', label: 'Обувь', icon: '👟' },
  { id: 'skin', label: 'Кожа', icon: '✋' },
  { id: 'hair', label: 'Волосы', icon: '🎨' },
  { id: 'shirt', label: 'Цвет верха', icon: '🟥' },
  { id: 'pants', label: 'Цвет низа', icon: '🟦' },
  { id: 'extra', label: 'Рюкзак', icon: '🎒' },
];

function Thumb({ id, slot }: { id: string; slot: Slot }) {
  const [ok, setOk] = useState(true);
  const name = OUTFITS.find((o) => o.id === id)?.name ?? id;
  return ok ? <img className="wd-thumb" src={`models/characters/thumbs/${id}-${slot}.png`} alt={name} onError={() => setOk(false)} draggable={false} /> : <span className="wd-thumb wd-thumb-txt">{name}</span>;
}

export function Wardrobe() {
  const open = useStore((s) => s.wardrobe);
  const room = useStore((s) => s.room);
  const seat = useStore((s) => s.seat);
  const mine = room?.seats.find((s) => s.seat === seat)?.appearance;
  const [a, setA] = useState<Appearance>(() => savedAppearance() ?? mine ?? sanitizeAppearance(null));
  const [tab, setTab] = useState<Tab>('head');
  const [wave, setWave] = useState(0);
  const sendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) setA(savedAppearance() ?? mine ?? sanitizeAppearance(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    // Warm the loader cache for the whole pack, so switching items does not flash.
    for (const o of outfitsOf(a.pack)) preloadCharacter({ ...a, head: o.id, body: o.id, legs: o.id, feet: o.id });
  }, [a.pack]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const change = (patch: Partial<Appearance>) => {
    const next = sanitizeAppearance({ ...a, ...patch }, a);
    setA(next);
    setWave((w) => w + 1);
    remember(next);
    if (room) {
      clearTimeout(sendTimer.current);
      sendTimer.current = setTimeout(() => void api.appearance(next), 250);
    }
  };
  const switchPack = (pack: Appearance['pack']) => {
    if (pack === a.pack) return;
    const first = outfitsOf(pack)[0]!.id;
    change({ pack, head: first, body: first, legs: first, feet: first, backpack: false });
  };

  const slotTab = tab === 'head' || tab === 'body' || tab === 'legs' || tab === 'feet' ? (tab as Slot) : null;
  const colorTab = tab === 'skin' ? SKIN_TONES : tab === 'hair' ? HAIR_COLORS : tab === 'shirt' || tab === 'pants' ? CLOTH_COLORS : null;

  return (
    <div className="wardrobe-layer" data-testid="wardrobe">
      <div className="wardrobe">
        <div className="wd-stage">
          <div className="wd-title">Гардероб</div>
          <div className="wd-canvas">
            <Canvas camera={{ position: [0, 0.15, 4.4], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true }} flat shadows={false}>
              <hemisphereLight args={['#ffffff', '#5a4aa0', 1.2]} />
              <directionalLight position={[2, 3, 3]} intensity={1.8} />
              <directionalLight position={[-2, 1.5, -2]} intensity={0.6} color="#b8a8ff" />
              <group position={[0, -0.9, 0]}>
                <Suspense fallback={null}>
                  <Turntable a={a} wave={wave} />
                </Suspense>
              </group>
            </Canvas>
          </div>
          <div className="wd-actions">
            <button className="btn" onClick={() => change(randomAppearance(Math.random))} data-testid="wd-random">
              🎲 Случайно
            </button>
            <button className="btn primary" onClick={() => set({ wardrobe: false })} data-testid="wd-done">
              Готово
            </button>
          </div>
          <p className="hint center">Тяните персонажа, чтобы повернуть. Кольцо цвета места появится под ним на поле.</p>
        </div>
        <div className="wd-panel">
          <div className="wd-tabs">
            {TABS.filter((t) => t.id !== 'extra' || a.pack === 'male').map((t) => (
              <button key={t.id} className={`wd-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)} data-testid={`wd-tab-${t.id}`}>
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="wd-grid">
            {tab === 'pack' &&
              PACKS.map((p) => (
                <button key={p} className={`wd-card ${a.pack === p ? 'on' : ''}`} onClick={() => switchPack(p)} data-testid={`wd-pack-${p}`}>
                  <Thumb id={outfitsOf(p)[0]!.id} slot="head" />
                  <span>{PACK_LABELS[p]}</span>
                </button>
              ))}
            {slotTab &&
              outfitsOf(a.pack).map((o) => (
                <button key={o.id} className={`wd-card ${a[slotTab] === o.id ? 'on' : ''}`} onClick={() => change({ [slotTab]: o.id })} data-testid={`wd-item-${slotTab}-${o.id}`}>
                  <Thumb id={o.id} slot={slotTab} />
                  <span>{o.name}</span>
                </button>
              ))}
            {colorTab &&
              colorTab.map((c) => {
                const field = tab as 'skin' | 'hair' | 'shirt' | 'pants';
                return (
                  <button
                    key={c}
                    className={`wd-color ${a[field] === c ? 'on' : ''} ${c === 'orig' ? 'orig' : ''}`}
                    style={c === 'orig' ? undefined : { background: c }}
                    onClick={() => change({ [field]: c } as Partial<Appearance>)}
                    title={c === 'orig' ? 'Как у наряда' : c}
                    data-testid={`wd-color-${field}-${c.replace('#', '')}`}
                  >
                    {c === 'orig' ? 'как у наряда' : ''}
                  </button>
                );
              })}
            {tab === 'extra' && (
              <>
                <button className={`wd-card ${!a.backpack ? 'on' : ''}`} onClick={() => change({ backpack: false })}>
                  <span className="wd-thumb wd-thumb-txt">—</span>
                  <span>Без рюкзака</span>
                </button>
                <button className={`wd-card ${a.backpack ? 'on' : ''}`} onClick={() => change({ backpack: true })} data-testid="wd-backpack">
                  <span className="wd-thumb wd-thumb-txt">🎒</span>
                  <span>Рюкзак</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
