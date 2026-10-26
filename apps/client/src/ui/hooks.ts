import { useEffect, useState } from 'react';
import { MEGAPOLIS, RULESET } from '@pb/content';
import { actingSeats, currentSeat as coreCurrentSeat } from '@pb/game-core';
import type { MatchState, PublicMatch, PublicPlayer } from '@pb/game-core';
import { serverNow, useStore } from '../state/store';

/** Server-synchronised clock that re-renders every 250 ms. */
export function useNow(active = true): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function useMatch(): PublicMatch {
  const m = useStore((s) => s.match);
  if (!m) throw new Error('no match');
  return m;
}

export function useMe(): PublicPlayer | null {
  const seat = useStore((s) => s.seat);
  const m = useStore((s) => s.match);
  return m?.players.find((p) => p.seat === seat) ?? null;
}

export function currentSeat(m: PublicMatch): string {
  return coreCurrentSeat(m as unknown as MatchState);
}

export function acting(m: PublicMatch): string[] {
  return actingSeats(m as unknown as MatchState);
}

export function isMyTurn(m: PublicMatch, seat: string | null): boolean {
  return !!seat && currentSeat(m) === seat;
}

export function tileDef(i: number) {
  return MEGAPOLIS.tiles[i]!;
}

export { RULESET };
