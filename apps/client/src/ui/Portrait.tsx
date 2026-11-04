import { useEffect, useState } from 'react';
import type { Appearance } from '@pb/content';
import { useManifest } from '../render/assets';
import { characterPortrait } from '../render/portrait';

/** Animal pictures (Fluent Emoji 3D, MIT): fallback while a character portrait renders, and for ghosts. */
export const AVATAR_NAMES = ['Лиса', 'Панда', 'Кот', 'Лягушка', 'Лев', 'Коала', 'Тигр', 'Обезьянка'];
export const AVATAR_COUNT = AVATAR_NAMES.length;

/**
 * Player portrait. With `appearance` it shows the player's own wardrobe character (rendered once
 * and cached); until then, or without WebGL, the animal picture.
 */
export function Portrait({ avatar, color, ghost = false, size = 48, appearance }: { avatar: number; color: string; ghost?: boolean; size?: number; appearance?: Appearance }) {
  const manifest = useManifest();
  const [img, setImg] = useState<string | null>(null);
  const key = appearance ? JSON.stringify(appearance) + ghost : '';
  useEffect(() => {
    if (!appearance) return;
    let alive = true;
    void characterPortrait(appearance, ghost).then((u) => alive && setImg(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const custom = !ghost ? manifest.avatars[String(avatar)] : undefined;
  const animal = custom ?? `icons/avatars/${ghost ? 'ghost' : avatar % AVATAR_COUNT}.png`;
  return (
    <span className={`portrait ${ghost ? 'ghost' : ''} ${img ? 'char' : ''}`} style={{ ['--pc' as string]: color, ['--ps' as string]: `${size}px` }}>
      <img src={img ?? animal} alt="" draggable={false} />
    </span>
  );
}
