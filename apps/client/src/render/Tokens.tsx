import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { PublicPlayer } from '@pb/game-core';
import { currentSeat } from '../ui/hooks';
import { get, set, useStore } from '../state/store';
import { Model } from './assets';
import { TILE_HEIGHT, tileRect } from './layout';
import type { Profile } from './layout';
import { JellyFigure } from './jelly';

const STEP_TIME = 0.16;

/** Standing spot: each seat has its own corner of the tile so tokens never overlap. */
export function tileSpot(index: number, slot: number, profile: Profile): [number, number, number] {
  const r = tileRect(index, profile);
  const fx = (slot % 2 === 0 ? -1 : 1) * 0.22;
  const fz = (slot < 2 ? -1 : 1) * 0.18;
  return [r.x + fx * r.w, TILE_HEIGHT, r.z + fz * r.d];
}

function Token({ player, slot, profile }: { player: PublicPlayer; slot: number; profile: Profile }) {
  const ref = useRef<Group>(null);
  const move = useStore((s) => s.moves.find((m) => m.seat === player.seat));
  const anim = useRef<{ path: number[]; t: number; seg: number } | null>(null);
  const active = useStore((s) => (s.match ? currentSeat(s.match) === player.seat : false));
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!move) return;
    const path: number[] = [];
    const n = Math.abs(move.steps);
    const dir = move.steps >= 0 ? 1 : -1;
    for (let k = 0; k <= n; k++) path.push((((move.from + dir * k) % 32) + 32) % 32);
    if (path[path.length - 1] !== move.to) path.push(move.to);
    anim.current = { path, t: 0, seg: 0 };
    invalidate();
  }, [move, invalidate]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (!a) {
      const [x, y, z] = tileSpot(player.position, slot, profile);
      if (Math.abs(x - g.position.x) + Math.abs(z - g.position.z) < 0.002) {
        g.position.set(x, y, z);
        return;
      }
      const k = Math.min(1, dt * 10);
      g.position.x += (x - g.position.x) * k;
      g.position.z += (z - g.position.z) * k;
      g.position.y = y;
      invalidate();
      return;
    }
    invalidate();
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
  const ghost = player.role === 'ghost';
  const scale = profile.id === 'portrait' ? 0.72 : 0.95;
  return (
    <group ref={ref} position={initial.current}>
      {/* Whose turn: the figure stands a bit taller (static, so idle frames are not redrawn). */}
      <group scale={active ? scale * 1.12 : scale} rotation={[-0.45, (slot - 1.5) * 0.12, 0]}>
        <Model slot={ghost ? 'ghost' : 'token'} tint={player.color} fallback={<JellyFigure color={player.color} ghost={ghost} />} />
      </group>
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
