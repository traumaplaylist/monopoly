// Render quality tier. Phones/tablets (coarse pointer or small screen) get cheaper materials:
// no glass transmission, smaller shadow maps. `?gfx=high|low` overrides for checks.
import { ExtrudeGeometry, Shape } from 'three';
import type { BufferGeometry } from 'three';

export type Quality = 'high' | 'low';

/** CPU rendering (SwiftShader/llvmpipe): glass transmission would drop to a few frames per second. */
function softwareRenderer(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch {
    return false;
  }
}

function detect(): Quality {
  try {
    const q = new URLSearchParams(window.location.search).get('gfx');
    if (q === 'high' || q === 'low') return q;
    if (SOFTWARE) return 'low';
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const small = Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080) < 600;
    return coarse || small ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

const SOFTWARE = (() => {
  try {
    return softwareRenderer();
  } catch {
    return false;
  }
})();

export const QUALITY: Quality = detect();

/** Shadows: off on CPU rendering (unless `?shadows=1`), `?shadows=0` switches them off anywhere. */
export const SHADOWS: boolean = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('shadows');
    if (q === '0' || q === '1') return q === '1';
    return !SOFTWARE;
  } catch {
    return true;
  }
})();

const cache = new Map<string, BufferGeometry>();

/**
 * Rounded rectangle slab lying on the XZ plane (top face at y = height). UVs of every vertex are
 * a planar projection from above, so a canvas texture covers the top face exactly and the sides
 * pick up the card's edge colour.
 */
export function roundedSlab(w: number, d: number, height: number, radius: number, bevel = Math.min(0.025, height * 0.4)): BufferGeometry {
  const key = [w, d, height, radius, bevel].map((v) => v.toFixed(3)).join(':');
  const hit = cache.get(key);
  if (hit) return hit;
  const r = Math.min(radius, w / 2 - bevel - 0.001, d / 2 - bevel - 0.001);
  const iw = w / 2 - bevel;
  const id = d / 2 - bevel;
  const s = new Shape();
  s.moveTo(-iw + r, -id);
  s.lineTo(iw - r, -id);
  s.quadraticCurveTo(iw, -id, iw, -id + r);
  s.lineTo(iw, id - r);
  s.quadraticCurveTo(iw, id, iw - r, id);
  s.lineTo(-iw + r, id);
  s.quadraticCurveTo(-iw, id, -iw, id - r);
  s.lineTo(-iw, -id + r);
  s.quadraticCurveTo(-iw, -id, -iw + r, -id);
  const g = new ExtrudeGeometry(s, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  // Shape is in XY, extruded along +Z: rotate so the extrusion goes up (+Y) and shape Y → world −Z…
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  const pos = g.attributes.position!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, 1 - (pos.getZ(i) + d / 2) / d);
  }
  uv.needsUpdate = true;
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}
