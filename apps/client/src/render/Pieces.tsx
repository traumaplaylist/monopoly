// Upgrades (levels 1–3) on the group strip and traps (cones) on tiles.
import { useStore } from '../state/store';
import { Model } from './assets';
import type { ModelSlot } from './assets';
import { TILE_HEIGHT, stripCenter, tileRect } from './layout';
import type { Profile } from './layout';

function House({ roof = '#e2574c', h = 0.14 }: { roof?: string; h?: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[0.16, h, 0.16]} />
        <meshStandardMaterial color="#f1e2c4" flatShading />
      </mesh>
      <mesh position={[0, h + 0.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.15, 0.11, 4]} />
        <meshStandardMaterial color={roof} flatShading />
      </mesh>
    </group>
  );
}

function UpgradeModel({ level }: { level: number }) {
  const slot = `upgrade${level}` as ModelSlot;
  const fallback =
    level === 1 ? (
      <House />
    ) : level === 2 ? (
      <group>
        <group position={[-0.11, 0, 0]}>
          <House />
        </group>
        <group position={[0.11, 0, 0]}>
          <House roof="#e8a33a" />
        </group>
      </group>
    ) : (
      <group>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[0.34, 0.34, 0.18]} />
          <meshStandardMaterial color="#e2574c" flatShading />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.38, 0.05, 0.22]} />
          <meshStandardMaterial color="#8a2f2a" flatShading />
        </mesh>
      </group>
    );
  return <Model slot={slot} fallback={fallback} />;
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
  if (!tiles) return null;
  return (
    <group>
      {tiles.map((o, i) => {
        if (!o || o.level === 0) return null;
        const c = stripCenter(i, profile);
        return (
          <group key={`u${i}`} position={[c.x, TILE_HEIGHT, c.z]} rotation={[0, c.horizontal ? 0 : Math.PI / 2, 0]}>
            <UpgradeModel level={o.level} />
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
