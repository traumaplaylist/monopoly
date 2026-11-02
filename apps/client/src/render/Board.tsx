import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Group, Texture } from 'three';
import { WORLD } from '@pb/content';
import { useStore } from '../state/store';
import { onTileClick } from '../ui/actions';
import { loadImage, useManifest } from './assets';
import { TILE_HEIGHT, centerLayout, tileRect } from './layout';
import type { Profile } from './layout';
import { roundedSlab } from './quality';
import { iconImage } from './icons';
import { PALETTE, cardEdgeColor, iconColor, createDeckTexture, createPaperTexture, createTileTexture } from './tileArt';
import { crystalGeometry } from './jelly';

/** Paper margin around the tile ring. */
const PLATE_MARGIN = 0.12;
/** Width of the wooden frame around the paper. */
const FRAME = 0.18;
/** Thickness of the cardboard board lying on the table. */
export const PLATE_THICKNESS = 0.14;
/** Height of a tile card above the board. */
export const CARD_HEIGHT = TILE_HEIGHT;
const CARD_GAP = 0.07;
/** Height of the wooden table surface. */
const TABLE_Y = -PLATE_THICKNESS - 0.06;

export function Board({ profile }: { profile: Profile }) {
  return (
    <group>
      <Table />
      <Plate profile={profile} />
      <Tiles profile={profile} />
      <Decks profile={profile} />
      <CenterDecor profile={profile} />
    </group>
  );
}

/** Dark plum backdrop (variant 1 of the reference): a soft radial glow under the board. */
function Table() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, '#4a3f86');
    g.addColorStop(0.55, '#332a66');
    g.addColorStop(1, '#221c47');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

/** Board rim the paper map lies in. */
function Frame({ w, d }: { w: number; d: number }) {
  // Cream cardboard rim with a darker beige edge.
  const material = useMemo(() => [new MeshStandardMaterial({ color: '#efe1c4', roughness: 0.7 }), new MeshStandardMaterial({ color: '#c9b088', roughness: 0.75 })], []);
  return (
    <mesh position={[0, TABLE_Y, 0]} geometry={roundedSlab(w + FRAME * 2, d + FRAME * 2, PLATE_THICKNESS + 0.04, 0.5, 0.05)} material={material} castShadow receiveShadow raycast={() => null} />
  );
}

function Plate({ profile }: { profile: Profile }) {
  const w = profile.width + PLATE_MARGIN * 2;
  const d = profile.height + PLATE_MARGIN * 2;
  const paper = useMemo(() => createPaperTexture(w, d, WORLD.name.toUpperCase()), [w, d]);
  useEffect(() => () => paper.dispose(), [paper]);
  return (
    <group>
      <Frame w={w} d={d} />
      <mesh position={[0, -PLATE_THICKNESS + 0.005, 0]} geometry={roundedSlab(w, d, PLATE_THICKNESS, 0.25, 0.015)} receiveShadow raycast={() => null}>
        <meshStandardMaterial map={paper} roughness={0.92} />
      </mesh>
    </group>
  );
}

