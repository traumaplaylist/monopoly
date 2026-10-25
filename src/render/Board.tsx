import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MeshStandardMaterial } from 'three';
import type { Group, Texture } from 'three';
import { TILES, tile } from '../engine';
import { useGame } from '../game/store';
import { Model, loadImage, useManifest } from './assets';
import { BOARD_H, BOARD_W, GAP, TILE_HEIGHT, tileRect } from './layout';
import { createDeckTexture, createTileTexture, tileBaseColor } from './tileArt';

const PLATE_MARGIN = 0.7;
/** Колоды карточек — ниже центра поля. */
export const DECKS_Z = 1.2;
const PLATE_THICKNESS = 0.4;

export function Board() {
  return (
    <group>
      {/* Подложка поля и «сукно» в центре */}
      <mesh position={[0, -PLATE_THICKNESS / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[BOARD_W + PLATE_MARGIN * 2, PLATE_THICKNESS, BOARD_H + PLATE_MARGIN * 2]} />
        <meshStandardMaterial color="#3a2f55" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[BOARD_W, BOARD_H]} />
        <meshStandardMaterial color="#2f6d70" roughness={0.95} />
      </mesh>
      <Ground />
      <Tiles />
      <Decks />
      <Decor />
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PLATE_THICKNESS, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial color="#1c1630" roughness={1} />
    </mesh>
  );
}

function useTileTextures(): Texture[] | null {
  const manifest = useManifest();
  const [textures, setTextures] = useState<Texture[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(
      TILES.map((t) => (manifest.icons[t.index] ? loadImage(manifest.icons[t.index]!) : Promise.resolve(null))),
    ).then((imgs) => {
      if (alive) setTextures(TILES.map((t, i) => createTileTexture(t.index, imgs[i] ?? null)));
    });
    return () => {
      alive = false;
    };
  }, [manifest]);
  useEffect(() => () => textures?.forEach((t) => t.dispose()), [textures]);
  return textures;
}

function Tiles() {
  const textures = useTileTextures();
  if (!textures) return null;
  return (
    <group>
      {TILES.map((t) => (
        <TileBlock key={t.index} index={t.index} texture={textures[t.index]!} />
      ))}
    </group>
  );
}

function TileBlock({ index, texture }: { index: number; texture: Texture }) {
  const r = tileRect(index);
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const selected = useGame((s) => s.selectedTile === index);
  const selectTile = useGame((s) => s.selectTile);
  const o = useGame((s) => s.state?.ownership[index] ?? null);
  const ownerColor = useGame((s) => (o?.owner ? s.state?.players.find((p) => p.id === o.owner)?.color : undefined));

  const materials = useMemo(() => {
    const side = new MeshStandardMaterial({ color: tileBaseColor(tile(index)), roughness: 0.75 });
    const top = new MeshStandardMaterial({ map: texture, roughness: 0.7 });
    return [side, side, top, side, side, side];
  }, [index, texture]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = selected ? 0.18 : hover ? 0.07 : 0;
    g.position.y += (target - g.position.y) * Math.min(1, dt * 12);
  });

  const w = r.w - GAP;
  const d = r.d - GAP;
  return (
    <group position={[r.x, 0, r.z]}>
      {ownerColor && (
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[w + 0.1, 0.1, d + 0.1]} />
          <meshStandardMaterial color={ownerColor} emissive={ownerColor} emissiveIntensity={0.6} />
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
            selectTile(selected ? null : index);
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
        >
          <boxGeometry args={[w, TILE_HEIGHT, d]} />
        </mesh>
        {o?.mortgaged && (
          <mesh position={[0, TILE_HEIGHT + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial color="#1a1028" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        )}
        {selected && (
          <mesh position={[0, TILE_HEIGHT + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial color="#ffd166" transparent opacity={0.25} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Decks() {
  const signal = useMemo(() => createDeckTexture('signal'), []);
  const council = useMemo(() => createDeckTexture('council'), []);
  const z = DECKS_Z;
  return (
    <group>
      {(
        [
          [signal, -1.45],
          [council, 1.45],
        ] as const
      ).map(([tex, x], k) => (
        <group key={k} position={[x, 0, z]}>
          <Model
            slot="deck"
            fallback={
              <>
                <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
                  <boxGeometry args={[2.3, 0.28, 1.5]} />
                  <meshStandardMaterial color="#e6d6b8" />
                </mesh>
                <mesh position={[0, 0.285, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[2.3, 1.5]} />
                  <meshStandardMaterial map={tex} roughness={0.6} />
                </mesh>
              </>
            }
          />
        </group>
      ))}
    </group>
  );
}

/** Декор вокруг поля: камни и кристаллы (заглушки под модели из Blender). */
function Decor() {
  const items = useMemo(() => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const res: { x: number; z: number; s: number; rot: number; kind: 'rock' | 'crystal'; color: string }[] = [];
    const hw = BOARD_W / 2 + PLATE_MARGIN + 0.5;
    const hh = BOARD_H / 2 + PLATE_MARGIN + 0.5;
    const colors = ['#7be0d6', '#b48cff', '#ff8fc7', '#8fb8ff'];
    for (let k = 0; k < 110; k++) {
      const x = (rnd() * 2 - 1) * (hw + 7);
      const z = (rnd() * 2 - 1) * (hh + 6);
      if (Math.abs(x) < hw && Math.abs(z) < hh) continue;
      const crystal = rnd() < 0.4;
      res.push({
        x,
        z,
        s: 0.3 + rnd() * 0.55,
        rot: rnd() * Math.PI,
        kind: crystal ? 'crystal' : 'rock',
        color: colors[Math.floor(rnd() * colors.length)]!,
      });
    }
    return res;
  }, []);
  return (
    <group position={[0, -PLATE_THICKNESS, 0]}>
      {items.map((it, k) => (
        <group key={k} position={[it.x, 0, it.z]} rotation={[0, it.rot, 0]} scale={it.s}>
          {it.kind === 'crystal' ? (
            <Model
              slot="decor-crystal"
              fallback={
                <mesh position={[0, 0.7, 0]} scale={[0.45, 1, 0.45]} castShadow>
                  <octahedronGeometry args={[0.8, 0]} />
                  <meshStandardMaterial
                    color={it.color}
                    emissive={it.color}
                    emissiveIntensity={0.35}
                    roughness={0.25}
                    flatShading
                  />
                </mesh>
              }
            />
          ) : (
            <Model
              slot="decor-rock"
              fallback={
                <mesh position={[0, 0.3, 0]} scale={[1, 0.6, 1]} castShadow>
                  <dodecahedronGeometry args={[0.6, 0]} />
                  <meshStandardMaterial color="#4a3f66" roughness={0.9} flatShading />
                </mesh>
              }
            />
          )}
        </group>
      ))}
    </group>
  );
}
