import { useGame } from '../game/store';
import { BAND, CORNER, along, inward, tileRect } from './layout';

/** Модули (дома) и станции (отели) на цветной полосе клетки. */
export function Buildings() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const items: React.ReactElement[] = [];
  state.ownership.forEach((o, i) => {
    if (!o || o.houses === 0) return;
    const r = tileRect(i);
    const [ix, iz] = inward(r.side);
    const [ax, az] = along(r.side);
    // Центр цветной полосы (у внутреннего края).
    const off = CORNER / 2 - BAND / 2;
    const cx = r.x + ix * off;
    const cz = r.z + iz * off;
    if (o.houses === 5) {
      items.push(
        <mesh key={`h${i}`} position={[cx, 0.17, cz]} castShadow>
          <boxGeometry args={r.side % 2 === 0 ? [0.62, 0.3, 0.3] : [0.3, 0.3, 0.62]} />
          <meshStandardMaterial color="#ffb703" emissive="#ff8800" emissiveIntensity={0.25} metalness={0.5} roughness={0.3} />
        </mesh>,
      );
      return;
    }
    for (let k = 0; k < o.houses; k++) {
      const t = (k - 1.5) * 0.27;
      items.push(
        <group key={`${i}-${k}`} position={[cx + ax * t, 0, cz + az * t]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.18, 12]} />
            <meshStandardMaterial color="#4cd7a0" metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#b9fbe0" metalness={0.2} roughness={0.2} transparent opacity={0.85} />
          </mesh>
        </group>,
      );
    }
  });
  return <group>{items}</group>;
}
