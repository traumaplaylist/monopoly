// Flat meeple badge for the HUD: the same silhouette as the 3D token, in the player's colour.
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
        <ellipse cx="24" cy="43" rx="15" ry="2.5" fill={c} opacity="0.3" />
        <path d="M9 42 L19 42 Q24 34 29 42 L39 42 Q37.5 33 32 27 L38.5 25 Q42 22 38.5 19.5 L30.5 18.5 A6.5 6.5 0 1 0 17.5 18.5 L9.5 19.5 Q6 22 9.5 25 L16 27 Q10.5 33 9 42 Z" fill={`url(#${id})`} stroke={c} strokeWidth="1.2" />
        <ellipse cx="21.5" cy="10" rx="2.4" ry="1.5" fill="#fff" opacity="0.8" transform="rotate(-30 20.5 12)" />
      </g>
    </svg>
  );
}
