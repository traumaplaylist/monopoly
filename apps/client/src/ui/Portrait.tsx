import { useManifest } from '../render/assets';
import { portraitUrl } from '../render/pixelArt';

/** Pixel portrait (or artist-provided image from assets.json). */
export function Portrait({ avatar, color, ghost = false, size = 48 }: { avatar: number; color: string; ghost?: boolean; size?: number }) {
  const manifest = useManifest();
  const url = !ghost && manifest.avatars[String(avatar)] ? manifest.avatars[String(avatar)]! : portraitUrl(avatar, color, ghost);
  return <img className={`portrait ${ghost ? 'ghost' : ''}`} src={url} width={size} height={size} alt="" style={{ ['--pc' as string]: color }} draggable={false} />;
}
