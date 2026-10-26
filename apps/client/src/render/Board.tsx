import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MeshStandardMaterial } from 'three';
import type { Group, Texture } from 'three';
import { MEGAPOLIS } from '@pb/content';
import { get, useStore } from '../state/store';
import { onTileClick } from '../ui/actions';
import { Model, loadImage, useManifest } from './assets';
import { GAP, TILE_HEIGHT, centerLayout, innerArea, tileRect } from './layout';
import type { Profile } from './layout';
import { createCenterTexture, createDeckTexture, createTileTexture, sideColor } from './tileArt';

const PLATE_MARGIN = 0.45;
const PLATE_THICKNESS = 0.35;

export function Board({ profile }: { profile: Profile }) {
  const inner = innerArea(profile);
  const center = useMemo(() => createCenterTexture(inner.w, inner.h), [inner.w, inner.h]);
  return (
    <group>
      <mesh position={[0, -PLATE_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[profile.width + PLATE_MARGIN * 2, PLATE_THICKNESS, profile.height + PLATE_MARGIN * 2]} />
        <meshStandardMaterial color="#4a3a5e" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[inner.w, inner.h]} />
        <meshStandardMaterial map={center} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PLATE_THICKNESS, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3b3346" roughness={1} />
      </mesh>
      <Tiles profile={profile} />
      <Decks profile={profile} />
      <Trees profile={profile} />
    </group>
  );
}

function useTileTextures(profile: Profile): Texture[] | null {
  const manifest = useManifest();
  const [textures, setTextures] = useState<Texture[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(MEGAPOLIS.tiles.map((t) => (manifest.icons[t.index] ? loadImage(manifest.icons[t.index]!) : Promise.resolve(null)))).then((imgs) => {
      if (alive) setTextures(MEGAPOLIS.tiles.map((t, i) => createTileTexture(t.index, profile, imgs[i] ?? null)));
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
        <TileBlock key={t.index} index={t.index} texture={textures[t.index]!} profile={profile} />
      ))}
    </group>
  );
}

function TileBlock({ index, texture, profile }: { index: number; texture: Texture; profile: Profile }) {
  const r = tileRect(index, profile);
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const selected = useStore((s) => s.selectedTile === index);
  const placing = useStore((s) => s.placing);
  const o = useStore((s) => s.match?.tiles[index] ?? null);
  const ownerColor = useStore((s) => (o?.owner ? s.match?.players.find((p) => p.seat === o.owner)?.color : undefined));
  const highlight = useStore((s) => s.match?.purchaseTile === index || s.match?.auction?.tile === index);

  const materials = useMemo(() => {
    const side = new MeshStandardMaterial({ color: sideColor(MEGAPOLIS.tiles[index]!), roughness: 0.85 });
    const top = new MeshStandardMaterial({ map: texture, roughness: 0.8 });
    return [side, side, top, side, side, side];
  }, [index, texture]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = selected ? 0.16 : hover ? 0.06 : highlight ? 0.1 : 0;
    g.position.y += (target - g.position.y) * Math.min(1, dt * 12);
  });

  const w = r.w - GAP;
  const d = r.d - GAP;
  return (
    <group position={[r.x, 0, r.z]}>
      {ownerColor && (
        <mesh position={[0, 0.045, 0]}>
          <boxGeometry args={[w + 0.12, 0.09, d + 0.12]} />
          <meshStandardMaterial color={ownerColor} roughness={0.5} />
        </mesh>
      )}
      <group ref={ref}>
        <mesh
          position={[0, TILE_HEIGHT / 2, 0]}
          material={materials}
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
        >
          <boxGeometry args={[w, TILE_HEIGHT, d]} />
        </mesh>
        {o?.mortgaged && (
          <mesh position={[0, TILE_HEIGHT + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial color="#1a1028" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        )}
        {(selected || (placing && hover)) && (
          <mesh position={[0, TILE_HEIGHT + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial color={placing ? '#ff8a3d' : '#ffd166'} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        )}
      </group>
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
        <group key={k} position={[d.x, 0, d.z]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[i * 0.02, 0.06 + i * 0.07, -i * 0.02]} castShadow receiveShadow>
              <boxGeometry args={[d.w, 0.06, d.d]} />
              <meshStandardMaterial color={i === 2 ? '#efe2c6' : '#d9c6a2'} />
            </mesh>
          ))}
          <mesh position={[0.04, 0.236, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[d.w, d.d]} />
            <meshStandardMaterial map={tex[k]} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Limited low-poly decor around the board (fewer on phones). */
function Trees({ profile }: { profile: Profile }) {
  const items = useMemo(() => {
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const res: { x: number; z: number; s: number }[] = [];
    const hw = profile.width / 2 + PLATE_MARGIN + 0.4;
    const hh = profile.height / 2 + PLATE_MARGIN + 0.4;
    const count = profile.id === 'portrait' ? 18 : 30;
    for (let k = 0; res.length < count && k < 400; k++) {
      const x = (rnd() * 2 - 1) * (hw + 4);
      const z = (rnd() * 2 - 1) * (hh + 3);
      if (Math.abs(x) < hw && Math.abs(z) < hh) continue;
      res.push({ x, z, s: 0.6 + rnd() * 0.6 });
    }
    return res;
  }, [profile]);
  void get;
  return (
    <group position={[0, -PLATE_THICKNESS, 0]}>
      {items.map((t, k) => (
        <group key={k} position={[t.x, 0, t.z]} scale={t.s}>
          <Model
            slot="tree"
            fallback={
              <>
                <mesh position={[0, 0.2, 0]} castShadow>
                  <cylinderGeometry args={[0.07, 0.09, 0.4, 6]} />
                  <meshStandardMaterial color="#6b4a2f" flatShading />
                </mesh>
                <mesh position={[0, 0.75, 0]} castShadow>
                  <coneGeometry args={[0.38, 0.9, 6]} />
                  <meshStandardMaterial color="#3f8a4c" flatShading />
                </mesh>
              </>
            }
          />
        </group>
      ))}
    </group>
  );
}
