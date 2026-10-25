// Клиент партии. Сейчас — локальный (движок в браузере). Для онлайна достаточно
// реализовать тот же интерфейс поверх сокета (Colyseus): UI и боты не изменятся.
import { applyAction } from '../engine';
import type { Action, GameEvent, GameState } from '../engine';

export type DispatchResult = { ok: true } | { ok: false; error: string };
export type Listener = (state: GameState, events: GameEvent[]) => void;

export interface GameClient {
  getState(): GameState;
  dispatch(action: Action): DispatchResult;
  subscribe(listener: Listener): () => void;
}

export class LocalGameClient implements GameClient {
  private listeners = new Set<Listener>();

  constructor(private state: GameState) {}

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): DispatchResult {
    const r = applyAction(this.state, action);
    if (!r.ok) return r;
    this.state = r.state;
    for (const l of this.listeners) l(r.state, r.events);
    return { ok: true };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
