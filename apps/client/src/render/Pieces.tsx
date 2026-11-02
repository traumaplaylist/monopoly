// Upgrades (levels 1–3) on the group strip and traps (cones) on tiles.
import { useStore } from '../state/store';
import { Model } from './assets';
import { hotelGeometry, houseGeometry, jellyMaterial } from './jelly';
import type { ModelSlot } from './assets';
import { TILE_HEIGHT, tileRect } from './layout';
import type { Profile } from './layout';

function UpgradeModel({ level, color }: { level: number; color: string }) {
  const slot = `upgrade${level}` as ModelSlot;
  const mat = jellyMaterial(color);
  const fallback =
    level === 3 ? (
      <mesh geometry={hotelGeometry()} material={mat} castShadow />
    ) : (
      <group>
        {Array.from({ length: level }, (_, k) => (
          <mesh key={k} geometry={houseGeometry()} material={mat} position={[(k - (level - 1) / 2) * 0.22, 0, 0]} castShadow />
        ))}
      </group>
    );
  return <Model slot={slot} tint={color} fallback={fallback} />;
}

function Cone({ ghost }: { ghost: boolean }) {
  const c = ghost ? '#a77bff' : '#ff7a2f';
  return (
    <Model
      slot="cone"
      tint={c}
      fallback={
        <group>
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[0.24, 0.04, 0.24]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 0.17, 0]} castShadow>
            <coneGeometry args={[0.09, 0.28, 10]} />
            <meshStandardMaterial color={c} flatShading />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.062, 0.068, 0.04, 10]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      }
    />
  );
}

export function Pieces({ profile }: { profile: Profile }) {
  const tiles = useStore((s) => s.match?.tiles);
  const traps = useStore((s) => s.match?.traps);
  const players = useStore((s) => s.match?.players);
  if (!tiles) return null;
  return (
    <group>
      {tiles.map((o, i) => {
        if (!o || o.level === 0) return null;
        // Upgrades stand on the card's caption band (top edge on screen), clear of name and price.
        const r = tileRect(i, profile);
        return (
          <group key={`u${i}`} position={[r.x, TILE_HEIGHT, r.z - r.d / 2 + 0.2]} scale={profile.id === 'portrait' ? 1.2 : 1.45}>
            <UpgradeModel level={o.level} color={players?.find((p) => p.seat === o.owner)?.color ?? '#ffffff'} />
          </group>
        );
      })}
      {traps?.map((t) => {
        const r = tileRect(t.tile, profile);
        return (
          <group key={`t${t.tile}`} position={[r.x + r.w * 0.28, TILE_HEIGHT, r.z + r.d * 0.12]}>
            <Cone ghost={t.source === 'ghost'} />
          </group>
        );
      })}
    </group>
  );
}
