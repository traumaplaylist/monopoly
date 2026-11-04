// Player character assembled from wardrobe parts (Quaternius CC0 outfits, one shared skeleton).
// Each of the four slots can come from a different outfit file: the slot mesh is re-bound to the
// skeleton of the body outfit. Colours are applied by material name (skin, hair, shirt, pants).
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { AnimationMixer, Box3, Color, DoubleSide, Group, LoopOnce, LoopRepeat, MeshStandardMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import type { AnimationClip, Bone, Material, Mesh, Object3D } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { OUTFITS, SLOTS } from '@pb/content';
import type { Appearance, OutfitDef, Slot } from '@pb/content';
import { figureGeometry, jellyMaterial } from './jelly';

export const CLIPS_URL = 'models/characters/clips.glb';
const BACKPACK_OUTFIT = 'male-adventurer';
/** Head bone scale: slightly bigger head reads «cute» and stays recognisable on the small board. */
const HEAD_SCALE = 1.28;

const byId = new Map(OUTFITS.map((o) => [o.id, o]));
const outfit = (id: string): OutfitDef => byId.get(id) ?? OUTFITS[0]!;

/** GLTF hook without DRACO (our files use meshopt only). */
const load = (url: string) => useGLTF(url, false, true);

/** Files needed for an appearance (unique), for preloading. */
export function characterFiles(a: Appearance): string[] {
  const ids = new Set(SLOTS.map((s) => a[s]));
  if (a.backpack && a.pack === 'male') ids.add(BACKPACK_OUTFIT);
  return [...ids].map((id) => outfit(id).file);
}

export function preloadCharacter(a: Appearance) {
  for (const f of characterFiles(a)) useGLTF.preload(f, false, true);
  useGLTF.preload(CLIPS_URL, false, true);
}

function shade(hex: string, k: number): Color {
  return new Color(hex).lerp(new Color(k < 0 ? '#000000' : '#ffffff'), Math.abs(k));
}

function recolor(mesh: Mesh, a: Appearance, slot: string | null, ghost: boolean) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((m: Material) => {
    if (ghost) return jellyMaterial('#ffffff', true);
    const c = (m as MeshStandardMaterial).clone();
    const name = m.name;
    if (name === 'Skin') c.color = new Color(a.skin);
    else if (name === 'Skin_Darker') c.color = shade(a.skin, -0.15);
    else if (/^Hair/.test(name) || name === 'Moustache') c.color = new Color(a.hair);
    else if (name === 'Eyebrows') c.color = shade(a.hair, -0.25);
    else if (slot === 'body' && a.shirt !== 'orig' && name === outfit(a.body).shirt) c.color = new Color(a.shirt);
    else if (slot === 'legs' && a.pants !== 'orig' && name === outfit(a.legs).pants) c.color = new Color(a.pants);
    c.roughness = Math.min(0.9, (c as MeshStandardMaterial).roughness ?? 0.8);
    return c;
  });
  mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
}

function bonesByName(root: Object3D): Map<string, Bone> {
  const map = new Map<string, Bone>();
  root.traverse((o) => {
    if ((o as Bone).isBone) map.set(o.name, o as Bone);
  });
  return map;
}

/** Object with exactly this name (a slot node: a mesh, or a group of per-material meshes). */
function findNamed(root: Object3D, name: string): Object3D | null {
  let hit: Object3D | null = null;
  root.traverse((o) => {
    if (!hit && o.name === name) hit = o;
  });
  return hit;
}

function meshesIn(o: Object3D): Mesh[] {
  const res: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) res.push(x as Mesh);
  });
  return res;
}

