// Player figure assembled from appearance parts (body shape, colour, material, hat, face).
// Every part is a model slot: assets.json → models["body-<shape>"] / models["hat-<hat>"] replaces
// the code-built fallback without changing the data format. The seat colour is a ring at the base.
import { useMemo } from 'react';
import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Appearance, BodyShape, Face, Hat } from '@pb/content';
import { Model } from './assets';
import type { ModelSlot } from './assets';
import { figureGeometry, jellyMaterial } from './jelly';

/** Where hats and faces sit on each body (local units, base at y = 0, front = +Z). */
const ANCHORS: Record<BodyShape, { hatY: number; hatScale: number; faceY: number; faceZ: number; faceSize: number }> = {
  meeple: { hatY: 0.76, hatScale: 1, faceY: 0.635, faceZ: 0.108, faceSize: 0.22 },
  pawn: { hatY: 0.74, hatScale: 1.05, faceY: 0.6, faceZ: 0.152, faceSize: 0.2 },
  bean: { hatY: 0.68, hatScale: 1.3, faceY: 0.5, faceZ: 0.205, faceSize: 0.26 },
  star: { hatY: 0.74, hatScale: 0.8, faceY: 0.38, faceZ: 0.098, faceSize: 0.2 },
};

const geoCache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

function bodyGeometry(shape: BodyShape): BufferGeometry {
  switch (shape) {
    case 'meeple':
      return figureGeometry();
    case 'pawn':
      return cached('pawn', () => {
        const pts = [
          [0, 0], [0.24, 0], [0.24, 0.05], [0.18, 0.09], [0.11, 0.2], [0.08, 0.36], [0.14, 0.4], [0.14, 0.43], [0.07, 0.46],
        ].map(([x, y]) => new Vector2(x, y));
        const body = new LatheGeometry(pts, 28);
        return body;
      });
    case 'bean':
      return cached('bean', () => {
        const g = new CapsuleGeometry(0.2, 0.3, 8, 24);
        g.translate(0, 0.35, 0);
        return g;
      });
    case 'star':
      return cached('star', () => {
        const s = new Shape();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 + Math.PI / 2;
          const r = i % 2 === 0 ? 0.34 : 0.15;
          const x = Math.cos(a) * r;
          const y = 0.38 + Math.sin(a) * r;
          if (i === 0) s.moveTo(x, y);
          else s.lineTo(x, y);
        }
        s.closePath();
        const g = new ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4 });
        g.translate(0, 0, -0.05);
        g.computeVertexNormals();
        return g;
      });
  }
}

/** Pawn head is a separate sphere (lathe makes the stem). */
function pawnHead(): BufferGeometry {
  return cached('pawn-head', () => {
    const g = new SphereGeometry(0.15, 24, 16);
    g.translate(0, 0.6, 0);
    return g;
  });
}

const matCache = new Map<string, Material>();
function bodyMaterial(a: Appearance): Material {
  if (a.material === 'jelly') return jellyMaterial(a.color);
  const key = `${a.material}:${a.color}`;
  let m = matCache.get(key);
  if (!m) {
    const c = new Color(a.color);
    m =
      a.material === 'matte'
        ? new MeshStandardMaterial({ color: c, roughness: 0.85 })
        : new MeshPhysicalMaterial({ color: c, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, emissive: c, emissiveIntensity: 0.12 });
    matCache.set(key, m);
  }
  return m;
}

const gold = new MeshPhysicalMaterial({ color: '#ffcc33', metalness: 0.8, roughness: 0.25, emissive: '#ffb300', emissiveIntensity: 0.25 });
const black = new MeshStandardMaterial({ color: '#25223a', roughness: 0.5 });
const white = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });

function plain(color: string): Material {
  const key = `plain:${color}`;
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = new MeshStandardMaterial({ color, roughness: 0.55 })));
  return m;
}

/** Code-built hats (fallbacks for the hat-<id> model slots). Origin = top of the head. */
function HatMesh({ hat, color }: { hat: Hat; color: string }) {
  switch (hat) {
    case 'none':
      return null;
    case 'cap':
      return (
        <group>
          <mesh geometry={cached('cap-dome', () => new SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2))} material={plain('#2f7ff0')} position={[0, -0.04, 0]} castShadow />
          <mesh geometry={cached('cap-brim', () => new CylinderGeometry(0.1, 0.1, 0.015, 20, 1, false, 0, Math.PI))} material={plain('#2f7ff0')} position={[0, -0.035, 0.1]} rotation={[0, -Math.PI / 2, 0]} />
        </group>
      );
    case 'crown':
      return (
        <group position={[0, -0.03, 0]}>
          <mesh geometry={cached('crown-band', () => new CylinderGeometry(0.12, 0.11, 0.08, 16, 1, true))} material={gold} position={[0, 0.04, 0]} castShadow />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} geometry={cached('crown-tip', () => new ConeGeometry(0.03, 0.07, 6))} material={gold} position={[Math.cos((k / 5) * Math.PI * 2) * 0.11, 0.115, Math.sin((k / 5) * Math.PI * 2) * 0.11]} />
          ))}
        </group>
      );
    case 'tophat':
      return (
        <group position={[0, -0.03, 0]}>
          <mesh geometry={cached('top-brim', () => new CylinderGeometry(0.17, 0.17, 0.02, 24))} material={black} castShadow />
          <mesh geometry={cached('top-body', () => new CylinderGeometry(0.1, 0.11, 0.2, 24))} material={black} position={[0, 0.11, 0]} castShadow />
          <mesh geometry={cached('top-band', () => new CylinderGeometry(0.112, 0.112, 0.035, 24))} material={plain('#f23d5c')} position={[0, 0.035, 0]} />
        </group>
      );
    case 'party':
      return (
        <group position={[0, -0.02, 0]}>
          <mesh geometry={cached('party-cone', () => new ConeGeometry(0.1, 0.26, 20))} material={plain('#ff4fa8')} position={[0, 0.13, 0]} castShadow />
          <mesh geometry={cached('party-pom', () => new SphereGeometry(0.035, 12, 8))} material={plain('#ffc21a')} position={[0, 0.27, 0]} />
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, -0.05, 0]}>
          <mesh geometry={cached('beanie-dome', () => new SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2))} material={plain(color === '#58c22c' ? '#ff8a1f' : '#58c22c')} castShadow />
          <mesh geometry={cached('beanie-rim', () => new TorusGeometry(0.13, 0.03, 10, 24))} material={white} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={cached('beanie-pom', () => new SphereGeometry(0.045, 12, 8))} material={white} position={[0, 0.15, 0]} />
        </group>
      );
    case 'halo':
      return <mesh geometry={cached('halo', () => new TorusGeometry(0.12, 0.018, 10, 32))} material={gold} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} />;
  }
}

