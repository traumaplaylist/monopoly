import { useManifest } from '../render/assets';

/** Characters: Fluent Emoji 3D animals (MIT, public/icons/avatars/<n>.png); assets.json avatars override. */
export const AVATAR_NAMES = ['Лиса', 'Панда', 'Кот', 'Лягушка', 'Лев', 'Коала', 'Тигр', 'Обезьянка'];
export const AVATAR_COUNT = AVATAR_NAMES.length;

export function Portrait({ avatar, color, ghost = false, size = 48 }: { avatar: number; color: string; ghost?: boolean; size?: number }) {
  const manifest = useManifest();
  const custom = !ghost ? manifest.avatars[String(avatar)] : undefined;
  const url = custom ?? `icons/avatars/${ghost ? 'ghost' : avatar % AVATAR_COUNT}.png`;
  return (
    <span className={`portrait ${ghost ? 'ghost' : ''}`} style={{ ['--pc' as string]: color, ['--ps' as string]: `${size}px` }}>
      <img src={url} alt="" draggable={false} />
    </span>
  );
}
