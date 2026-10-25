import { useEffect } from 'react';
import { getActor } from '../engine';
import { chooseBotAction } from '../bots';
import { isAnimating, useGame } from './store';

/** Пока действовать должен бот и анимации закончились — бот делает ход с задержкой. */
export function useBotRunner(): void {
  const state = useGame((s) => s.state);
  const moves = useGame((s) => s.moves);
  const botDelay = useGame((s) => s.botDelay);
  const dispatch = useGame((s) => s.dispatch);

  useEffect(() => {
    if (!state || state.phase === 'gameOver') return;
    const actor = getActor(state);
    const player = state.players.find((p) => p.id === actor);
    if (!player?.isBot || isAnimating(moves)) return;
    const timer = setTimeout(() => {
      const fresh = useGame.getState().state;
      if (fresh !== state) return;
      const action = chooseBotAction(state, player.id);
      if (action) dispatch(action);
    }, botDelay);
    return () => clearTimeout(timer);
  }, [state, moves, botDelay, dispatch]);
}
