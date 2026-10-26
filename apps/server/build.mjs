// Bundles the server (with workspace packages) into a single ESM file.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  external: ['node:*'],
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'bundle-workspace',
      setup(b) {
        // Workspace packages are TypeScript sources: inline them, keep npm deps external.
        b.onResolve({ filter: /^@pb\// }, async (args) => {
          const r = await b.resolve(args.path, { resolveDir: args.resolveDir, kind: args.kind, pluginData: { skip: true } });
          return { path: r.path, external: false };
        });
      },
    },
  ],
});
