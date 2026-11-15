// KayKit scenery and buildings (CC0, Kay Lousberg). One GLB per theme (scripts/build-props.mjs);
// every model is a top-level node named after its source file. <Prop> clones one, scales it so its
// footprint fits `fit` world units and stands it on y = 0.
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { Box3, BufferAttribute, BufferGeometry, Group as ThreeGroup, Matrix4, Mesh as ThreeMesh, Vector3 } from 'three';
import type { Group, Material, Mesh, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

/** Placement of one model in a merged batch. */
export interface Placement {
  name: string;
  fit: number;
  maxHeight?: number;
  x: number;
  z: number;
  rot: number;
  y?: number;
}

/** Same scaling as <Prop>: model-local matrix that fits the footprint and stands it on y = 0. */
function fitMatrix(src: Object3D, fit: number, maxHeight: number | undefined): Matrix4 {
  const box = new Box3().setFromObject(src);
  const size = box.getSize(new Vector3());
  const k = Math.min(fit / Math.max(size.x, size.z, 0.001), (maxHeight ?? fit) / Math.max(size.y, 0.001));
  const c = box.getCenter(new Vector3());
  return new Matrix4().makeTranslation(-c.x * k, -box.min.y * k, -c.z * k).multiply(new Matrix4().makeScale(k, k, k));
}

/** Float copy with only position/normal/uv (quantized glTF attributes are normalized ints). */
function plainGeometry(g: BufferGeometry): BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const out = new BufferGeometry();
  const n = src.getAttribute('position').count;
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
    const a = src.getAttribute(name);
    const arr = new Float32Array(n * size);
    if (a) for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = a.getComponent(i, k);
    out.setAttribute(name, new BufferAttribute(arr, size));
  }
  return out;
}

/**
 * Static scenery as ONE mesh per material: hundreds of small KayKit pieces become a handful of draw
 * calls (and shadow-pass draws). Models are looked up in the pack scene by name.
 */
export function buildMerged(scene: Object3D, items: Placement[], shadows = true): ThreeGroup {
  const byMat = new Map<Material, BufferGeometry[]>();
  for (const it of items) {
    const src = scene.children.find((c) => c.name === it.name);
    if (!src) continue;
    const base = src.clone(true);
    base.position.set(0, 0, 0);
    base.rotation.set(0, 0, 0);
    base.scale.set(1, 1, 1);
    base.updateMatrixWorld(true);
    const place = new Matrix4()
      .makeTranslation(it.x, it.y ?? 0, it.z)
      .multiply(new Matrix4().makeRotationY(it.rot))
      .multiply(fitMatrix(base, it.fit, it.maxHeight));
    base.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const g = plainGeometry(m.geometry);
      g.applyMatrix4(new Matrix4().multiplyMatrices(place, m.matrixWorld));
      const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
      const list = byMat.get(mat) ?? [];
      list.push(g);
      byMat.set(mat, list);
    });
  }
  const group = new ThreeGroup();
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new ThreeMesh(merged, mat);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.raycast = () => undefined;
    group.add(mesh);
  }
  return group;
}

/** Merged scenery batch as a React element (geometry freed on unmount). */
export function MergedProps({ pack, items }: { pack: PropPack; items: Placement[] }) {
  const gltf = useGLTF(URL[pack], false, true) as unknown as { scene: Group };
  const group = useMemo(() => buildMerged(gltf.scene, items), [gltf, items]);
  useEffect(
    () => () =>
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.geometry.dispose();
      }),
    [group],
  );
  return <primitive object={group} />;
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