/** Builds a posable group: body outfit skeleton + slot nodes from other outfits re-bound to it. */
export function assemble(scenes: Map<string, Object3D>, a: Appearance, ghost: boolean, only?: Slot): Group {
  const bodyDef = outfit(a.body);
  const main = cloneSkinned(scenes.get(bodyDef.file)!) as Group;
  const bones = bonesByName(main);
  // Keep / drop the body outfit's own slot nodes.
  const nodeNames = [...SLOTS.map((sl) => bodyDef.slots[sl]), 'Backpack'];
  for (const name of nodeNames) {
    const node = findNamed(main, name);
    if (!node) continue;
    const slot = SLOTS.find((sl) => bodyDef.slots[sl] === name) ?? null;
    const keep = slot ? a[slot] === a.body && (!only || only === slot) : a.backpack && a.body === BACKPACK_OUTFIT && !only;
    if (!keep) {
      node.removeFromParent();
      continue;
    }
    for (const m of meshesIn(node)) recolor(m, a, slot, ghost);
  }
  const graft = (fromFile: string, nodeName: string, slot: Slot | null) => {
    const src = cloneSkinned(scenes.get(fromFile)!);
    const node = findNamed(src, nodeName);
    if (!node) return;
    const parentName = node.parent?.name;
    const parent: Object3D = (parentName && findNamed(main, parentName)) || main;
    parent.add(node);
    for (const m of meshesIn(node)) {
      const sm = m as SkinnedMesh;
      if (sm.isSkinnedMesh) sm.bind(new Skeleton(sm.skeleton.bones.map((bn) => bones.get(bn.name) ?? bn), sm.skeleton.boneInverses), sm.bindMatrix);
      recolor(m, a, slot, ghost);
    }
  };
  for (const slot of SLOTS) {
    const id = a[slot];
    if (id !== a.body && (!only || only === slot)) graft(outfit(id).file, outfit(id).slots[slot], slot);
  }
  if (!only && a.backpack && a.pack === 'male' && a.body !== BACKPACK_OUTFIT) graft(outfit(BACKPACK_OUTFIT).file, 'Backpack', null);
  main.traverse((o) => {
    o.castShadow = !ghost;
    o.frustumCulled = false; // skinned bounds are unreliable after re-binding
  });
  bones.get('Head')?.scale.setScalar(HEAD_SCALE);
  return main;
}

/** Clip tracks without scale (keeps the bigger head) for the shared skeleton. */
function useClips(): AnimationClip[] {
  const g = load(CLIPS_URL);
  return useMemo(
    () =>
      g.animations.map((c) => {
        const k = c.clone();
        k.tracks = k.tracks.filter((t) => !t.name.endsWith('.scale'));
        return k;
      }),
    [g],
  );
}

export type CharacterMode = 'still' | 'idle';
export type CharacterAction = 'walk' | 'cheer' | null;

