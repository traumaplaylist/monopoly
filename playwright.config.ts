import { defineConfig } from '@playwright/test';

// E2E runs its own game server (dev mode, temp DB) and a Vite client pointed at it.
const SERVER_PORT = 3101;
const CLIENT_PORT = 5174;
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 10 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    launchOptions: { executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    {
      command: `node --disable-warning=ExperimentalWarning --import tsx apps/server/src/main.ts`,
      url: `http://localhost:${SERVER_PORT}/health`,
      env: { PORT: String(SERVER_PORT), PB_DEV: '1', DB_PATH: `test-results/e2e-${Date.now()}.sqlite` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --config apps/client/vite.config.ts apps/client --port ${CLIENT_PORT} --strictPort`,
      url: `http://localhost:${CLIENT_PORT}`,
      env: { VITE_SERVER_URL: `http://localhost:${SERVER_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
