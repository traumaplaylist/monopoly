import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { JAIL_INDEX } from '../engine';
import type { Player } from '../engine';
import { useGame } from '../game/store';
import { Model } from './assets';
import { TILE_HEIGHT, tileRect } from './layout';

const STEP_TIME = 0.17;
const DIRECT_TIME = 0.65;

/** Точка стоянки фишки: у каждой своё место на клетке, чтобы фишки не слипались. */
export function tileSpot(index: number, token: number, jailed = false): [number, number, number] {
  const r = tileRect(index);
  const col = token % 3;
  const row = Math.floor(token / 3);
  let fx = (col - 1) * 0.3;
  let fz = (row - 0.5) * 0.42;
  if (index === JAIL_INDEX) {
    // В карантине — ближе к центру поля, «в гостях» — у края.
    fx = fx * 0.8 + (jailed ? -0.22 : 0.22);
    fz = fz * 0.8 + (jailed ? 0.18 : -0.18);
  }
  return [r.x + fx * r.w, TILE_HEIGHT, r.z + fz * r.d];
}

const SKIN = ['#f1c7a3', '#d9a07a', '#8d5a3c', '#f6d2b0', '#c68a62', '#e8b48f'];
const HAIR = ['#5a2d1a', '#1d1d26', '#2b1a10', '#c7772a', '#1d1d26', '#6b3b20'];

/** Заглушка фигурки-человечка на подставке (позже — модель «token» из Blender). */
function Figurine({ token, color }: { token: number; color: string }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[-0.05, 0.13, 0]} castShadow>
        <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
        <meshStandardMaterial color="#2d2a45" />
      </mesh>
      <mesh position={[0.05, 0.13, 0]} castShadow>
        <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
        <meshStandardMaterial color="#2d2a45" />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.14, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial color={SKIN[token % SKIN.length]} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.54, -0.01]} castShadow>
        <sphereGeometry args={[0.095, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HAIR[token % HAIR.length]} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Ghost() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.32 + Math.sin(clock.elapsedTime * 2) * 0.05;
  });
  return (
    <group ref={ref}>
      <Model
        slot="ghost"
        fallback={
          <group>
            <mesh>
              <sphereGeometry args={[0.16, 20, 16]} />
              <meshStandardMaterial color="#b48cff" emissive="#7b4dff" emissiveIntensity={0.4} transparent opacity={0.8} />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <coneGeometry args={[0.16, 0.22, 20, 1, true]} />
              <meshStandardMaterial color="#b48cff" emissive="#7b4dff" emissiveIntensity={0.4} transparent opacity={0.8} />
            </mesh>
            <mesh position={[-0.05, 0.03, 0.14]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color="#2b1a4a" />
            </mesh>
            <mesh position={[0.05, 0.03, 0.14]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color="#2b1a4a" />
            </mesh>
          </group>
        }
      />
    </group>
  );
}

function Token({ player }: { player: Player }) {
  const ref = useRef<Group>(null);
  const queue = useGame((s) => s.moves[player.id]);
  const finishMove = useGame((s) => s.finishMove);
  const anim = useRef<{ path: number[]; direct: boolean; t: number; seg: number } | null>(null);

  const segment = queue?.[0];
  useEffect(() => {
    if (!segment) return;
    const path: number[] = [];
    const direct = segment.direct || segment.steps === 0;
    if (direct) path.push(segment.from, segment.to);
    else {
      const dir = segment.steps > 0 ? 1 : -1;
      for (let k = 0; k <= Math.abs(segment.steps); k++) path.push((((segment.from + dir * k) % 40) + 40) % 40);
    }
    anim.current = { path, direct, t: 0, seg: 0 };
  }, [segment]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (!a) {
      const [x, y, z] = tileSpot(player.position, player.token, player.inJail);
      const k = Math.min(1, dt * 10);
      g.position.x += (x - g.position.x) * k;
      g.position.z += (z - g.position.z) * k;
      g.position.y = y;
      return;
    }
    const dur = a.direct ? DIRECT_TIME : STEP_TIME;
    a.t += Math.min(dt, 0.05);
    const from = a.path[a.seg]!;
    const to = a.path[a.seg + 1]!;
    const k = Math.min(1, a.t / dur);
    const isLast = a.seg + 1 === a.path.length - 1;
    const [x0, y0, z0] = tileSpot(from, player.token, false);
    const [x1, , z1] = tileSpot(to, player.token, isLast && player.inJail);
    const e = k * k * (3 - 2 * k);
    g.position.set(x0 + (x1 - x0) * e, y0 + Math.sin(k * Math.PI) * (a.direct ? 1.6 : 0.4), z0 + (z1 - z0) * e);
    // Фигурка смотрит по ходу движения.
    if (Math.abs(x1 - x0) + Math.abs(z1 - z0) > 0.01) g.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    if (k >= 1) {
      a.seg += 1;
      a.t = 0;
      if (a.seg >= a.path.length - 1) {
        anim.current = null;
        finishMove(player.id);
        g.rotation.y = 0;
      }
    }
  });

  const initial = useRef(tileSpot(player.position, player.token, player.inJail));
  return (
    <group ref={ref} position={initial.current}>
      <group scale={1.35}>
        {player.bankrupt ? (
          <Ghost />
        ) : (
          <Model slot="token" tint={player.color} fallback={<Figurine token={player.token} color={player.color} />} />
        )}
      </group>
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
