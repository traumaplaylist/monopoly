// Native shell integration (Capacitor). No-op in a regular browser.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { get, set } from '../state/store';
import { sync } from './connection';

export function initNative(): void {
  if (!Capacitor.isNativePlatform()) return;
  // Android back: close the open panel / placement mode first; at top level just send the app to background
  // (never silently leave the match).
  void App.addListener('backButton', () => {
    const s = get();
    if (s.placing) set({ placing: null });
    else if (s.sheet) set({ sheet: null, selectedTile: null });
    else void App.minimizeApp();
  });
  // Back from background: drop stale animations and fetch the authoritative snapshot.
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      set({ moves: [] });
      void sync();
    }
  });
}
