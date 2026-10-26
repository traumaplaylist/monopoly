import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — relative asset paths so the same build works inside Capacitor WebViews.
// host: true — reachable from a phone on the LAN during development.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1600 },
});
