// Packs selected KayKit (CC0, Kay Lousberg, www.kaylousberg.com) models into one GLB per board theme.
// Every source model becomes a top-level node named after its file (without extension); the client
// clones nodes by name. Input: folder with the cloned KayKit repositories.
// Usage: node scripts/build-props.mjs <kaykit-folder>
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune, quantize, unpartition } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-props.mjs <kaykit-folder>');
const OUT = 'apps/client/public/models/props';

const CITY = 'KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf';
const SPACE = 'KayKit-Space-Base-Bits-1.0/addons/kaykit_space_base_bits/Assets/gltf';
const MED = 'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf';

const PACKS = {
  city: [
    ...'ABCDEFGH'.split('').map((l) => `${CITY}/building_${l}_withoutBase.gltf`),
    ...'ABCDEFGH'.split('').map((l) => `${CITY}/building_${l}.gltf`),
    ...['base', 'road_straight', 'road_straight_crossing', 'road_junction', 'road_tsplit', 'road_corner', 'road_corner_curved', 'box_A', 'trash_A'].map((n) => `${CITY}/${n}.gltf`),
    ...['bush', 'car_taxi', 'car_sedan', 'car_hatchback', 'car_police', 'streetlight', 'watertower', 'bench', 'firehydrant', 'trafficlight_A', 'dumpster'].map((n) => `${CITY}/${n}.gltf`),
  ],
  space: [
    'basemodule_A', 'basemodule_B', 'basemodule_C', 'basemodule_D', 'basemodule_E', 'basemodule_garage', 'cargodepot_A', 'cargodepot_B',
    'landingpad_small', 'lander_A', 'lander_B', 'rock_A', 'rock_B', 'rocks_A', 'rocks_B', 'solarpanel', 'windturbine_tall', 'structure_tall',
    'drill_structure', 'spacetruck', 'containers_A', 'roofmodule_solarpanels', 'lights',
  ].map((n) => `${SPACE}/${n}.gltf`),
  village: [
    ...['home_A', 'home_B', 'tavern', 'market', 'church', 'tower_A', 'windmill', 'well', 'lumbermill', 'watermill'].flatMap((b) =>
      ['red', 'blue', 'yellow', 'green'].map((c) => `${MED}/buildings/${c}/building_${b}_${c}.gltf`),
    ),
    ...['trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small', 'tree_single_A', 'tree_single_B',
      'mountain_A_grass_trees', 'mountain_B_grass_trees', 'hills_A_trees', 'hills_B_trees', 'rock_single_A', 'rock_single_B', 'cloud_big', 'cloud_small'].map(
      (n) => `${MED}/decoration/nature/${n}.gltf`,
    ),
  ],
};

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [pack, files] of Object.entries(PACKS)) {
  const target = await io.read(path.join(SRC, files[0]));
  const root = target.getRoot();
  const scene = root.listScenes()[0];
  const wrap = (sc, name) => {
    const holder = target.createNode(name);
    for (const n of sc.listChildren()) {
      sc.removeChild(n);
      holder.addChild(n);
    }
    scene.addChild(holder);
  };
  wrap(scene, path.basename(files[0], '.gltf'));
  for (const f of files.slice(1)) {
    const full = path.join(SRC, f);
    if (!fs.existsSync(full)) {
      console.warn('missing', f);
      continue;
    }
    const src = await io.read(full);
    const map = mergeDocuments(target, src);
    const merged = map.get(src.getRoot().listScenes()[0]);
    wrap(merged, path.basename(f, '.gltf'));
    merged.dispose();
  }
  await target.transform(unpartition(), dedup(), prune({ keepLeaves: true }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, `${pack}.glb`);
  await io.write(out, target);
  const size = fs.statSync(out).size;
  total += size;
  console.log(`${pack.padEnd(8)} ${files.length} models, ${(size / 1024).toFixed(0)} KB, textures ${target.getRoot().listTextures().length}`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB`);
