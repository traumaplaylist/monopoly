// Head-and-shoulders portraits of player characters, rendered once per look into a small image
// (one shared offscreen renderer, results cached) — the HUD shows the character people built
// in the wardrobe without keeping a live 3D canvas per player card.
import { AmbientLight, AnimationMixer, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OUTFITS } from '@pb/content';
import type { Appearance } from '@pb/content';
import { CLIPS_URL, assemble, characterFiles } from './character';

const SIZE = 192;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltfCache = new Map<string, Promise<{ scene: Object3D; animations: AnimationClip[] }>>();
const loadGltf = (url: string) => {
  let p = gltfCache.get(url);
  if (!p) gltfCache.set(url, (p = loader.loadAsync(url).then((g) => ({ scene: g.scene, animations: g.animations }))));
  return p;
};

let renderer: WebGLRenderer | null = null;
function getRenderer(): WebGLRenderer {
  if (!renderer) {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
  }
  return renderer;
}

const cache = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

async function render(a: Appearance, ghost: boolean): Promise<string | null> {
  const files = [...new Set([...characterFiles(a), ...['head', 'body', 'legs', 'feet'].map((s) => OUTFITS.find((o) => o.id === a[s as 'head'])!.file)])];
  const loaded = await Promise.all(files.map(loadGltf));
  const clips = (await loadGltf(CLIPS_URL)).animations;
  const scenes = new Map(files.map((f, i) => [f, loaded[i]!.scene]));
  const root = assemble(scenes, a, ghost);
  const idle = clips.find((c) => c.name === 'Idle');
  if (idle) {
    const k = idle.clone();
    k.tracks = k.tracks.filter((t) => !t.name.endsWith('.scale'));
    const mixer = new AnimationMixer(root);
    mixer.clipAction(k).play();
    mixer.setTime(0.3);
  }
  root.rotation.y = 0.35;
  const scene = new Scene();
  scene.add(root);
  scene.add(new HemisphereLight('#ffffff', '#6a5aa8', 1.3));
  scene.add(new AmbientLight('#ffffff', 0.25));
  const sun = new DirectionalLight('#ffffff', 1.8);
  sun.position.set(1.5, 2.5, 2.5);
  scene.add(sun);
  scene.updateMatrixWorld(true);
  const head = new Vector3();
  let found = false;
  root.traverse((o) => {
    if (!found && o.name === 'Head') {
      o.getWorldPosition(head);
      found = true;
    }
  });
  const cam = new PerspectiveCamera(26, 1, 0.01, 50);
  const target = head.clone().add(new Vector3(0, 0.1, 0));
  cam.position.copy(target).add(new Vector3(0.05, 0.02, 1.25));
  cam.lookAt(target);
  const r = getRenderer();
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}

/** Data URL of the portrait (cached per look); null if WebGL or a model is unavailable. */
export function characterPortrait(a: Appearance, ghost = false): Promise<string | null> {
  const key = JSON.stringify(a) + ghost;
  let p = cache.get(key);
  if (!p) {
    p = queue.then(() => render(a, ghost)).catch(() => null);
    queue = p;
    cache.set(key, p);
  }
  return p;
}
