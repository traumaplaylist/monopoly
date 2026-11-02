import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from 'three';
import type { Group } from 'three';
import { useStore } from '../state/store';
import { centerLayout } from './layout';
import type { Profile } from './layout';
import { playSound } from '../ui/sound';

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

// Порядок граней BoxGeometry: +X, −X, +Y, −Y, +Z, −Z. Значение v — на верхней грани (+Y).
function facesFor(v: number): number[] {
  const side = [1, 2, 3, 4, 5, 6].filter((n) => n !== v && n !== 7 - v);
  return [side[0]!, 7 - side[0]!, v, 7 - v, side[1]!, 7 - side[1]!];
}

const SIZE = 0.7;
const REST_Y = SIZE / 2;
// Face normals in BoxGeometry order (+X, −X, +Y, −Y, +Z, −Z) with two in-plane axes each.
const FACE_AXES: [Vector3, Vector3, Vector3][] = [
  [new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(0, 1, 0)],
  [new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 1, 0)],
  [new Vector3(0, 1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, -1)],
  [new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1)],
  [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
  [new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0)],
];
const bodyMat = new MeshPhysicalMaterial({ color: '#fffaf0', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
const pipMat = new MeshStandardMaterial({ color: '#2b2236', roughness: 0.4 });
const pipOneMat = new MeshStandardMaterial({ color: '#f23d5c', roughness: 0.4 });

function Pips({ value }: { value: number }) {
  const pips = useMemo(() => {
    const res: { p: [number, number, number]; one: boolean }[] = [];
    facesFor(value).forEach((v, f) => {
      const [n, a, b] = FACE_AXES[f]!;
      for (const [u, w] of PIPS[v]!) {
        const p = n.clone().multiplyScalar(SIZE / 2 - 0.035).addScaledVector(a, (u - 0.5) * SIZE * 0.9).addScaledVector(b, (0.5 - w) * SIZE * 0.9);
        res.push({ p: [p.x, p.y, p.z], one: v === 1 });
      }
    });
    return res;
  }, [value]);
  return (
    <group>
      {pips.map((x, k) => (
        <mesh key={k} position={x.p} material={x.one ? pipOneMat : pipMat} scale={x.one ? 1.5 : 1}>
          <sphereGeometry args={[0.055, 12, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Die({ value, x, z, seed }: { value: number; x: number; z: number; seed: number }) {
  const ref = useRef<Group>(null);
  const spin = useRef(0);
  const rollSeq = useStore((s) => s.rollSeq);
  const reduce = useStore((s) => s.prefs.reduceMotion);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (rollSeq > 0 && !reduce) {
      spin.current = 0.9;
      invalidate();
    }
    if (rollSeq > 0 && seed > 0) playSound('dice');
  }, [rollSeq, reduce, seed, invalidate]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (spin.current > 0) {
      invalidate();
      spin.current = Math.max(0, spin.current - Math.min(dt, 0.05));
      const k = spin.current;
      m.rotation.x += dt * 18 * k * (1 + seed * 0.3);
      m.rotation.z += dt * 14 * k;
      m.position.y = REST_Y + Math.abs(Math.sin(k * 9)) * 0.9 * k;
      if (spin.current === 0) m.rotation.set(0, seed * 0.4, 0);
    } else {
      m.rotation.x = 0;
      m.rotation.z = 0;
      m.position.y = REST_Y;
    }
  });

  return (
    <group ref={ref} position={[x, REST_Y, z]} rotation={[0, seed * 0.4, 0]}>
      <RoundedBox args={[SIZE, SIZE, SIZE]} radius={0.12} smoothness={4} material={bodyMat} castShadow receiveShadow />
      <Pips value={value} />
    </group>
  );
}

export function Dice({ profile }: { profile: Profile }) {
  const dice = useStore((s) => s.match?.turn.dice) ?? [5, 2];
  const c = centerLayout(profile).dice;
  return (
    <group>
      <Die value={dice[0]} x={c.x - 0.6} z={c.z} seed={1} />
      <Die value={dice[1]} x={c.x + 0.6} z={c.z} seed={-1} />
    </group>
  );
}
