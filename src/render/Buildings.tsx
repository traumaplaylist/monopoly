import { useGame } from '../game/store';
import { Model } from './assets';
import { TILE_HEIGHT, stripCenter } from './layout';

function House() {
  return (
    <Model
      slot="house"
      fallback={
        <group>
          <mesh position={[0, 0.07, 0]} castShadow>
            <boxGeometry args={[0.16, 0.14, 0.16]} />
            <meshStandardMaterial color="#f2e2c4" />
          </mesh>
          <mesh position={[0, 0.19, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.15, 0.12, 4]} />
            <meshStandardMaterial color="#e2574c" flatShading />
          </mesh>
        </group>
      }
    />
  );
}

function Hotel() {
  return (
    <Model
      slot="hotel"
      fallback={
        <group>
          <mesh position={[0, 0.13, 0]} castShadow>
            <boxGeometry args={[0.42, 0.26, 0.2]} />
            <meshStandardMaterial color="#e2574c" />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.46, 0.06, 0.24]} />
            <meshStandardMaterial color="#8a2f2a" />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.16, 6]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
        </group>
      }
    />
  );
}

/** Модули (дома) и станции (отели) — на цветной полосе у внешнего края клетки. */
export function Buildings() {
  const ownership = useGame((s) => s.state?.ownership);
  if (!ownership) return null;
  return (
    <group>
      {ownership.map((o, i) => {
        if (!o || o.houses === 0) return null;
        const c = stripCenter(i);
        const y = TILE_HEIGHT;
        if (o.houses === 5) {
          return (
            <group key={i} position={[c.x, y, c.z]} rotation={[0, c.horizontal ? 0 : Math.PI / 2, 0]}>
              <Hotel />
            </group>
          );
        }
        return (
          <group key={i}>
            {Array.from({ length: o.houses }, (_, k) => {
              const t = (k - (o.houses - 1) / 2) * 0.24;
              return (
                <group key={k} position={[c.x + (c.horizontal ? t : 0), y, c.z + (c.horizontal ? 0 : t)]}>
                  <House />
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
