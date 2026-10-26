// Projections sent to clients. Never include RNG state, seed, deck order or hidden mini-game answers.
import type { MatchState, MemoryGame, Minigame, PlayerState, SeatId } from './types';

export type PublicMemoryGame = Omit<MemoryGame, 'sequences'> & { current: number[] | null };
export type PublicMinigame = Omit<Minigame, 'game'> & { game: Exclude<Minigame['game'], MemoryGame> | PublicMemoryGame };
export type PublicPlayer = Omit<PlayerState, 'pendingItem' | 'ghostTargets'>;

export type PublicMatch = Omit<MatchState, 'rng' | 'seed' | 'deck' | 'minigame' | 'players'> & {
  players: PublicPlayer[];
  minigame: PublicMinigame | null;
};

export interface PrivateView {
  seat: SeatId;
  pendingItem: PlayerState['pendingItem'];
}

export function publicView(s: MatchState): PublicMatch {
  const { rng: _rng, seed: _seed, deck: _deck, minigame, players, ...rest } = s;
  void _rng;
  void _seed;
  void _deck;
  let mg: PublicMinigame | null = null;
  if (minigame) {
    if (minigame.game.kind === 'memory') {
      const { sequences, ...g } = minigame.game;
      mg = { ...minigame, game: { ...g, current: g.revealed !== null ? sequences[g.revealed]! : null } };
    } else {
      mg = minigame as PublicMinigame;
    }
  }
  return {
    ...rest,
    players: players.map(({ pendingItem: _p, ghostTargets: _g, ...p }) => p),
    minigame: mg,
  };
}

export function privateView(s: MatchState, seat: SeatId): PrivateView {
  const p = s.players.find((x) => x.seat === seat);
  return { seat, pendingItem: p?.pendingItem ?? null };
}
