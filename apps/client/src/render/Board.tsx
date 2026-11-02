import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MeshStandardMaterial } from 'three';
import type { Group, Texture } from 'three';
import { MEGAPOLIS } from '@pb/content';
import { useStore } from '../state/store';
import { onTileClick } from '../ui/actions';
import { loadImage, useManifest } from './assets';
import { TILE_HEIGHT, centerLayout, tileRect } from './layout';
import type { Profile } from './layout';
import { roundedSlab } from './quality';
import { BILLS, PALETTE, createBillTexture, createDeckTexture, createDeedTexture, createPaperTexture, createTileTexture, createWoodTexture } from './tileArt';

/** Paper margin around the tile ring. */
const PLATE_MARGIN = 0.35;
/** Thickness of the cardboard board lying on the table. */
export const PLATE_THICKNESS = 0.14;
/** Height of a tile card above the board. */
export const CARD_HEIGHT = TILE_HEIGHT;
const CARD_GAP = 0.1;

export function Board({ profile }: { profile: Profile }) {
  return (
    <group>
      <Table />
      <Plate profile={profile} />
      <Tiles profile={profile} />
      <Decks profile={profile} />
      <TableDecor profile={profile} />
    </group>
  );
}

function Table() {
  const wood = useMemo(() => {
    const t = createWoodTexture();
    t.repeat.set(6, 6);
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PLATE_THICKNESS, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[90, 90]} />
      <meshStandardMaterial map={wood} roughness={0.62} metalness={0} />
    </mesh>
  );
}

function Plate({ profile }: { profile: Profile }) {
  const w = profile.width + PLATE_MARGIN * 2;
  const d = profile.height + PLATE_MARGIN * 2;
  const paper = useMemo(() => createPaperTexture(w, d, MEGAPOLIS.name.toUpperCase()), [w, d]);
  useEffect(() => () => paper.dispose(), [paper]);
  return (
    <mesh position={[0, -PLATE_THICKNESS, 0]} geometry={roundedSlab(w, d, PLATE_THICKNESS, 0.3, 0.03)} receiveShadow castShadow raycast={() => null}>
      <meshStandardMaterial map={paper} roughness={0.92} />
    </mesh>
  );
}

function useTileTextures(profile: Profile): Texture[] | null {
  const manifest = useManifest();
  const [textures, setTextures] = useState<Texture[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(MEGAPOLIS.tiles.map((t) => (manifest.icons[t.index] ? loadImage(manifest.icons[t.index]!) : Promise.resolve(null)))).then((imgs) => {
      if (!alive) return;
      setTextures(
        MEGAPOLIS.tiles.map((t, i) => {
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
      {MEGAPOLIS.tiles.map((t) => (
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

  const material = useMemo(() => new MeshStandardMaterial({ map: texture, roughness: 0.48, metalness: 0 }), [texture]);
  useEffect(() => () => material.dispose(), [material]);

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
      {ownerColor && (
        <mesh geometry={roundedSlab(w + 0.12, d + 0.12, CARD_HEIGHT * 0.6, radius + 0.06, 0.012)} receiveShadow raycast={() => null}>
          <meshStandardMaterial color={ownerColor} roughness={0.35} />
        </mesh>
      )}
      <group ref={ref}>
        <mesh
          geometry={roundedSlab(w, d, CARD_HEIGHT, radius, 0.018)}
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
  const tex = useMemo(
    () => layout.decks.map((d, k) => createDeckTexture(k === 0 ? 'chance' : 'minigame', d.w, d.d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.id],
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

/** Money stacks and a few deeds lying on the table around the board (pure decor). */
function TableDecor({ profile }: { profile: Profile }) {
  const bills = useMemo(() => BILLS.map((b) => createBillTexture(b.value, b.color)), []);
  const deeds = useMemo(() => [5, 13, 21].map((i) => createDeedTexture(i)), []);
  const hw = profile.width / 2 + PLATE_MARGIN;
  const hh = profile.height / 2 + PLATE_MARGIN;
  const y = -PLATE_THICKNESS;
  const portrait = profile.id === 'portrait';
  // Spots on the wood, outside the board.
  const money: [number, number, number][] = portrait
    ? [
        [-hw + 1.2, -hh - 1.3, 0.2],
        [hw - 1.4, hh + 1.3, -0.15],
      ]
    : [
        [-hw - 1.5, -hh + 1.4, 0.25],
        [-hw - 1.6, hh - 1.6, -0.2],
      ];
  const deedSpots: [number, number, number][] = portrait
    ? [
        [hw - 1.0, -hh - 1.3, -0.3],
        [-hw + 1.3, hh + 1.4, 0.25],
      ]
    : [
        [-hw - 1.1, 0.2, -0.3],
        [-hw - 2.1, 0.7, 0.2],
      ];
  return (
    <group position={[0, y, 0]}>
      {money.map(([x, z, a], k) => (
        <group key={`m${k}`} position={[x, 0, z]} rotation={[0, a, 0]}>
          {BILLS.map((b, i) => (
            <group key={b.value} position={[(i - 1.5) * 0.28, 0, (i % 2) * 0.18 - 0.1]} rotation={[0, (i - 1.5) * 0.12, 0]}>
              <CardStack w={1.4} d={0.7} count={3 + ((i + k) % 3)} texture={bills[i]!} jitter={0.04} />
            </group>
          ))}
        </group>
      ))}
      {deedSpots.map(([x, z, a], k) => (
        <group key={`d${k}`} position={[x, 0, z]} rotation={[0, a, 0]}>
          <CardStack w={0.95} d={1.3} count={2} texture={deeds[k % deeds.length]!} jitter={0.03} />
        </group>
      ))}
    </group>
  );
}
