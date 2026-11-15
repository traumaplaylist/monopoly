// Diorama post-processing: soft contact shadows (N8AO ambient occlusion), a gentle glow on bright
// highlights, a little saturation and a vignette. (Tilt-shift blur was tried and dropped: it blurred
// the near row of tiles and their names.)
// Only on a real GPU (POST in quality.ts); the classic look renders without a composer.
import { Bloom, EffectComposer, HueSaturation, N8AO, Vignette } from '@react-three/postprocessing';
import { QUALITY } from './quality';

export function Post() {
  const high = QUALITY === 'high';
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={3.2} quality={high ? 'medium' : 'low'} halfRes={!high} color="#2a1f4a" />
      <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.08} intensity={0.45} mipmapBlur />
      <HueSaturation saturation={0.16} />
      <Vignette offset={0.3} darkness={0.55} />
    </EffectComposer>
  );
}
