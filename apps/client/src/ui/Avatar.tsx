import type { Player } from '../engine';
import { useManifest } from '../render/assets';

const FACES = ['🧑‍🚀', '👩‍🔬', '🧔', '👩‍🚀', '🧑‍🔧', '👨‍✈️'];

/** Портрет игрока: картинка из public/assets.json (avatars) или заглушка. */
export function Avatar({ player, size = 64 }: { player: Player; size?: number }) {
  const manifest = useManifest();
  const url = manifest.avatars[String(player.token)];
  const style = { width: size, height: size, ['--pc' as string]: player.color };
  if (player.bankrupt) {
    return (
      <div className="avatar ghost" style={style}>
        👻
      </div>
    );
  }
  if (url) return <img className="avatar" src={url} alt={player.name} style={style} />;
  return (
    <div className="avatar" style={style}>
      <span style={{ fontSize: size * 0.55 }}>{FACES[player.token % FACES.length]}</span>
    </div>
  );
}
