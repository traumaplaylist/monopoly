import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Board } from './Board';
import { Buildings } from './Buildings';
import { Dice } from './Dice';
import { Tokens } from './Tokens';
import { BOARD } from './layout';
import { PCFShadowMap } from 'three';

const FOV = 40;
/** Угол камеры от вертикали. */
const TILT = 0.62;

/** Подбираем дистанцию камеры под соотношение сторон, чтобы поле целиком влезало и на узких экранах. */
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const half = BOARD / 2 + 0.5;
    const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);
    const tanH = tanV * aspect;
    // По вертикали поле видно под наклоном: его проекция короче примерно на cos(TILT).
    const dist = Math.max(half / tanH, (half * Math.cos(TILT) + 1.2) / tanV) + half * Math.sin(TILT);
    camera.position.set(0, dist * Math.cos(TILT), dist * Math.sin(TILT));
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  return null;
}

export function Scene() {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [0, 14, 10.5], near: 0.1, far: 300 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      onPointerMissed={() => undefined}
    >
      <color attach="background" args={['#050914']} />
      <CameraRig />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[0, 4, 0]} intensity={8} color="#ffd166" distance={14} />
      <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.5} />
      <Board />
      <Buildings />
      <Tokens />
      <Dice />
      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={60}
        minPolarAngle={0.15}
        maxPolarAngle={1.2}
        target={[0, 0, 0]}
        makeDefault
      />
    </Canvas>
  );
}
