import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './game/store';
import { App } from './ui/App';
import './ui/styles.css';

// Отладочный доступ к состоянию (используется смоук-тестом).
(window as unknown as { __orbital: unknown }).__orbital = { getState: () => useGame.getState().state, store: useGame };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
