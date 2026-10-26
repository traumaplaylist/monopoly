// Сохранение в localStorage: работает и в браузере, и в WebView (Capacitor).
import type { GameState, PlayerId } from '../engine';

const KEY = 'orbital-capital:save:v2';

export interface SaveData {
  state: GameState;
  localPlayerId: PlayerId;
  botDelay: number;
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Хранилище недоступно (приватный режим) — игра продолжается без сохранения.
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data?.state?.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
}
