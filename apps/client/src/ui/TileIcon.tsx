import { fluentUrl, iconSvg } from '../render/icons';
import { VISUAL_ICONS } from '../render/tileArt';

/** White line icon of a tile (same set as on the board); «?» for chance tiles. */
export function TileIcon({ visual, size = 28 }: { visual: string; size?: number }) {
  const png = fluentUrl(visual);
  if (png) return <img className="tile-icon" src={png} width={size} height={size} alt="" draggable={false} />;
  const svg = iconSvg(visual);
  if (!svg) return <b className="tile-icon-q" style={{ fontSize: size * 0.95 }}>{VISUAL_ICONS[visual] ?? '?'}</b>;
  return <span className="tile-icon" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
