import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PCFShadowMap, PerspectiveCamera, Vector3 } from 'three';
import { Board } from './Board';
import { AnchorTracker } from './BoardAnchor';
import { Buildings } from './Buildings';
import { Dice } from './Dice';
import { Tokens } from './Tokens';
import { BOARD_H, BOARD_W } from './layout';

const FOV = 30;
/** Наклон камеры от вертикали: почти вид сверху, как на макете. */
const TILT = 0.4;

/** Подбирает дистанцию, при которой все углы поля попадают в кадр (с отступом). */
function fitDistance(aspect: number): number {
  const cam = new PerspectiveCamera(FOV, aspect, 0.1, 500);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => new Vector3(((sx! * BOARD_W) / 2) * 1.04, 0.3, ((sz! * BOARD_H) / 2) * 1.06));
  const fits = (d: number) => {
    cam.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    return corners.every((c) => {
      const p = c.clone().project(cam);
      return Math.abs(p.x) <= 0.98 && Math.abs(p.y) <= 0.96;
    });
  };
  let lo = 5;
  let hi = 120;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const d = fitDistance(size.width / Math.max(1, size.height));
    camera.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT));
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  return null;
}

export function Scene() {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [0, 20, 10], near: 0.1, far: 400 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1c1630']} />
      <fog attach="fog" args={['#1c1630', 30, 70]} />
      <CameraRig />
      <hemisphereLight args={['#fff4e0', '#3a2f55', 0.9]} />
      <directionalLight
        position={[-8, 18, 10]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      <Board />
      <Buildings />
      <Tokens />
      <Dice />
      <AnchorTracker />
      <OrbitControls enablePan={false} minDistance={6} maxDistance={70} minPolarAngle={0} maxPolarAngle={1.15} makeDefault />
    </Canvas>
  );
}
