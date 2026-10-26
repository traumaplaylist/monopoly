import { send } from '../net/connection';
import { get, set, toast } from '../state/store';
import { errorText } from './format';

/** Board click: placement mode places a trap; otherwise opens tile details. */
export function onTileClick(index: number): void {
  const { placing, match } = get();
  if (!match) return;
  if (placing === 'cone') {
    set({ placing: null });
    void send({ type: 'PLACE_CONE', tile: index });
    return;
  }
  if (placing === 'ghostTrap') {
    set({ placing: null });
    void send({ type: 'GHOST_TRAP', tile: index });
    return;
  }
  if (placing === 'ghostBlock') {
    const owner = match.tiles[index]?.owner;
    if (!owner) {
      toast(errorText('notOwned'), 'error');
      return;
    }
    set({ placing: null });
    void send({ type: 'GHOST_BLOCK', target: owner, tile: index });
    return;
  }
  set({ selectedTile: index, sheet: { kind: 'tile', tile: index } });
}

export function closeSheet(): void {
  set({ sheet: null, selectedTile: null });
}