function Assembled({ a, height, ghost, mode, wave, only, action }: { a: Appearance; height: number; ghost: boolean; mode: CharacterMode; wave: number; only?: Slot; action: CharacterAction }) {
  // Always exactly five loads (head, body, legs, feet, backpack-or-body) so the hook order is stable;
  // repeated files come from the loader cache.
  const files = [
    outfit(a.head).file,
    outfit(a.body).file,
    outfit(a.legs).file,
    outfit(a.feet).file,
    outfit(a.backpack && a.pack === 'male' ? BACKPACK_OUTFIT : a.body).file,
  ];
  const g0 = load(files[0]!);
  const g1 = load(files[1]!);
  const g2 = load(files[2]!);
  const g3 = load(files[3]!);
  const g4 = load(files[4]!);
  const gltfs = [g0, g1, g2, g3, g4];
  const clips = useClips();
  const key = JSON.stringify(a) + ghost + (only ?? '');
  const { root, scale, offset, cx, cz } = useMemo(() => {
    const scenes = new Map(files.map((f, i) => [f, gltfs[i]!.scene as Object3D]));
    const r = assemble(scenes, a, ghost, only);
    // Pose with the idle clip before measuring, so the height is the standing one.
    const mixer = new AnimationMixer(r);
    const idle = clips.find((c) => c.name === 'Idle');
    if (idle) {
      mixer.clipAction(idle).play();
      mixer.setTime(0.3);
    }
    r.updateMatrixWorld(true);
    const box = new Box3().setFromObject(r);
    const size = box.getSize(new Vector3());
    // Thumbnails (one slot) fit the whole box and are centred; full figures stand on y = 0 at `height`.
    const s = height / Math.max(0.001, only ? Math.max(size.x, size.y, size.z) : size.y);
    const c = box.getCenter(new Vector3());
    return { root: r, scale: s, offset: only ? 0.5 - c.y * s : -box.min.y * s, cx: only ? -c.x * s : 0, cz: only ? -c.z * s : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height, clips]);

  const mixer = useMemo(() => new AnimationMixer(root), [root]);
  useEffect(() => {
    const idle = clips.find((c) => c.name === 'Idle');
    if (idle) {
      mixer.clipAction(idle).play();
      mixer.setTime(0.3);
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, clips]);
  const lastWave = useRef(wave);
  useEffect(() => {
    if (wave === lastWave.current) return;
    lastWave.current = wave;
    const w = clips.find((c) => c.name === 'Wave');
    if (!w) return;
    const act = mixer.clipAction(w);
    act.reset().setLoop(LoopOnce, 1).fadeIn(0.15).play();
    act.clampWhenFinished = false;
  }, [wave, mixer, clips]);
  // Board actions: walk while the token moves, cheer (looped wave) for the winner.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const idle = clips.find((c) => c.name === 'Idle');
    const walk = clips.find((c) => c.name === 'Walk');
    const cheer = clips.find((c) => c.name === 'Wave');
    const idleAct = idle ? mixer.clipAction(idle) : null;
    const walkAct = walk ? mixer.clipAction(walk) : null;
    const cheerAct = cheer ? mixer.clipAction(cheer) : null;
    if (action === 'walk' && walkAct) {
      walkAct.reset().setEffectiveTimeScale(1.7).fadeIn(0.12).play();
      idleAct?.fadeOut(0.12);
    } else if (action === 'cheer' && cheerAct) {
      cheerAct.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.2).play();
      idleAct?.fadeOut(0.2);
    } else {
      walkAct?.stop();
      cheerAct?.stop();
      if (idleAct) {
        idleAct.reset().setEffectiveWeight(1).play();
        mixer.setTime(0.3);
      }
    }
    invalidate();
  }, [action, mixer, clips, invalidate]);
  useFrame((_, dt) => {
    if (mode === 'idle' || action) {
      mixer.update(Math.min(dt, 0.05));
      if (action) invalidate(); // frameloop="demand": keep drawing while acting
    }
  });
  return (
    <group scale={scale} position={[cx, offset, cz]}>
      <primitive object={root} />
    </group>
  );
}

/** Simple placeholder while the parts load (also the fallback if a file fails). */
function Placeholder({ a, height, ghost }: { a: Appearance; height: number; ghost: boolean }) {
  const mat = jellyMaterial(a.shirt === 'orig' ? '#8b55e6' : a.shirt, ghost);
  return <mesh geometry={figureGeometry()} material={mat} scale={height / 0.8} />;
}

/**
 * Character figure. `seatColor` draws the ring that identifies the seat on the board;
 * `mode="idle"` animates (wardrobe), `still` keeps a static standing pose (board, no redraws).
 */
export function Character({
  appearance: a,
  height = 1,
  seatColor,
  ghost = false,
  mode = 'still',
  wave = 0,
  only,
  action = null,
}: {
  appearance: Appearance;
  height?: number;
  seatColor?: string;
  ghost?: boolean;
  mode?: CharacterMode;
  wave?: number;
  /** Show a single slot (wardrobe thumbnails). */
  only?: Slot;
  /** Board animation: walking along the path, or cheering (winner). */
  action?: CharacterAction;
}) {
  return (
    <group>
      {seatColor && !ghost && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} scale={height}>
          <ringGeometry args={[0.2, 0.29, 32]} />
          <meshStandardMaterial color={seatColor} emissive={seatColor} emissiveIntensity={0.35} side={DoubleSide} />
        </mesh>
      )}
      <Suspense fallback={<Placeholder a={a} height={height} ghost={ghost} />}>
        <Assembled a={a} height={height} ghost={ghost} mode={mode} wave={wave} only={only} action={action} />
      </Suspense>
    </group>
  );
}
