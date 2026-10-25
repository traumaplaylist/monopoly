import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, чтобы сборка открывалась из WebView (Capacitor) и с file://.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