function useTileTextures(profile: Profile): Texture[] | null {
  const manifest = useManifest();
  const [textures, setTextures] = useState<Texture[] | null>(null);
  useEffect(() => {
    let alive = true;
    const icon = (t: (typeof WORLD.tiles)[number]) =>
      manifest.icons[t.index] ? loadImage(manifest.icons[t.index]!) : iconImage(t.visual, iconColor(t));
    void Promise.all(WORLD.tiles.map(icon)).then((imgs) => {
      if (!alive) return;
      setTextures(
        WORLD.tiles.map((t, i) => {
          const r = tileRect(t.index, profile);
          return createTileTexture(t.index, r.w - CARD_GAP, r.d - CARD_GAP, r.corner, imgs[i] ?? null);
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [manifest, profile]);
  useEffect(() => () => textures?.forEach((t) => t.dispose()), [textures]);
  return textures;
}

function Tiles({ profile }: { profile: Profile }) {
  const textures = useTileTextures(profile);
  if (!textures) return null;
  return (
    <group>
      {WORLD.tiles.map((t) => (
        <TileCard key={t.index} index={t.index} texture={textures[t.index]!} profile={profile} />
      ))}
    </group>
  );
}

function TileCard({ index, texture, profile }: { index: number; texture: Texture; profile: Profile }) {
  const r = tileRect(index, profile);
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const selected = useStore((s) => s.selectedTile === index);
  const placing = useStore((s) => s.placing);
  const o = useStore((s) => s.match?.tiles[index] ?? null);
  const ownerColor = useStore((s) => (o?.owner ? s.match?.players.find((p) => p.seat === o.owner)?.color : undefined));
  const highlight = useStore((s) => s.match?.purchaseTile === index || s.match?.auction?.tile === index);

  // ExtrudeGeometry groups: 0 = top/bottom caps (printed face), 1 = sides and bevel (card thickness).
  const material = useMemo(
    () => [
      new MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0 }),
      new MeshStandardMaterial({ color: cardEdgeColor(WORLD.tiles[index]!), roughness: 0.5 }),
    ],
    [texture, index],
  );
  useEffect(() => () => material.forEach((m) => m.dispose()), [material]);

  useFrame(({ invalidate }, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = selected ? 0.18 : hover ? 0.07 : highlight ? 0.12 : 0;
    const diff = target - g.position.y;
    if (Math.abs(diff) < 0.001) {
      g.position.y = target;
      return;
    }
    g.position.y += diff * Math.min(1, dt * 12);
    invalidate(); // frameloop="demand": keep drawing until settled
  });

  const w = r.w - CARD_GAP;
  const d = r.d - CARD_GAP;
  const radius = Math.min(w, d) * 0.12;
  return (
    <group position={[r.x, 0, r.z]}>
      {/* Soft painted drop shadow (works without real-time shadows, like the reference art). */}
      <mesh position={[0.05, 0.003, 0.09]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={-1}>
        <planeGeometry args={[w + 0.3, d + 0.3]} />
        <meshBasicMaterial map={cardShadowTexture()} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {ownerColor && (
        <mesh geometry={roundedSlab(w + 0.06, d + 0.06, CARD_HEIGHT * 0.55, radius + 0.03, 0.01)} receiveShadow raycast={() => null}>
          <meshStandardMaterial color={ownerColor} roughness={0.35} emissive={ownerColor} emissiveIntensity={0.25} />
        </mesh>
      )}
      <group ref={ref}>
        <mesh
          geometry={roundedSlab(w, d, CARD_HEIGHT, radius, 0.022)}
          material={material}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onTileClick(index);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = '';
          }}
          userData={{ tile: index }}
        />
        {o?.mortgaged && (
          <mesh position={[0, CARD_HEIGHT + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[w * 0.96, d * 0.96]} />
            <meshBasicMaterial color="#5a4a3a" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        )}
        {(selected || (placing && hover)) && (
          <mesh position={[0, CARD_HEIGHT + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[w * 0.96, d * 0.96]} />
            <meshBasicMaterial color={placing ? '#ff8a3d' : '#fff2a8'} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

let shadowTex: CanvasTexture | null = null;
/** Blurred rounded-rectangle shadow, shared by all cards (stretched to the card size). */
function cardShadowTexture(): CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = 'rgba(40,25,60,0.85)';
  ctx.beginPath();
  ctx.roundRect(22, 22, 84, 84, 14);
  ctx.fill();
  shadowTex = new CanvasTexture(c);
  return shadowTex;
}

/** Rounded card stack: cream edges, printed top. */
function CardStack({ w, d, count, texture, jitter = 0.02 }: { w: number; d: number; count: number; texture: Texture; jitter?: number }) {
  const th = 0.035;
  const geo = roundedSlab(w, d, th, Math.min(w, d) * 0.1, 0.008);
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          geometry={geo}
          position={[Math.sin(i * 2.3) * jitter, i * th, Math.cos(i * 1.7) * jitter]}
          rotation={[0, Math.sin(i * 3.1) * 0.03, 0]}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          {i === count - 1 ? <meshStandardMaterial map={texture} roughness={0.5} /> : <meshStandardMaterial color={PALETTE.paperEdge} roughness={0.8} />}
        </mesh>
      ))}
    </group>
  );
}

function Decks({ profile }: { profile: Profile }) {
  const layout = centerLayout(profile);
  const [icon, setIcon] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void iconImage('gamepad').then(setIcon);
  }, []);
  const tex = useMemo(
    () => layout.decks.map((d, k) => createDeckTexture(k === 0 ? 'chance' : 'minigame', d.w, d.d, icon)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.id, icon],
  );
  return (
    <group>
      {layout.decks.map((d, k) => (
        <group key={k} position={[d.x, 0, d.z]} rotation={[0, k === 0 ? 0.04 : -0.05, 0]}>
          <CardStack w={d.w} d={d.d} count={5} texture={tex[k]!} />
        </group>
      ))}
    </group>
  );
}

/** Low-poly trees and loose crystals scattered on the city map (variant 1 of the reference). */
function CenterDecor({ profile }: { profile: Profile }) {
  const items = useMemo(() => {
    const inner = { w: profile.width - profile.cw * 2, h: profile.height - profile.cd * 2 };
    const c = centerLayout(profile);
    const keepOut = [
      ...c.decks.map((d) => ({ x: d.x, z: d.z, w: d.w / 2 + 0.35, d: d.d / 2 + 0.35 })),
      { x: c.dice.x, z: c.dice.z, w: 1.5, d: 0.8 },
      { x: 0, z: c.banner, w: 2.6, d: 0.7 },
    ];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const res: { x: number; z: number; kind: 'tree' | 'gem'; s: number; color: string }[] = [];
    const gems = ['#f23d5c', '#2f7ff0', '#ffc21a', '#58c22c', '#8b55e6'];
    const want = profile.id === 'portrait' ? 12 : 16;
    for (let k = 0; res.length < want && k < 600; k++) {
      const x = (rnd() - 0.5) * (inner.w - 0.7);
      const z = (rnd() - 0.5) * (inner.h - 0.7);
      if (keepOut.some((o) => Math.abs(x - o.x) < o.w && Math.abs(z - o.z) < o.d)) continue;
      if (res.some((r) => Math.hypot(r.x - x, r.z - z) < 0.9)) continue;
      const gem = rnd() < 0.35;
      res.push({ x, z, kind: gem ? 'gem' : 'tree', s: 1.15 + rnd() * 0.5, color: gem ? gems[Math.floor(rnd() * gems.length)]! : rnd() > 0.5 ? '#5cbf4a' : '#3fa45a' });
    }
    return res;
  }, [profile]);
  return (
    <group>
      {items.map((it, k) =>
        it.kind === 'tree' ? (
          <group key={k} position={[it.x, 0, it.z]} scale={it.s} rotation={[0, k, 0]}>
            <mesh position={[0, 0.06, 0]} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.04, 0.05, 0.12, 6]} />
              <meshStandardMaterial color="#8a5a32" flatShading />
            </mesh>
            <mesh position={[0, 0.3, 0]} castShadow raycast={() => null}>
              <icosahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial color={it.color} flatShading roughness={0.6} />
            </mesh>
          </group>
        ) : (
          <mesh key={k} position={[it.x, 0, it.z]} scale={it.s * 1.4} rotation={[0, k, 0.2]} geometry={crystalGeometry()} castShadow raycast={() => null}>
            <meshPhysicalMaterial color={it.color} roughness={0.1} clearcoat={1} flatShading emissive={it.color} emissiveIntensity={0.3} />
          </mesh>
        ),
      )}
    </group>
  );
}
