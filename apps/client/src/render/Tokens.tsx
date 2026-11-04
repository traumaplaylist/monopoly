import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { PublicPlayer } from '@pb/game-core';
import { currentSeat } from '../ui/hooks';
import { WORLD, defaultAppearance, sanitizeAppearance } from '@pb/content';
import { get, set, useStore } from '../state/store';
import { TILE_HEIGHT, outward, tileRect } from './layout';
import type { Profile } from './layout';
import { Character } from './character';

const STEP_TIME = 0.24;
const N = WORLD.tiles.length;

/**
 * Standing spot. Tokens stand just inside the ring (towards the board centre) in a row along the
 * tile, so they never cover the tile's name and price; corner tiles are big enough to stand on.
 */
export function tileSpot(index: number, slot: number, profile: Profile): [number, number, number] {
  const r = tileRect(index, profile);
  if (r.corner) {
    const fx = (slot % 2 === 0 ? -1 : 1) * 0.24;
    const fz = (slot < 2 ? -1 : 1) * 0.2;
    return [r.x + fx * r.w, TILE_HEIGHT, r.z + fz * r.d];
  }
  const [ox, oz] = outward(r.side);
  const along = (slot - 1.5) * (profile.id === 'portrait' ? 0.2 : 0.26);
  // Top row: figures rise up the screen over the card, so they step further inward.
  const inset = r.side === 0 ? 0.42 : 0.2;
  const depth = (r.side % 2 === 0 ? r.d : r.w) / 2 + inset;
  const x = r.x - ox * depth + (r.side % 2 === 0 ? along : 0);
  const z = r.z - oz * depth + (r.side % 2 === 1 ? along : 0) + (slot % 2) * 0.06;
  return [x, 0, z];
}

function Token({ player, slot, profile }: { player: PublicPlayer; slot: number; profile: Profile }) {
  const ref = useRef<Group>(null);
  const move = useStore((s) => s.moves.find((m) => m.seat === player.seat));
  const anim = useRef<{ path: number[]; t: number; seg: number } | null>(null);
  const yaw = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  const winner = useStore((s) => s.match?.phase === 'FINISHED' && !!s.match.standings?.some((x) => x.seat === player.seat && x.winner));
  const active = useStore((s) => (s.match ? currentSeat(s.match) === player.seat : false));
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!move) return;
    const path: number[] = [];
    const n = Math.abs(move.steps);
    const dir = move.steps >= 0 ? 1 : -1;
    for (let k = 0; k <= n; k++) path.push((((move.from + dir * k) % N) + N) % N);
    if (path[path.length - 1] !== move.to) path.push(move.to);
    anim.current = { path, t: 0, seg: 0 };
    setWalking(true);
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
    g.position.set(x0 + (x1 - x0) * e, y0 + Math.sin(k * Math.PI) * 0.06, z0 + (z1 - z0) * e);
    // Face the way we walk (the figure's front is +Z).
    if (yaw.current && (Math.abs(x1 - x0) + Math.abs(z1 - z0) > 0.001)) {
      const want = Math.atan2(x1 - x0, z1 - z0);
      let d = want - yaw.current.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw.current.rotation.y += d * Math.min(1, Math.min(dt, 0.05) * 14);
    }
    if (k >= 1) {
      a.seg += 1;
      a.t = 0;
      if (a.seg >= a.path.length - 1) {
        anim.current = null;
        setWalking(false);
        if (yaw.current) yaw.current.rotation.y = 0;
        const moves = get().moves;
        const i = moves.findIndex((m) => m.seat === player.seat);
        if (i >= 0) set({ moves: [...moves.slice(0, i), ...moves.slice(i + 1)] });
      }
    }
  });

  const initial = useRef(tileSpot(player.position, slot, profile));
  if (player.role === 'left') return null;
  const ghost = player.role === 'ghost';
  const scale = profile.id === 'portrait' ? 0.62 : 0.78;
  return (
    <group ref={ref} position={initial.current}>
      {/* Whose turn: the figure stands a bit taller (static, so idle frames are not redrawn). */}
      <group scale={active ? scale * 1.12 : scale} rotation={[-0.85, (slot - 1.5) * 0.12, 0]}>
        <group ref={yaw}>
          <Character
            appearance={sanitizeAppearance(player.appearance, defaultAppearance(slot))}
            height={1.35}
            seatColor={player.color}
            ghost={ghost}
            action={walking ? 'walk' : winner ? 'cheer' : null}
          />
        </group>
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
