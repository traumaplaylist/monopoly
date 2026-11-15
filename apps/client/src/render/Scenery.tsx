// Diorama look: themed KayKit scenery in the board centre (city blocks / space base / village and
// forest), placed deterministically around the banner, dice and decks. Purely decorative.
import { Suspense, useMemo } from 'react';
import type { MapDef } from '@pb/content';
import { centerLayout, innerArea } from './layout';
import type { Profile } from './layout';
import { MergedProps, packOfMap } from './props';
import type { PropPack } from './props';

interface Kind {
  name: string;
  /** Footprint (largest side), world units. */
  fit: number;
  /** Height limit, world units (default: fit × 0.9). */
  h?: number;
  /** How many to try to place. */
  count: number;
  /** «block»: inside one of the four corner quarters (buildings, mountains); «any»: anywhere free. */
  zone?: 'block' | 'any';
  /** Rotate freely (nature) or by quarter turns (buildings, vehicles). */
  free?: boolean;
}

const SETS: Record<PropPack, Kind[]> = {
  city: [
    { name: 'building_H_withoutBase', fit: 0.62, h: 0.85, count: 2, zone: 'block' },
    { name: 'building_G_withoutBase', fit: 0.62, h: 0.7, count: 2, zone: 'block' },
    { name: 'building_E_withoutBase', fit: 0.62, h: 0.7, count: 2, zone: 'block' },
    { name: 'building_D_withoutBase', fit: 0.55, h: 0.7, count: 2, zone: 'block' },
    { name: 'building_B_withoutBase', fit: 0.55, h: 0.55, count: 2, zone: 'block' },
    { name: 'building_C_withoutBase', fit: 0.45, h: 0.7, count: 2, zone: 'block' },
    { name: 'building_A_withoutBase', fit: 0.45, h: 0.55, count: 2, zone: 'block' },
    { name: 'watertower', fit: 0.4, count: 1, zone: 'block' },
    { name: 'bush', fit: 0.22, count: 14, zone: 'block', free: true },
    { name: 'streetlight', fit: 0.24, h: 0.5, count: 4, zone: 'block' },
    { name: 'car_taxi', fit: 0.36, count: 2 },
    { name: 'car_sedan', fit: 0.36, count: 2 },
    { name: 'car_police', fit: 0.36, count: 1 },
    { name: 'bench', fit: 0.26, count: 2 },
  ],
  space: [
    { name: 'basemodule_E', fit: 0.85, h: 0.7, count: 1, zone: 'block' },
    { name: 'structure_tall', fit: 0.7, h: 0.8, count: 1, zone: 'block' },
    { name: 'windturbine_tall', fit: 0.55, h: 0.9, count: 1, zone: 'block' },
    { name: 'basemodule_A', fit: 0.75, h: 0.4, count: 2, zone: 'block' },
    { name: 'basemodule_garage', fit: 0.7, h: 0.4, count: 1, zone: 'block' },
    { name: 'cargodepot_A', fit: 0.7, h: 0.45, count: 1, zone: 'block' },
    { name: 'landingpad_small', fit: 0.75, count: 2, zone: 'block' },
    { name: 'lander_A', fit: 0.55, count: 1, zone: 'block' },
    { name: 'solarpanel', fit: 0.4, count: 4, zone: 'block' },
    { name: 'rocks_B', fit: 0.7, h: 0.4, count: 3, free: true },
    { name: 'rocks_A', fit: 0.55, count: 3, free: true },
    { name: 'spacetruck', fit: 0.34, count: 2 },
    { name: 'rock_B', fit: 0.28, count: 6, free: true },
  ],
  village: [
    { name: 'mountain_B_grass_trees', fit: 1.0, h: 1.0, count: 2, zone: 'block', free: true },
    { name: 'mountain_A_grass_trees', fit: 0.95, h: 0.95, count: 1, zone: 'block', free: true },
    { name: 'building_church_red', fit: 0.55, h: 0.75, count: 1, zone: 'block' },
    { name: 'building_windmill_yellow', fit: 0.55, h: 0.7, count: 1, zone: 'block' },
    { name: 'building_market_blue', fit: 0.6, count: 1, zone: 'block' },
    { name: 'building_tavern_green', fit: 0.55, count: 1, zone: 'block' },
    { name: 'building_home_B_red', fit: 0.42, count: 2, zone: 'block' },
    { name: 'building_home_A_blue', fit: 0.38, count: 2, zone: 'block' },
    { name: 'building_home_A_yellow', fit: 0.38, count: 2, zone: 'block' },
    { name: 'trees_A_large', fit: 0.8, count: 3, free: true },
    { name: 'trees_B_large', fit: 0.8, count: 3, free: true },
    { name: 'trees_A_medium', fit: 0.65, count: 3, free: true },
    { name: 'tree_single_A', fit: 0.32, count: 8, free: true },
    { name: 'tree_single_B', fit: 0.32, count: 8, free: true },
  ],
};

