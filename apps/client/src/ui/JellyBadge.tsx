// Flat «jelly figure» badge for the HUD: the same silhouette as the 3D token, in the player's colour.
// Placeholder until the appearance editor (docs/VISUAL_DIRECTION.md, plan item 4).
export function JellyBadge({ color, ghost = false, size = 48 }: { color: string; ghost?: boolean; size?: number }) {
  const id = `jb${color.replace('#', '')}${ghost ? 'g' : ''}`;
  const c = ghost ? '#cbbdf5' : color;
  return (
    <svg className="jelly-badge" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ ['--pc' as string]: c }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={c} stopOpacity="0.85" />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" style={{ fill: `color-mix(in srgb, ${c} 18%, white)` }} />
      <g opacity={ghost ? 0.7 : 1}>
        <ellipse cx="24" cy="41" rx="11" ry="3" fill={c} opacity="0.35" />
        <path d="M14.5 41 L33.5 41 C35 31 34 24 27.5 21.5 A8 8 0 1 0 20.5 21.5 C14 24 13 31 14.5 41 Z" fill={`url(#${id})`} stroke={c} strokeWidth="1.2" />
        <ellipse cx="20.5" cy="12" rx="2.6" ry="1.6" fill="#fff" opacity="0.8" transform="rotate(-30 20.5 12)" />
      </g>
    </svg>
  );
}
