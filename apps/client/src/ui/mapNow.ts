// The board of the current match (each match stores its map id; lobby/home show «Вокруг света»).
import { getMap } from '@pb/content';
import type { MapDef } from '@pb/content';
import { useStore } from '../state/store';

/** Current board for non-React code and event handlers. */
export const mapNow = (): MapDef => getMap(useStore.getState().match?.settings.mapId);

/** Current board as a React hook (re-renders when the match changes map). */
export function useMapDef(): MapDef {
  return getMap(useStore((s) => s.match?.settings.mapId));
}
