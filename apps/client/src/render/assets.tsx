// Подключаемая графика. Художник кладёт файлы в public/ и прописывает их в public/assets.json:
//   models  — glTF-модели (.glb) для слотов: token, ghost, house, hotel, decor-rock, decor-crystal, deck
//   icons   — картинки иконок клеток по номеру клетки: { "1": "icons/crater.png" }
//   avatars — портреты игроков по номеру фишки 0..5: { "0": "avatars/0.png" }
// Если файла нет — рисуется встроенная заглушка. Подробно — docs/ASSETS.md.
import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';

export type ModelSlot = 'token' | 'ghost' | 'house' | 'hotel' | 'decor-rock' | 'decor-crystal' | 'deck';

export interface AssetManifest {
  models: Partial<Record<ModelSlot, string>>;
  icons: Record<string, string>;
  avatars: Record<string, string>;
}

const EMPTY: AssetManifest = { models: {}, icons: {}, avatars: {} };
let cached: AssetManifest | null = null;
let pending: Promise<AssetManifest> | null = null;

export function loadManifest(): Promise<AssetManifest> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch('assets.json')
    .then((r) => (r.ok ? r.json() : EMPTY))
    .then((m: Partial<AssetManifest>) => (cached = { ...EMPTY, ...m }))
    .catch(() => (cached = EMPTY));
  return pending;
}

export function useManifest(): AssetManifest {
  const [m, setM] = useState<AssetManifest>(cached ?? EMPTY);
  useEffect(() => {
    let alive = true;
    void loadManifest().then((x) => alive && setM(x));
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

/** Загрузка картинки (для иконок клеток на canvas-текстурах). */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Материалы с именем «Tint» перекрашиваются в цвет игрока. */
function GltfModel({ url, tint }: { url: string; tint?: string }) {
  const { scene } = useGLTF(url);
  const obj = useMemo<Object3D>(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (tint && o.material instanceof MeshStandardMaterial && o.material.name === 'Tint') {
          o.material = o.material.clone();
          (o.material as MeshStandardMaterial).color = new Color(tint);
        }
      }
    });
    return clone;
  }, [scene, tint]);
  return <primitive object={obj} />;
}

/** Модель из манифеста, а пока её нет или она не загрузилась — заглушка. */
export function Model({ slot, tint, fallback }: { slot: ModelSlot; tint?: string; fallback: ReactNode }) {
  const manifest = useManifest();
  const url = manifest.models[slot];
  if (!url) return <>{fallback}</>;
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} tint={tint} />
      </Suspense>
    </Fallback>
  );
}
