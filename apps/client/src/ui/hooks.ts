import { useMemo } from 'react';
import { getActor, validate } from '../engine';
import type { Action, GameState } from '../engine';
import { isAnimating, useGame } from '../game/store';

/** Допустимо ли действие — решает только движок. */
export function canDo(state: GameState | null, action: Action): boolean {
  return !!state && validate(state, action) === null;
}

export function useGameState(): GameState {
  const s = useGame((x) => x.state);
  if (!s) throw new Error('Нет активной партии');
  return s;
}

export function useMe() {
  const state = useGameState();
  const id = useGame((x) => x.localPlayerId);
  return state.players.find((p) => p.id === id)!;
}

/** Ход локального игрока и фишки уже доехали. */
export function useMyTurnReady(): boolean {
  const state = useGameState();
  const id = useGame((x) => x.localPlayerId);
  const moves = useGame((x) => x.moves);
  return useMemo(() => getActor(state) === id && !isAnimating(moves), [state, id, moves]);
}
