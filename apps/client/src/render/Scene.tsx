import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { PCFShadowMap, Vector3 } from 'three';
import type { OrthographicCamera } from 'three';
import { Board } from './Board';
import { AnchorTracker } from './BoardAnchor';
import { Dice } from './Dice';
import { Pieces } from './Pieces';
import { Tokens } from './Tokens';
import { PROFILES, pickProfile } from './layout';
import type { Profile } from './layout';

/** Nearly top-down view with a small tilt (radians from vertical). */
const TILT = 0.42;
const CAM_DIST = 40;

/** Orthographic fit: all four corners visible without zoom. */
function CameraRig({ profile }: { profile: Profile }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    cam.position.set(0, CAM_DIST * Math.cos(TILT), CAM_DIST * Math.sin(TILT));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const m = profile.id === 'portrait' ? 0.15 : 0.35;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 0.9]) {
      const p = new Vector3(sx * (profile.width / 2 + m), y, sz * (profile.height / 2 + m)).applyMatrix4(cam.matrixWorldInverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    cam.left = -size.width / 2;
    cam.right = size.width / 2;
    cam.top = size.height / 2;
    cam.bottom = -size.height / 2;
    cam.zoom = Math.min(size.width / (maxX - minX), size.height / (maxY - minY));
    // Centre the board's projected bounding box.
    const cy = (minY + maxY) / 2;
    cam.position.y += cy * Math.sin(TILT);
    cam.position.z -= cy * Math.cos(TILT);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, profile]);
  return null;
}

function SceneContent() {
  const { size } = useThree();
  const profile = PROFILES[pickProfile(size.width, size.height)];
  return (
    <>
      <CameraRig profile={profile} />
      <AnchorTracker profile={profile} />
      <hemisphereLight args={['#fff4e6', '#4a3a5e', 1.1]} />
      <directionalLight
        position={[-6, 14, 8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0006}
      />
      <Board profile={profile} />
      <Pieces profile={profile} />
      <Tokens profile={profile} />
      <Dice profile={profile} />
    </>
  );
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Scene() {
  const [ok] = useState(webglAvailable);
  const dpr = useMemo<[number, number]>(() => [1, Math.min(2, window.devicePixelRatio || 1)], []);
  if (!ok) {
    return (
      <div className="webgl-missing">
        <b>3D-поле недоступно</b>
        <span>Браузер не поддерживает WebGL или он отключён. Включите аппаратное ускорение или откройте игру в Chrome.</span>
      </div>
    );
  }
  return (
    <Canvas orthographic shadows={{ type: PCFShadowMap }} dpr={dpr} camera={{ position: [0, 30, 15], near: 0.1, far: 200, zoom: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#3b3346']} />
      <SceneContent />
    </Canvas>
  );
}
