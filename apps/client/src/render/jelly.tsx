// «Мармеладные» фигурки: translucent extruded silhouettes. On high quality they use real glass
// transmission; on phones a cheap glossy translucent material.
import { useMemo } from 'react';
import { Color, ExtrudeGeometry, MeshPhysicalMaterial, Shape } from 'three';
import type { BufferGeometry } from 'three';
import { QUALITY } from './quality';

const materials = new Map<string, MeshPhysicalMaterial>();

export function jellyMaterial(color: string, ghost = false): MeshPhysicalMaterial {
  const key = `${color}:${ghost}:${QUALITY}`;
  let m = materials.get(key);
  if (m) return m;
  const c = new Color(color);
  if (ghost) {
    m = new MeshPhysicalMaterial({ color: '#f4f0ff', roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.45, emissive: '#c9b8ff', emissiveIntensity: 0.25, depthWrite: false });
  } else if (QUALITY === 'high') {
    m = new MeshPhysicalMaterial({
      color: c.clone().lerp(new Color('#ffffff'), 0.15),
      roughness: 0.12,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.35,
      ior: 1.4,
      attenuationColor: c,
      attenuationDistance: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: c,
      emissiveIntensity: 0.12,
    });
  } else {
    m = new MeshPhysicalMaterial({
      color: c,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.93,
      emissive: c,
      emissiveIntensity: 0.3,
    });
  }
  materials.set(key, m);
  return m;
}

let figureGeo: BufferGeometry | null = null;

/** Person silhouette (bell body + round head), extruded with a soft bevel. Base at y = 0. */
export function figureGeometry(): BufferGeometry {
  if (figureGeo) return figureGeo;
  const s = new Shape();
  const headY = 0.56;
  const headR = 0.135;
  const a0 = -1.1;
  const nx = Math.cos(a0) * headR;
  const ny = headY + Math.sin(a0) * headR;
  s.moveTo(-0.19, 0);
  s.lineTo(0.19, 0);
  s.bezierCurveTo(0.22, 0.2, 0.2, 0.36, nx + 0.035, ny - 0.01);
  s.absarc(0, headY, headR, a0, Math.PI - a0, false);
  s.bezierCurveTo(-0.2, 0.36, -0.22, 0.2, -0.19, 0);
  const g = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 5, curveSegments: 20 });
  g.translate(0, 0.035, -0.04);
  g.computeVertexNormals();
  figureGeo = g;
  return g;
}

let houseGeo: BufferGeometry | null = null;
let hotelGeo: BufferGeometry | null = null;

function extrudeHouse(w: number, h: number, roof: number, depth: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(0, h + roof);
  s.lineTo(-w / 2, h);
  s.closePath();
  const b = 0.018;
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
  g.translate(0, b, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export function houseGeometry(): BufferGeometry {
  return (houseGeo ??= extrudeHouse(0.16, 0.12, 0.08, 0.14));
}

export function hotelGeometry(): BufferGeometry {
  return (hotelGeo ??= extrudeHouse(0.3, 0.26, 0.1, 0.16));
}

/** One player figure on its little round stand. */
export function JellyFigure({ color, ghost = false }: { color: string; ghost?: boolean }) {
  const mat = jellyMaterial(color, ghost);
  const geo = useMemo(figureGeometry, []);
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow={!ghost} position={[0, ghost ? 0.08 : 0.04, 0]} />
      {!ghost && (
        <mesh position={[0, 0.02, 0]} material={mat} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.04, 28]} />
        </mesh>
      )}
    </group>
  );
}
