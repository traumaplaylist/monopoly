// Builds the character wardrobe from Quaternius «Ultimate Modular Men/Women» (CC0) GLBs.
// Input: a folder with <Pack>/<Outfit>.glb (one outfit = head + body + legs + feet on one skeleton).
// Output: apps/client/public/models/characters/<pack>-<outfit>.glb (3 clips, no weapons, meshopt)
//         packages/content/src/characterCatalog.ts (slots, recolourable materials, names).
// Usage: node scripts/build-characters.mjs <source-folder>
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-characters.mjs <source-folder>');
const OUT = 'apps/client/public/models/characters';
const KEEP_CLIPS = ['Idle', 'Wave', 'Walk'];
const DROP_NODES = ['Pistol', 'Sword'];
// Military outfits are left out on purpose (family party game).
const SKIP = new Set(['Female/Soldier', 'Male/Swat']);

const NAMES = {
  Adventurer: 'Путешественник', Casual: 'Повседневный', Casual_2: 'Футболка', Casual_Hoodie: 'Худи', Formal: 'Вечерний',
  Medieval: 'Средневековый', Punk: 'Панк', SciFi: 'Космос', Suit: 'Костюм', Witch: 'Волшебница', Worker: 'Рабочий',
  Beach: 'Пляж', Farmer: 'Фермер', King: 'Король', Spacesuit: 'Скафандр',
};
const NOT_CLOTH = /^(Skin|Skin_Darker|Hair.*|Eye|Eyebrows|Moustache|Earrings|Visor)$/;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** Animation.dispose() keeps samplers (and their keyframe accessors) alive: drop them too. */
function dropClip(a) {
  for (const c of a.listChannels()) c.dispose();
  for (const smp of a.listSamplers()) smp.dispose();
  a.dispose();
}

fs.mkdirSync(OUT, { recursive: true });
const catalog = [];
let total = 0;
for (const pack of ['Male', 'Female']) {
  for (const file of fs.readdirSync(path.join(SRC, pack)).filter((f) => f.endsWith('.glb')).sort()) {
    const outfit = file.replace('.glb', '');
    const key = `${pack}/${outfit}`;
    if (SKIP.has(key)) continue;
    const doc = await io.read(path.join(SRC, pack, file));
    const root = doc.getRoot();
    // Same skeleton and clips in every outfit: clips go to one shared file (written once below).
    for (const a of root.listAnimations()) dropClip(a);
    for (const n of root.listNodes()) if (DROP_NODES.includes(n.getName())) n.dispose();
    // Slots: node name suffix (_Head/_Body/_Legs|_Pants/_Feet); materials ranked by triangle count.
    const slots = {};
    const cloth = { body: [], legs: [] };
    let backpack = false;
    for (const n of root.listNodes()) {
      const mesh = n.getMesh();
      if (!mesh) continue;
      const name = n.getName();
      if (name === 'Backpack') {
        backpack = true;
        continue;
      }
      const slot = /_Head$/.test(name) ? 'head' : /_Body$/.test(name) ? 'body' : /_(Legs|Pants)$/.test(name) ? 'legs' : /_Feet$/.test(name) ? 'feet' : null;
      if (!slot) continue;
      slots[slot] = name;
      if (slot === 'body' || slot === 'legs') {
        const tris = new Map();
        for (const p of mesh.listPrimitives()) {
          const m = p.getMaterial()?.getName() ?? '';
          const count = (p.getIndices()?.getCount() ?? 0) / 3;
          tris.set(m, (tris.get(m) ?? 0) + count);
        }
        const ranked = [...tris].filter(([m]) => !NOT_CLOTH.test(m)).sort((a, b) => b[1] - a[1]);
        if (ranked[0]) cloth[slot].push(ranked[0][0]);
      }
    }
    // Accessors left over from removed clips are only referenced by the root: drop them explicitly.
    for (const acc of root.listAccessors()) if (acc.listParents().every((p) => p === root)) acc.dispose();
    await doc.transform(prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const id = `${pack.toLowerCase()}-${outfit.toLowerCase().replace(/_/g, '-')}`;
    const outPath = path.join(OUT, `${id}.glb`);
    await io.write(outPath, doc);
    const size = fs.statSync(outPath).size;
    total += size;
    catalog.push({ id, pack: pack.toLowerCase(), name: NAMES[outfit] ?? outfit, file: `models/characters/${id}.glb`, slots, shirt: cloth.body[0] ?? null, pants: cloth.legs[0] ?? null, backpack });
    console.log(`${id.padEnd(26)} ${(size / 1024).toFixed(0).padStart(5)} KB  shirt=${cloth.body[0]} pants=${cloth.legs[0]}${backpack ? ' +backpack' : ''}`);
  }
}
// Shared animation clips (skeleton only, no meshes).
{
  const doc = await io.read(path.join(SRC, 'Male', 'Casual_Hoodie.glb'));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!KEEP_CLIPS.includes(a.getName())) dropClip(a);
  for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null);
  await doc.transform(prune({ keepLeaves: true }), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const outPath = path.join(OUT, 'clips.glb');
  await io.write(outPath, doc);
  total += fs.statSync(outPath).size;
  console.log(`clips.glb ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB (${KEEP_CLIPS.join(', ')})`);
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB, ${catalog.length} outfits`);

const ts = `// GENERATED by scripts/build-characters.mjs — do not edit by hand.
// Quaternius «Ultimate Modular Men/Women», CC0 (https://quaternius.com). One outfit = 4 slots on one skeleton.
export interface OutfitDef {
  id: string;
  pack: 'male' | 'female';
  name: string;
  file: string;
  /** Mesh node per slot. */
  slots: { head: string; body: string; legs: string; feet: string };
  /** Main cloth material of the body / legs piece (recoloured by the player), or null. */
  shirt: string | null;
  pants: string | null;
  backpack: boolean;
}

export const OUTFITS: readonly OutfitDef[] = ${JSON.stringify(catalog, null, 2)};
`;
fs.writeFileSync('packages/content/src/characterCatalog.ts', ts);
