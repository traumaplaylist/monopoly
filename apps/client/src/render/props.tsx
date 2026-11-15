// KayKit scenery and buildings (CC0, Kay Lousberg). One GLB per theme (scripts/build-props.mjs);
// every model is a top-level node named after its source file. <Prop> clones one, scales it so its
// footprint fits `fit` world units and stands it on y = 0.
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import type { Group, Mesh, Object3D } from 'three';

export type PropPack = 'city' | 'space' | 'village';
const URL: Record<PropPack, string> = {
  city: 'models/props/city.glb',
  space: 'models/props/space.glb',
  village: 'models/props/village.glb',
};

export function preloadProps(pack: PropPack): void {
  useGLTF.preload(URL[pack], false, true);
}

interface PropProps {
  pack: PropPack;
  name: string;
  /** Largest footprint side (x or z) in world units. */
  fit: number;
  /** Height limit (world units); the model shrinks further if it would be taller. Default: fit. */
  maxHeight?: number;
  position?: [number, number, number];
  rotation?: number;
  shadows?: boolean;
}

export function Prop({ pack, name, fit, maxHeight, position = [0, 0, 0], rotation = 0, shadows = true }: PropProps) {
  const gltf = useGLTF(URL[pack], false, true) as unknown as { scene: Group };
  const obj = useMemo(() => {
    const src = gltf.scene.children.find((c) => c.name === name);
    if (!src) return null;
    const copy = src.clone(true) as Object3D;
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.scale.set(1, 1, 1);
    copy.updateMatrixWorld(true);
    const box = new Box3().setFromObject(copy);
    const size = box.getSize(new Vector3());
    const k = Math.min(fit / Math.max(size.x, size.z, 0.001), (maxHeight ?? fit) / Math.max(size.y, 0.001));
    const centre = box.getCenter(new Vector3());
    copy.scale.setScalar(k);
    copy.position.set(-centre.x * k, -box.min.y * k, -centre.z * k);
    copy.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = shadows;
        m.receiveShadow = true;
        m.raycast = () => undefined;
      }
    });
    return copy;
  }, [gltf, name, fit, maxHeight, shadows]);
  if (!obj) return null;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={obj} />
    </group>
  );
}

/** Theme of a board for scenery and buildings. */
export function packOfMap(mapId: string): PropPack {
  return mapId === 'space' ? 'space' : mapId === 'russia' ? 'village' : 'city';
}

const VILLAGE_COLORS = ['red', 'green', 'yellow', 'blue'] as const;
/** Village buildings come in 4 colours: pick the one closest to the owner's seat colour. */
export function villageColor(hex: string): (typeof VILLAGE_COLORS)[number] {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const ref: [number, number, number][] = [
    [226, 87, 76],
    [42, 157, 154],
    [232, 163, 58],
    [138, 82, 201],
  ];
  let best = 0;
  let bd = Infinity;
  ref.forEach(([R, G, B], i) => {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return VILLAGE_COLORS[best]!;
}

/** Building that marks an upgrade level (1–3) on a tile, per theme. */
export function upgradeBuilding(pack: PropPack, level: number, ownerColor: string): string {
  if (pack === 'city') return ['building_A_withoutBase', 'building_C_withoutBase', 'building_H_withoutBase'][level - 1]!;
  if (pack === 'space') return ['lander_A', 'basemodule_E', 'structure_tall'][level - 1]!;
  const c = villageColor(ownerColor);
  return [`building_home_A_${c}`, `building_home_B_${c}`, `building_tower_A_${c}`][level - 1]!;
}
