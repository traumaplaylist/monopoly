import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/server/tests/**/*.test.ts', 'apps/client/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