interface Placed {
  name: string;
  fit: number;
  h: number;
  x: number;
  z: number;
  rot: number;
}

function layoutScenery(pack: PropPack, profile: Profile): Placed[] {
  const inner = innerArea(profile);
  const c = centerLayout(profile);
  const keepOut = [
    ...c.decks.map((d) => ({ x: d.x, z: d.z, w: d.w / 2 + 0.2, d: d.d / 2 + 0.2 })),
    { x: c.dice.x, z: c.dice.z, w: 1.6, d: 0.85 },
    { x: 0, z: c.banner, w: 3.2, d: 0.7 },
  ];
  // Figures stand on the inner edge of the tile ring: keep a margin free for them.
  const margin = 0.7;
  const hw = inner.w / 2 - margin;
  const hh = inner.h / 2 - margin;
  // Four «quarters» hugging the inner corners, where the blocks of buildings go.
  const qw = Math.min(1.6, hw * 0.45);
  const qh = Math.min(1.5, hh * 0.5);
  const quarters = [
    { x: -hw + qw, z: -hh + qh },
    { x: hw - qw, z: -hh + qh },
    { x: -hw + qw, z: hh - qh },
    { x: hw - qw, z: hh - qh },
  ];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const placed: (Placed & { r: number })[] = [];
  for (const k of SETS[pack]) {
    const r = (k.fit / 2) * 0.92;
    let made = 0;
    for (let t = 0; made < k.count && t < 500; t++) {
      let x: number;
      let z: number;
      if (k.zone === 'block') {
        // Spread the kinds over the quarters round-robin, so each block gets a mix.
        const q = quarters[(made + placed.length) % quarters.length]!;
        x = q.x + (rnd() - 0.5) * qw * 2;
        z = q.z + (rnd() - 0.5) * qh * 2;
      } else {
        x = (rnd() - 0.5) * hw * 2;
        z = (rnd() - 0.5) * hh * 2;
      }
      if (Math.abs(x) > hw - r * 0.5 || Math.abs(z) > hh - r * 0.5) continue;
      if (keepOut.some((o) => Math.abs(x - o.x) < o.w + r && Math.abs(z - o.z) < o.d + r)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.05)) continue;
      const rot = k.free ? rnd() * Math.PI * 2 : Math.floor(rnd() * 4) * (Math.PI / 2);
      placed.push({ name: k.name, fit: k.fit, h: k.h ?? k.fit * 0.9, x, z, rot, r });
      made++;
    }
  }
  return placed;
}

/**
 * «Вокруг света»: the centre becomes a small city on a grid of KayKit tiles — two avenues and a cross
 * street, blocks of buildings with sidewalks, cars on the roads. Cells under the banner, dice and
 * decks are plain sidewalk; buildings near the top edge are kept low so they do not cover the tiles.
 */
interface Cell {
  name: string;
  x: number;
  z: number;
  rot: number;
  fit: number;
  h: number;
}

