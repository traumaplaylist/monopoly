import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { PublicPlayer } from '@pb/game-core';
import { get, set, useStore } from '../state/store';
import { Model } from './assets';
import { TILE_HEIGHT, tileRect } from './layout';
import type { Profile } from './layout';
import { drawCharacter, drawGhost, spriteTexture } from './pixelArt';

const STEP_TIME = 0.16;

/** Standing spot: each seat has its own corner of the tile so tokens never overlap. */
export function tileSpot(index: number, slot: number, profile: Profile): [number, number, number] {
  const r = tileRect(index, profile);
  const fx = (slot % 2 === 0 ? -1 : 1) * 0.22;
  const fz = (slot < 2 ? -1 : 1) * 0.18;
  return [r.x + fx * r.w, TILE_HEIGHT, r.z + fz * r.d];
}

function Sprite({ player }: { player: PublicPlayer }) {
  const ghost = player.role === 'ghost';
  const tex = ghost ? spriteTexture('ghost', drawGhost) : spriteTexture(`c${player.avatar}:${player.color}`, () => drawCharacter(player.avatar, player.color));
  const h = ghost ? 0.62 : 0.86;
  const w = ghost ? 0.56 : 0.55;
  return (
    <group>
      {/* stand + simple blob shadow */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 20]} />
        <meshStandardMaterial color={ghost ? '#7b5bc4' : player.color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <sprite position={[0, 0.06 + h / 2, 0]} scale={[w, h, 1]}>
        <spriteMaterial map={tex} transparent alphaTest={0.5} opacity={ghost ? 0.85 : 1} />
      </sprite>
    </group>
  );
}

function Token({ player, slot, profile }: { player: PublicPlayer; slot: number; profile: Profile }) {
  const ref = useRef<Group>(null);
  const move = useStore((s) => s.moves.find((m) => m.seat === player.seat));
  const anim = useRef<{ path: number[]; t: number; seg: number } | null>(null);

  useEffect(() => {
    if (!move) return;
    const path: number[] = [];
    const n = Math.abs(move.steps);
    const dir = move.steps >= 0 ? 1 : -1;
    for (let k = 0; k <= n; k++) path.push((((move.from + dir * k) % 32) + 32) % 32);
    if (path[path.length - 1] !== move.to) path.push(move.to);
    anim.current = { path, t: 0, seg: 0 };
  }, [move]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (!a) {
      const [x, y, z] = tileSpot(player.position, slot, profile);
      const k = Math.min(1, dt * 10);
      g.position.x += (x - g.position.x) * k;
      g.position.z += (z - g.position.z) * k;
      g.position.y = y;
      return;
    }
    a.t += Math.min(dt, 0.05);
    const k = Math.min(1, a.t / STEP_TIME);
    const [x0, y0, z0] = tileSpot(a.path[a.seg]!, slot, profile);
    const [x1, , z1] = tileSpot(a.path[a.seg + 1]!, slot, profile);
    const e = k * k * (3 - 2 * k);
    g.position.set(x0 + (x1 - x0) * e, y0 + Math.sin(k * Math.PI) * 0.35, z0 + (z1 - z0) * e);
    if (k >= 1) {
      a.seg += 1;
      a.t = 0;
      if (a.seg >= a.path.length - 1) {
        anim.current = null;
        const moves = get().moves;
        const i = moves.findIndex((m) => m.seat === player.seat);
        if (i >= 0) set({ moves: [...moves.slice(0, i), ...moves.slice(i + 1)] });
      }
    }
  });

  const initial = useRef(tileSpot(player.position, slot, profile));
  if (player.role === 'left') return null;
  return (
    <group ref={ref} position={initial.current}>
      <Model slot={player.role === 'ghost' ? 'ghost' : 'token'} tint={player.color} fallback={<Sprite player={player} />} />
    </group>
  );
}

export function Tokens({ profile }: { profile: Profile }) {
  const players = useStore((s) => s.match?.players);
  if (!players) return null;
  return (
    <group>
      {players.map((p, i) => (
        <Token key={p.seat} player={p} slot={i} profile={profile} />
      ))}
    </group>
  );
}
