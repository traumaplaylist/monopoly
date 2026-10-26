import '@fontsource/rubik/cyrillic-500.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './game/store';
import { loadManifest } from './render/assets';
import { App } from './ui/App';
import './ui/styles.css';

// Отладочный доступ к состоянию (используется смоук-тестом).
(window as unknown as { __orbital: unknown }).__orbital = { getState: () => useGame.getState().state, store: useGame };

// Ждём шрифт (надписи клеток рисуются на canvas) и манифест графики, но не дольше 2 секунд.
const fontsReady = Promise.all(['500 16px Rubik', '700 16px Rubik', '800 16px Rubik'].map((f) => document.fonts.load(f, 'АБВ')));
const timeout = new Promise((r) => setTimeout(r, 2000));
void Promise.race([Promise.all([fontsReady, loadManifest()]), timeout]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
