// Upgrades (levels 1–3) on the group strip and traps (cones) on tiles.
import { Suspense } from 'react';
import { useStore } from '../state/store';
import { useMapDef } from '../ui/mapNow';
import { DIORAMA } from './quality';
import { Prop, packOfMap, upgradeBuilding } from './props';
import { Model } from './assets';
import { MeshPhysicalMaterial } from 'three';
import { crystalGeometry } from './jelly';
import type { ModelSlot } from './assets';
import { TILE_HEIGHT, tileRect } from './layout';
import type { Profile } from './layout';

const gemMaterials = new Map<string, MeshPhysicalMaterial>();
function gemMaterial(color: string): MeshPhysicalMaterial {
  let m = gemMaterials.get(color);
  if (!m) {
    m = new MeshPhysicalMaterial({ color, roughness: 0.1, clearcoat: 1, flatShading: true, emissive: color, emissiveIntensity: 0.3, specularIntensity: 1 });
    gemMaterials.set(color, m);
  }
  return m;
}

/** Upgrade level = number of crystals in the owner's colour. */
function UpgradeModel({ level, color }: { level: number; color: string }) {
  const slot = `upgrade${level}` as ModelSlot;
  const mat = gemMaterial(color);
  const spots: [number, number, number][] = [
    [0, 0, 0],
    [-0.15, 0, 0.06],
    [0.13, 0, 0.08],
  ];
  const fallback = (
    <group>
      {spots.slice(0, level).map((p, k) => (
        <mesh key={k} geometry={crystalGeometry()} material={mat} position={p} rotation={[0, k * 0.7 + 0.3, 0]} scale={k === 0 && level === 3 ? 1.25 : 1} castShadow />
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
  const map = useMapDef();
  if (!tiles) return null;
  const pack = packOfMap(map.id);
  return (
    <group>
      {tiles.map((o, i) => {
        if (!o || o.level === 0) return null;
        // Crystals sit in the card's top-right corner (as on the reference), clear of icon and name.
        const r = tileRect(i, profile);
        const color = players?.find((p) => p.seat === o.owner)?.color ?? '#ffffff';
        if (DIORAMA) {
          // Diorama: a themed building grows on the card's top corner (bigger with every level).
          const fit = (profile.id === 'portrait' ? 0.3 : 0.36) + o.level * 0.04;
          return (
            <Suspense key={`u${i}`} fallback={null}>
              <Prop pack={pack} name={upgradeBuilding(pack, o.level, color)} fit={fit} maxHeight={0.25 + o.level * 0.12} position={[r.x + r.w / 2 - fit / 2 - 0.05, TILE_HEIGHT, r.z - r.d / 2 + fit / 2 + 0.05]} />
            </Suspense>
          );
        }
        return (
          <group key={`u${i}`} position={[r.x + r.w / 2 - 0.24, TILE_HEIGHT, r.z - r.d / 2 + 0.22]} scale={profile.id === 'portrait' ? 1.3 : 1.7}>
            <UpgradeModel level={o.level} color={color} />
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
