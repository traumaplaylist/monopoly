// Lobby editor for the player figure. The look is data (packages/content/src/appearance.ts):
// sent to the server (validated there), remembered on this device and re-applied in new rooms.
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { APPEARANCE_LABELS, BODY_COLORS, BODY_MATERIALS, BODY_SHAPES, FACES, HATS, sanitizeAppearance } from '@pb/content';
import type { Appearance } from '@pb/content';
import { api } from '../net/connection';
import { PlayerFigure } from '../render/figure';

const KEY = 'pb.appearance.v1';

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
    /* private mode — the look still applies to this room */
  }
}

function Spinner({ appearance, seatColor }: { appearance: Appearance; seatColor: string }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.9;
  });
  return (
    <group ref={ref}>
      <PlayerFigure appearance={appearance} seatColor={seatColor} />
    </group>
  );
}

function Preview({ appearance, seatColor }: { appearance: Appearance; seatColor: string }) {
  return (
    <div className="fig-preview" data-testid="figure-preview">
      <Canvas camera={{ position: [0, 0.75, 1.55], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true }} flat>
        <hemisphereLight args={['#ffffff', '#6a5aa8', 1.3]} />
        <directionalLight position={[1.5, 2.5, 2]} intensity={1.6} />
        <group position={[0, -0.38, 0]}>
          <Spinner appearance={appearance} seatColor={seatColor} />
        </group>
      </Canvas>
    </div>
  );
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

function Options<T extends string>({ label, values, value, names, onPick, test }: { label: string; values: readonly T[]; value: T; names: Record<T, string>; onPick: (v: T) => void; test: string }) {
  return (
    <div className="fig-row">
      <span className="fig-label">{label}</span>
      <div className="fig-opts">
        {values.map((v) => (
          <button key={v} className={`fig-opt ${v === value ? 'on' : ''}`} onClick={() => onPick(v)} data-testid={`${test}-${v}`}>
            {names[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FigureEditor({ appearance, seatColor }: { appearance: Appearance; seatColor: string }) {
  const set = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch };
    remember(next);
    void api.appearance(next);
  };
  return (
    <div className="fig-editor" data-testid="figure-editor">
      <Preview appearance={appearance} seatColor={seatColor} />
      <div className="fig-controls">
        <Options label="Форма" values={BODY_SHAPES} value={appearance.body} names={APPEARANCE_LABELS.body} onPick={(body) => set({ body })} test="fig-body" />
        <div className="fig-row">
          <span className="fig-label">Цвет</span>
          <div className="fig-opts">
            {BODY_COLORS.map((c) => (
              <button key={c} className={`fig-swatch ${c === appearance.color ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`Цвет ${c}`} data-testid={`fig-color-${c.slice(1)}`} />
            ))}
          </div>
        </div>
        <Options label="Материал" values={BODY_MATERIALS} value={appearance.material} names={APPEARANCE_LABELS.material} onPick={(material) => set({ material })} test="fig-material" />
        <Options label="Шляпа" values={HATS} value={appearance.hat} names={APPEARANCE_LABELS.hat} onPick={(hat) => set({ hat })} test="fig-hat" />
        <Options label="Лицо" values={FACES} value={appearance.face} names={APPEARANCE_LABELS.face} onPick={(face) => set({ face })} test="fig-face" />
        <p className="hint">Кольцо под фишкой — цвет вашего места: по нему видно, чьи объекты, даже если фишки похожи.</p>
      </div>
    </div>
  );
}
