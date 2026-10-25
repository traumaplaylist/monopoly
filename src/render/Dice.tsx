import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Mesh } from 'three';
import { useGame } from '../game/store';

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.22],
    [0.75, 0.22],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.78],
    [0.75, 0.78],
  ],
};

function faceTexture(v: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4f6ff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = v === 1 ? '#ff5d73' : '#16213e';
  for (const [x, y] of PIPS[v]!) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Порядок граней BoxGeometry: +X, −X, +Y, −Y, +Z, −Z. Значение v — на верхней грани (+Y).
function facesFor(v: number): number[] {
  const side = [1, 2, 3, 4, 5, 6].filter((n) => n !== v && n !== 7 - v);
  return [side[0]!, 7 - side[0]!, v, 7 - v, side[1]!, 7 - side[1]!];
}

function Die({ value, x, seed }: { value: number; x: number; seed: number }) {
  const ref = useRef<Mesh>(null);
  const mats = useMemo(
    () => [1, 2, 3, 4, 5, 6].map((v) => new MeshStandardMaterial({ map: faceTexture(v), roughness: 0.35 })),
    [],
  );
  const spin = useRef(0);
  const rollSeq = useGame((s) => s.rollSeq);

  useEffect(() => {
    if (rollSeq > 0) spin.current = 0.9;
  }, [rollSeq]);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.material = facesFor(value).map((v) => mats[v - 1]!);
  }, [value, mats]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (spin.current > 0) {
      spin.current = Math.max(0, spin.current - dt);
      const k = spin.current;
      m.rotation.x += dt * 18 * k * (1 + seed * 0.3);
      m.rotation.z += dt * 14 * k;
      m.position.y = 0.45 + Math.abs(Math.sin(k * 9)) * 0.9 * k;
      if (spin.current === 0) m.rotation.set(0, seed * 0.4, 0);
    } else {
      m.rotation.x = 0;
      m.rotation.z = 0;
      m.position.y = 0.45;
    }
  });

  return (
    <mesh ref={ref} position={[x, 0.45, 2.2]} rotation={[0, seed * 0.4, 0]} castShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
    </mesh>
  );
}

export function Dice() {
  const dice = useGame((s) => s.state?.dice) ?? [5, 2];
  return (
    <group>
      <Die value={dice[0]} x={-0.6} seed={1} />
      <Die value={dice[1]} x={0.6} seed={-1} />
    </group>
  );
}
