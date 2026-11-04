import '@fontsource/rubik/cyrillic-500.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/oswald/cyrillic-700.css';
import '@fontsource/oswald/latin-700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { api, connect, debugDropConnection, send } from './net/connection';
import { initNative } from './net/native';
import { loadManifest } from './render/assets';
import { useStore } from './state/store';
import { App } from './ui/App';
import { unlockAudio } from './ui/sound';
import './ui/styles.css';
import './ui/sfxEvents';

// Handle for automated browser checks: state reading and the same API the UI uses (no extra rights).
(window as unknown as { __pb: unknown }).__pb = { state: () => useStore.getState(), api, send, drop: debugDropConnection };

window.addEventListener('pointerdown', unlockAudio, { once: true });
connect();
initNative();

// Canvas tile labels need the font; wait for it (max 2 s).
const fonts = Promise.all(['500 16px Rubik', '700 16px Rubik', '800 16px Rubik', '700 16px Oswald'].map((f) => document.fonts.load(f, 'АБВ')));
void Promise.race([Promise.all([fonts, loadManifest()]), new Promise((r) => setTimeout(r, 2000))]).finally(() => {
  const root = createRoot(document.getElementById('root')!);
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('thumbs')) {
    // Dev-only thumbnail studio for the wardrobe (scripts/make-thumbs.mjs).
    void import('./ui/ThumbStudio').then(({ ThumbStudio }) => root.render(<ThumbStudio />));
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
