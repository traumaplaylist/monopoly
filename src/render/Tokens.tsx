import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { JAIL_INDEX } from '../engine';
import type { Player } from '../engine';
import { useGame } from '../game/store';
import { tileRect } from './layout';

const STEP_TIME = 0.16;
const DIRECT_TIME = 0.6;

/** Точка стоянки фишки на клетке; у каждой фишки своё смещение, чтобы не слипались. */
export function tileSpot(tile: number, token: number, jailed = false): [number, number, number] {
  const r = tileRect(tile);
  const ox = ((token % 3) - 1) * 0.32;
  const oz = (Math.floor(token / 3) - 0.5) * 0.36;
  if (tile === JAIL_INDEX) {
    // В карантине — ближе к центру поля, в гостях — у края.
    const shift = jailed ? -0.35 : 0.45;
    return [r.x + ox * 0.9 - shift * 0.4, 0, r.z + oz * 0.9 + shift * 0.4];
  }
  return [r.x + ox, 0, r.z + oz];
}

function TokenShape({ token, color }: { token: number; color: string }) {
  const mat = <meshStandardMaterial color={color} metalness={0.55} roughness={0.25} emissive={color} emissiveIntensity={0.15} />;
  switch (token) {
    case 0: // Ракета
      return (
        <group>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.3, 16]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow>
            <coneGeometry args={[0.1, 0.2, 16]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.08, 0]} castShadow>
            <coneGeometry args={[0.18, 0.12, 3]} />
            {mat}
          </mesh>
        </group>
      );
    case 1: // Спутник
      return (
        <group position={[0, 0.3, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 20, 16]} />
            {mat}
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0, 0]} castShadow>
            <torusGeometry args={[0.22, 0.025, 8, 32]} />
            {mat}
          </mesh>
        </group>
      );
    case 2: // Кристалл
      return (
        <mesh position={[0, 0.3, 0]} castShadow>
          <octahedronGeometry args={[0.2, 0]} />
          {mat}
        </mesh>
      );
    case 3: // Дрон
      return (
        <mesh position={[0, 0.28, 0]} castShadow>
          <dodecahedronGeometry args={[0.18, 0]} />
          {mat}
        </mesh>
      );
    case 4: // Модуль
      return (
        <mesh position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <boxGeometry args={[0.24, 0.32, 0.24]} />
          {mat}
        </mesh>
      );
    default: // Комета
      return (
        <group position={[0, 0.26, 0]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.15, 1]} />
            {mat}
          </mesh>
          <mesh position={[0, 0, 0.17]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.11, 0.3, 12]} />
            {mat}
          </mesh>
        </group>
      );
  }
}

function Token({ player }: { player: Player }) {
  const ref = useRef<Group>(null);
  const queue = useGame((s) => s.moves[player.id]);
  const finishMove = useGame((s) => s.finishMove);
  const anim = useRef<{ path: number[]; direct: boolean; t: number; seg: number } | null>(null);

  // Начало нового сегмента анимации.
  const segment = queue?.[0];
  useEffect(() => {
    if (!segment) return;
    const path: number[] = [];
    if (segment.direct || segment.steps === 0) {
      path.push(segment.from, segment.to);
    } else {
      const dir = segment.steps > 0 ? 1 : -1;
      for (let k = 0; k <= Math.abs(segment.steps); k++) path.push((((segment.from + dir * k) % 40) + 40) % 40);
    }
    anim.current = { path, direct: segment.direct || segment.steps === 0, t: 0, seg: 0 };
  }, [segment]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (!a) {
      const [x, , z] = tileSpot(player.position, player.token, player.inJail);
      g.position.x += (x - g.position.x) * Math.min(1, dt * 10);
      g.position.z += (z - g.position.z) * Math.min(1, dt * 10);
      g.position.y = 0;
      return;
    }
    const dur = a.direct ? DIRECT_TIME : STEP_TIME;
    a.t += Math.min(dt, 0.05);
    const from = a.path[a.seg]!;
    const to = a.path[a.seg + 1]!;
    const k = Math.min(1, a.t / dur);
    const isLast = a.seg + 1 === a.path.length - 1;
    const [x0, , z0] = tileSpot(from, player.token, false);
    const [x1, , z1] = tileSpot(to, player.token, isLast && player.inJail);
    const e = k * k * (3 - 2 * k);
    g.position.set(x0 + (x1 - x0) * e, Math.sin(k * Math.PI) * (a.direct ? 1.4 : 0.35), z0 + (z1 - z0) * e);
    if (k >= 1) {
      a.seg += 1;
      a.t = 0;
      if (a.seg >= a.path.length - 1) {
        anim.current = null;
        finishMove(player.id);
      }
    }
  });

  // Начальная позиция задаётся один раз; дальше фишкой управляет useFrame.
  const initial = useRef(tileSpot(player.position, player.token, player.inJail));
  return (
    <group ref={ref} position={initial.current} visible={!player.bankrupt}>
      <TokenShape token={player.token} color={player.color} />
    </group>
  );
}

export function Tokens() {
  const players = useGame((s) => s.state?.players);
  if (!players) return null;
  return (
    <group>
      {players.map((p) => (
        <Token key={p.id} player={p} />
      ))}
    </group>
  );
}
