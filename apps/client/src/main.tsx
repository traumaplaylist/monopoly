import '@fontsource/rubik/cyrillic-500.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { api, connect, debugDropConnection, send } from './net/connection';
import { loadManifest } from './render/assets';
import { useStore } from './state/store';
import { App } from './ui/App';
import { unlockAudio } from './ui/sound';
import './ui/styles.css';

// Handle for automated browser checks: state reading and the same API the UI uses (no extra rights).
(window as unknown as { __pb: unknown }).__pb = { state: () => useStore.getState(), api, send, drop: debugDropConnection };

window.addEventListener('pointerdown', unlockAudio, { once: true });
connect();

// Canvas tile labels need the font; wait for it (max 2 s).
const fonts = Promise.all(['500 16px Rubik', '700 16px Rubik', '800 16px Rubik'].map((f) => document.fonts.load(f, 'АБВ')));
void Promise.race([Promise.all([fonts, loadManifest()]), new Promise((r) => setTimeout(r, 2000))]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