const faceCache = new Map<Face, CanvasTexture>();
/** Sticker face drawn on canvas (eyes + mouth), transparent background. */
function faceTexture(face: Face): CanvasTexture {
  let t = faceCache.get(face);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1d1a2e';
  x.strokeStyle = '#1d1a2e';
  x.lineWidth = 9;
  x.lineCap = 'round';
  const eye = (cx: number, r = 11) => {
    x.beginPath();
    x.arc(cx, 52, r, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(cx + 3, 48, r * 0.35, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#1d1a2e';
  };
  const smile = () => {
    x.beginPath();
    x.arc(64, 70, 22, 0.15 * Math.PI, 0.85 * Math.PI);
    x.stroke();
  };
  switch (face) {
    case 'smile':
      eye(42);
      eye(86);
      smile();
      break;
    case 'cool':
      x.fillRect(22, 40, 36, 22);
      x.fillRect(70, 40, 36, 22);
      x.fillRect(56, 44, 16, 6);
      smile();
      break;
    case 'wink':
      eye(42);
      x.beginPath();
      x.moveTo(74, 52);
      x.lineTo(98, 52);
      x.stroke();
      smile();
      break;
    case 'wow':
      eye(42, 12);
      eye(86, 12);
      x.beginPath();
      x.arc(64, 88, 11, 0, Math.PI * 2);
      x.fill();
      break;
    case 'cat':
      eye(42);
      eye(86);
      x.beginPath();
      x.moveTo(46, 76);
      x.quadraticCurveTo(55, 86, 64, 76);
      x.quadraticCurveTo(73, 86, 82, 76);
      x.stroke();
      x.lineWidth = 4;
      for (const [a, b] of [[14, 66], [14, 76], [114, 66], [114, 76]] as const) {
        x.beginPath();
        x.moveTo(a < 64 ? 34 : 94, 72);
        x.lineTo(a, b);
        x.stroke();
      }
      break;
    case 'none':
      break;
  }
  t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  faceCache.set(face, t);
  return t;
}

function BodyMesh({ a, ghost }: { a: Appearance; ghost: boolean }) {
  const mat = ghost ? jellyMaterial('#ffffff', true) : bodyMaterial(a);
  return (
    <group>
      <mesh geometry={bodyGeometry(a.body)} material={mat} castShadow={!ghost} />
      {a.body === 'pawn' && <mesh geometry={pawnHead()} material={mat} castShadow={!ghost} />}
    </group>
  );
}

/** A whole player figure. `seatColor` — the ring that identifies the seat on the board. */
export function PlayerFigure({ appearance: a, seatColor, ghost = false, ring = true }: { appearance: Appearance; seatColor?: string; ghost?: boolean; ring?: boolean }) {
  const anchor = ANCHORS[a.body];
  const face = useMemo(() => (a.face === 'none' ? null : faceTexture(a.face)), [a.face]);
  return (
    <group>
      {ring && seatColor && !ghost && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.2, 0.29, 32]} />
          <meshStandardMaterial color={seatColor} emissive={seatColor} emissiveIntensity={0.35} side={DoubleSide} />
        </mesh>
      )}
      <group position={[0, ghost ? 0.06 : 0.02, 0]}>
        <Model slot={`body-${a.body}` as ModelSlot} tint={a.color} fallback={<BodyMesh a={a} ghost={ghost} />} />
        {face && !ghost && (
          <mesh position={[0, anchor.faceY, anchor.faceZ]} raycast={() => null}>
            <planeGeometry args={[anchor.faceSize, anchor.faceSize]} />
            <meshBasicMaterial map={face} transparent depthWrite={false} />
          </mesh>
        )}
        {a.hat !== 'none' && (
          <group position={[0, anchor.hatY, 0]} scale={anchor.hatScale}>
            <Model slot={`hat-${a.hat}` as ModelSlot} fallback={<HatMesh hat={a.hat} color={a.color} />} />
          </group>
        )}
      </group>
    </group>
  );
}
