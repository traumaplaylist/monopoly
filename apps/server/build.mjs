// Bundles the server and the workspace packages (@pb/*, TypeScript sources) into one ESM file.
// npm dependencies stay external and are loaded from node_modules at runtime.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['socket.io', 'zod'],
  sourcemap: true,
  logLevel: 'info',
});
