// DEV ONLY (?thumbs=1): renders one wardrobe part at a time so a script can save item thumbnails
// (scripts/make-thumbs.mjs → public/models/characters/thumbs/<outfit>-<slot>.png).
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { OUTFITS, sanitizeAppearance } from '@pb/content';
import type { Slot } from '@pb/content';
import { Character } from '../render/character';

const CAM: Record<Slot, { y: number; z: number }> = {
  head: { y: 0.5, z: 1.9 },
  body: { y: 0.5, z: 1.9 },
  legs: { y: 0.5, z: 1.9 },
  feet: { y: 0.62, z: 1.7 },
};

export function ThumbStudio() {
  const [job, setJob] = useState<{ id: string; slot: Slot } | null>(null);
  (window as unknown as { __thumbJob: (id: string, slot: Slot) => void }).__thumbJob = (id, slot) => setJob({ id, slot });
  const o = OUTFITS.find((x) => x.id === job?.id);
  const a = o ? sanitizeAppearance({ pack: o.pack, head: o.id, body: o.id, legs: o.id, feet: o.id, skin: '#f6c7a4', hair: '#7a4a26' }) : null;
  return (
    <div style={{ width: 256, height: 256 }} data-testid="thumb-studio">
      <Canvas gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} camera={{ position: [0, 0.5, 1.6], fov: 35 }} flat>
        <hemisphereLight args={['#ffffff', '#6a5aa8', 1.3]} />
        <directionalLight position={[2, 3, 3]} intensity={1.7} />
        {a && job && (
          <Suspense fallback={null}>
            <group key={`${job.id}-${job.slot}`} position={[0, -0.0, 0]} rotation={[0, 0.35, 0]}>
              <Character appearance={a} height={1} only={job.slot} />
            </group>
            <CameraAt y={CAM[job.slot].y} z={CAM[job.slot].z} />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}


function CameraAt({ y, z }: { y: number; z: number }) {
  const cam = useThree((s) => s.camera);
  cam.position.set(0, y, z);
  cam.lookAt(0, y, 0);
  return null;
}
