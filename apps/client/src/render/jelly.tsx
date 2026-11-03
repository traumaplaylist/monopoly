// «Мармеладные» фигурки: translucent extruded silhouettes. On high quality they use real glass
// transmission; on phones a cheap glossy translucent material.
import { Color, ExtrudeGeometry, MeshPhysicalMaterial, OctahedronGeometry, Shape } from 'three';
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
      color: c,
      roughness: 0.12,
      metalness: 0,
      transmission: 0.45,
      thickness: 0.4,
      ior: 1.45,
      attenuationColor: c,
      attenuationDistance: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: c,
      emissiveIntensity: 0.12,
    });
  } else {
    m = new MeshPhysicalMaterial({
      color: c,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: c,
      emissiveIntensity: 0.18,
    });
  }
  materials.set(key, m);
  return m;
}

let figureGeo: BufferGeometry | null = null;

/** Meeple silhouette (head, arms, legs), extruded with a soft bevel. Base at y = 0, faces +Z. */
export function figureGeometry(): BufferGeometry {
  if (figureGeo) return figureGeo;
  const s = new Shape();
  s.moveTo(-0.3, 0);
  s.lineTo(-0.1, 0);
  s.quadraticCurveTo(0, 0.2, 0.1, 0);
  s.lineTo(0.3, 0);
  s.quadraticCurveTo(0.27, 0.2, 0.17, 0.33);
  s.lineTo(0.3, 0.37);
  s.quadraticCurveTo(0.37, 0.43, 0.3, 0.48);
  s.lineTo(0.13, 0.5);
  s.absarc(0, 0.6, 0.125, -0.95, Math.PI + 0.95, false);
  s.lineTo(-0.3, 0.48);
  s.quadraticCurveTo(-0.37, 0.43, -0.3, 0.37);
  s.lineTo(-0.17, 0.33);
  s.quadraticCurveTo(-0.27, 0.2, -0.3, 0);
  const depth = 0.12;
  const b = 0.045;
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: 0.035, bevelSegments: 5, curveSegments: 18 });
  g.translate(0, 0.035, -depth / 2);
  g.computeVertexNormals();
  figureGeo = g;
  return g;
}

let crystalGeo: BufferGeometry | null = null;

/** Faceted gem used as an upgrade marker (reference: coloured crystals on the cards). */
export function crystalGeometry(): BufferGeometry {
  if (!crystalGeo) {
    crystalGeo = new OctahedronGeometry(0.1, 0);
    crystalGeo.scale(1, 1.35, 1);
    crystalGeo.translate(0, 0.135, 0);
  }
  return crystalGeo;
}

