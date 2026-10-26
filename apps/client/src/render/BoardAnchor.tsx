// DOM overlays pinned to points of the board. Each frame we project the point to screen space
// and move the element via style.transform (no React re-render per frame).
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { centerLayout } from './layout';
import type { Profile } from './layout';

export type AnchorId = 'banner' | 'prompt';

const elements = new Map<AnchorId, HTMLElement>();

export function anchorRef(id: AnchorId) {
  return (el: HTMLElement | null) => {
    if (el) elements.set(id, el);
    else elements.delete(id);
  };
}

const v = new Vector3();

export function AnchorTracker({ profile }: { profile: Profile }) {
  const c = centerLayout(profile);
  const points: Record<AnchorId, [number, number, number]> = { banner: [0, 0.3, c.banner], prompt: [0, 0.3, c.prompt] };
  useFrame(({ camera, size }) => {
    for (const [id, el] of elements) {
      v.set(...points[id]).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  });
  return null;
}
