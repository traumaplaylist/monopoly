import { GROUPS, ownedTiles, tile } from '../engine';
import { useGame } from '../game/store';
import { useGameState, useMe } from './hooks';

export function AssetsPanel() {
  const state = useGameState();
  const me = useMe();
  const selectTile = useGame((s) => s.selectTile);
  const selected = useGame((s) => s.selectedTile);
  const tiles = ownedTiles(state, me.id);
  if (tiles.length === 0) return <p className="hint">У вас пока нет имущества.</p>;
  return (
    <div className="assets">
      {tiles.map((i) => {
        const t = tile(i);
        const o = state.ownership[i]!;
        const color = t.group ? GROUPS[t.group].color : t.kind === 'transport' ? '#9aa7c7' : '#c7b89a';
        return (
          <button
            key={i}
            className={`asset ${selected === i ? 'sel' : ''} ${o.mortgaged ? 'mortgaged' : ''}`}
            onClick={() => selectTile(i)}
          >
            <span className="swatch" style={{ background: color }} />
            <span className="aname">{t.name}</span>
            <span className="ahouses">{o.houses === 5 ? '★' : '•'.repeat(o.houses)}</span>
          </button>
        );
      })}
    </div>
  );
}