function layoutCity(profile: Profile): Cell[] {
  const inner = innerArea(profile);
  const c = centerLayout(profile);
  const margin = 0.6;
  const cols = profile.id === 'portrait' ? 7 : 12;
  const W = inner.w - margin * 2;
  const H = inner.h - margin * 2;
  const rows = Math.max(3, Math.round(H / (W / cols)));
  const C = Math.min(W / cols, H / rows);
  const x0 = -(cols * C) / 2 + C / 2;
  const z0 = -(rows * C) / 2 + C / 2;
  const roadCols = profile.id === 'portrait' ? [3] : [3, 8];
  const roadRows = [Math.floor(rows / 2)];
  const keepOut = [
    ...c.decks.map((d) => ({ x: d.x, z: d.z, w: d.w / 2, d: d.d / 2 })),
    { x: c.dice.x, z: c.dice.z, w: 1.3, d: 0.7 },
    { x: 0, z: c.banner, w: 2.9, d: 0.55 },
  ];
  const blocked = (x: number, z: number) => keepOut.some((o) => Math.abs(x - o.x) < o.w + C * 0.35 && Math.abs(z - o.z) < o.d + C * 0.35);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tall = ['building_C', 'building_D', 'building_G', 'building_H', 'building_E', 'building_F'];
  const low = ['building_A', 'building_B'];
  const cars = ['car_taxi', 'car_sedan', 'car_hatchback', 'car_police', 'car_taxi'];
  const out: Cell[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * C;
      const z = z0 + j * C;
      const rc = roadCols.includes(i);
      const rr = roadRows.includes(j);
      if (rc || rr) {
        const name = rc && rr ? 'road_junction' : (rc && (roadRows.includes(j - 1) || roadRows.includes(j + 1))) || (rr && (roadCols.includes(i - 1) || roadCols.includes(i + 1))) ? 'road_straight_crossing' : 'road_straight';
        out.push({ name, x, z, rot: rc && !rr ? 0 : Math.PI / 2, fit: C, h: 0.05 });
        // Some traffic, not under the decks.
        if (!(rc && rr) && !blocked(x, z) && rnd() < 0.45) {
          const lane = (rnd() < 0.5 ? -1 : 1) * C * 0.17;
          const along = rc && !rr;
          out.push({ name: cars[Math.floor(rnd() * cars.length)]!, x: x + (along ? lane : 0), z: z + (along ? 0 : lane), rot: (along ? 0 : Math.PI / 2) + (lane > 0 ? Math.PI : 0), fit: C * 0.5, h: C * 0.3 });
        }
        continue;
      }
      if (blocked(x, z)) {
        // Park under the banner, dice and decks: lawn (drawn by CityGrid) with a few bushes at its edge.
        out.push({ name: 'lawn', x, z, rot: 0, fit: C, h: 0.05 });
        if (!keepOut.some((o) => Math.abs(x - o.x) < o.w && Math.abs(z - o.z) < o.d) && rnd() < 0.5)
          out.push({ name: 'bush', x: x + (rnd() - 0.5) * C * 0.5, z: z + (rnd() - 0.5) * C * 0.5, rot: rnd() * 6, fit: C * 0.32, h: C * 0.55 });
        continue;
      }
      // Buildings face the nearest road; low ones on the top row (they stand in front of the tiles).
      const top = j === 0;
      const pool = top ? low : rnd() < 0.7 ? tall : low;
      const near = roadCols.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a), roadCols[0]!);
      const rot = Math.abs(near - i) <= Math.abs(roadRows[0]! - j) ? (near > i ? -Math.PI / 2 : Math.PI / 2) : roadRows[0]! > j ? 0 : Math.PI;
      if (rnd() < 0.18) {
        out.push({ name: 'base', x, z, rot: 0, fit: C, h: 0.05 });
        out.push({ name: rnd() < 0.5 ? 'watertower' : 'bush', x, z, rot, fit: C * 0.4, h: C * 0.5 });
        continue;
      }
      out.push({ name: pool[Math.floor(rnd() * pool.length)]!, x, z, rot, fit: C, h: top ? C * 0.75 : C * 1.45 });
    }
  }
  return out;
}

function CityGrid({ profile }: { profile: Profile }) {
  const cells = useMemo(() => layoutCity(profile), [profile]);
  const props = useMemo(() => cells.filter((c) => c.name !== 'lawn').map((c) => ({ name: c.name, fit: c.fit, maxHeight: c.h, x: c.x, z: c.z, rot: c.rot })), [cells]);
  const lawns = useMemo(() => cells.filter((c) => c.name === 'lawn'), [cells]);
  return (
    <Suspense fallback={null}>
      <group position={[0, 0.002, 0]}>
        <MergedProps pack="city" items={props} />
        {lawns.map((it, k) => (
          <mesh key={k} position={[it.x, 0.025, it.z]} receiveShadow raycast={() => undefined}>
            <boxGeometry args={[it.fit + 0.002, 0.05, it.fit + 0.002]} />
            <meshStandardMaterial color="#8fcf6a" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </Suspense>
  );
}

export function Scenery({ profile, map }: { profile: Profile; map: MapDef }) {
  const pack = packOfMap(map.id);
  const sc = profile.id === 'portrait' ? 0.85 : 1;
  const items = useMemo(
    () => (pack === 'city' ? [] : layoutScenery(pack, profile).map((it) => ({ name: it.name, fit: it.fit * sc, maxHeight: it.h * sc, x: it.x, z: it.z, rot: it.rot }))),
    [pack, profile, sc],
  );
  if (pack === 'city') return <CityGrid profile={profile} />;
  return (
    <Suspense fallback={null}>
      <MergedProps pack={pack} items={items} />
    </Suspense>
  );
}
