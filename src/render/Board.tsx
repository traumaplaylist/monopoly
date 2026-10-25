import { useMemo } from 'react';
import { TILES } from '../engine';
import { useGame } from '../game/store';
import { createBoardTexture } from './boardTexture';
import { BAND, BOARD, BOARD_THICKNESS, CORNER, inward, tileRect } from './layout';

export function Board() {
  const texture = useMemo(() => createBoardTexture(), []);
  return (
    <group>
      <mesh position={[0, -BOARD_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD + 0.4, BOARD_THICKNESS, BOARD + 0.4]} />
        <meshStandardMaterial color="#0a1124" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[BOARD, BOARD]} />
        <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
      </mesh>
      <TileOverlays />
      <TileHitAreas />
    </group>
  );
}

/** Метки владельцев, затемнение заложенных клеток, подсветка выбранной. */
function TileOverlays() {
  const state = useGame((s) => s.state);
  const selected = useGame((s) => s.selectedTile);
  if (!state) return null;
  return (
    <group>
      {state.ownership.map((o, i) => {
        if (!o || !o.owner) return null;
        const owner = state.players.find((p) => p.id === o.owner);
        const r = tileRect(i);
        const [ix, iz] = inward(r.side);
        // Полоса владельца — у внешнего края клетки.
        const off = CORNER / 2 - 0.07;
        const x = r.x - ix * off;
        const z = r.z - iz * off;
        const horizontal = r.side === 0 || r.side === 2;
        return (
          <group key={i}>
            <mesh position={[x, 0.02, z]}>
              <boxGeometry args={horizontal ? [r.w - 0.08, 0.04, 0.12] : [0.12, 0.04, r.d - 0.08]} />
              <meshStandardMaterial color={owner?.color ?? '#fff'} emissive={owner?.color ?? '#fff'} emissiveIntensity={0.5} />
            </mesh>
            {o.mortgaged && (
              <mesh position={[r.x, 0.012, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[r.w - 0.04, r.d - 0.04]} />
                <meshBasicMaterial color="#000" transparent opacity={0.55} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
      {selected !== null && <SelectionMarker tile={selected} />}
    </group>
  );
}

function SelectionMarker({ tile }: { tile: number }) {
  const r = tileRect(tile);
  return (
    <mesh position={[r.x, 0.015, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[r.w, r.d]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

function TileHitAreas() {
  const selectTile = useGame((s) => s.selectTile);
  const selected = useGame((s) => s.selectedTile);
  return (
    <group>
      {TILES.map((t) => {
        const r = tileRect(t.index);
        return (
          <mesh
            key={t.index}
            position={[r.x, 0.05, r.z]}
            onClick={(e) => {
              e.stopPropagation();
              selectTile(selected === t.index ? null : t.index);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = '';
            }}
          >
            <boxGeometry args={[r.w, 0.1, r.d]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

export { BAND };
