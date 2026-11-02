import { iconSvg } from '../render/icons';
import { VISUAL_ICONS } from '../render/tileArt';

/** White line icon of a tile (same set as on the board); «?» for chance tiles. */
export function TileIcon({ visual, size = 28 }: { visual: string; size?: number }) {
  const svg = iconSvg(visual);
  if (!svg) return <b className="tile-icon-q" style={{ fontSize: size * 0.95 }}>{VISUAL_ICONS[visual] ?? '?'}</b>;
  return <span className="tile-icon" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
