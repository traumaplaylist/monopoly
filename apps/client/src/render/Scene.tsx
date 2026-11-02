import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PCFShadowMap, Vector3 } from 'three';
import type { OrthographicCamera } from 'three';
import { Board } from './Board';
import { AnchorTracker } from './BoardAnchor';
import { Dice } from './Dice';
import { Pieces } from './Pieces';
import { Tokens } from './Tokens';
import { PROFILES, pickProfile } from './layout';
import type { Profile } from './layout';
import { QUALITY, RENDER_SCALE, SHADOWS } from './quality';
import { observeStage, stageRect } from './stage';

/** Nearly top-down view with a small tilt (radians from vertical). */
const TILT = 0.56;
const CAM_DIST = 40;

/**
 * The canvas covers the whole screen (the wooden table runs under the UI); the board is fitted
 * into the free «stage» rectangle of the layout with an off-centre orthographic frustum.
 */
function CameraRig({ profile }: { profile: Profile }) {
  const { camera, size, invalidate } = useThree();
  const last = useRef('');
  useEffect(() => observeStage(() => invalidate()), [invalidate]);
  useFrame(() => {
    const st = stageRect(size.width, size.height);
    const key = `${size.width}x${size.height}:${st.x},${st.y},${st.w},${st.h}:${profile.id}`;
    if (key === last.current) return;
    last.current = key;
    const cam = camera as OrthographicCamera & { manual?: boolean };
    cam.manual = true; // R3F must not reset our off-centre frustum on resize
    cam.position.set(0, CAM_DIST * Math.cos(TILT), CAM_DIST * Math.sin(TILT));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const m = profile.id === 'portrait' ? 0.25 : 0.45;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 0.9]) {
      const p = new Vector3(sx * (profile.width / 2 + m), y, sz * (profile.height / 2 + m)).applyMatrix4(cam.matrixWorldInverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    cam.zoom = Math.min(st.w / (maxX - minX), st.h / (maxY - minY));
    // Centre of the projected board box (view space) goes to the centre of the stage rectangle.
    // three.js: view x of pixel px = (left + right) / 2 + (px - W / 2) / zoom (same for y).
    const cxv = (minX + maxX) / 2;
    const cyv = (minY + maxY) / 2;
    const cx = cxv - (st.x + st.w / 2 - size.width / 2) / cam.zoom;
    const cy = cyv - (size.height / 2 - (st.y + st.h / 2)) / cam.zoom;
    cam.left = cx - size.width / 2;
    cam.right = cx + size.width / 2;
    cam.top = cy + size.height / 2;
    cam.bottom = cy - size.height / 2;
    cam.updateProjectionMatrix();
  });
  return null;
}

function Sun({ profile }: { profile: Profile }) {
  const span = Math.max(profile.width, profile.height) / 2 + 6;
  const res = QUALITY === 'high' ? 2048 : 1024;
  return (
    <directionalLight
      color="#fff6ea"
      position={[-8, 16, 6]}
      intensity={1.9}
      castShadow
      shadow-mapSize={[res, res]}
      shadow-camera-left={-span}
      shadow-camera-right={span}
      shadow-camera-top={span}
      shadow-camera-bottom={-span}
      shadow-camera-near={1}
      shadow-camera-far={60}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-radius={QUALITY === 'high' ? 5 : 3}
    />
  );
}

function SceneContent() {
  const { size } = useThree();
  const st = stageRect(size.width, size.height);
  const profile = PROFILES[pickProfile(st.w, st.h)];
  return (
    <>
      <CameraRig profile={profile} />
      <AnchorTracker profile={profile} />
      <hemisphereLight args={['#fff8ee', '#6a5aa8', 1.0]} />
      <ambientLight color="#fff0dc" intensity={0.3} />
      <Sun profile={profile} />
      <group position={[0, 0, 0]}>
        <Board profile={profile} />
        <Pieces profile={profile} />
        <Tokens profile={profile} />
        <Dice profile={profile} />
      </group>
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
  const dpr = useMemo<[number, number]>(() => {
    const max = Math.min(QUALITY === 'high' ? 2 : 1.75, window.devicePixelRatio || 1) * RENDER_SCALE;
    return [Math.min(1, max), max];
  }, []);
  if (!ok) {
    return (
      <div className="webgl-missing">
        <b>3D-поле недоступно</b>
        <span>Браузер не поддерживает WebGL или он отключён. Включите аппаратное ускорение или откройте игру в Chrome.</span>
      </div>
    );
  }
  return (
    <Canvas frameloop="demand" flat orthographic shadows={SHADOWS ? { type: PCFShadowMap } : false} dpr={dpr} camera={{ position: [0, 30, 15], near: 0.1, far: 200, zoom: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#221c47']} />
      <SceneContent />
    </Canvas>
  );
}
