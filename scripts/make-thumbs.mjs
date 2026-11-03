// Saves wardrobe item thumbnails from the dev ThumbStudio page (needs `npm run dev` client on :5173
// or pass the URL). Usage: node scripts/make-thumbs.mjs [http://localhost:5173]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try {
  pw = req('playwright');
} catch {
  pw = createRequire('/opt/node-tools/node_modules/')('playwright');
}
const base = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'apps/client/public/models/characters/thumbs';
const src = fs.readFileSync('packages/content/src/characterCatalog.ts', 'utf8');
const ids = [...src.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
fs.mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
await page.goto(`${base}/?thumbs=1`);
await page.waitForSelector('[data-testid=thumb-studio] canvas');
for (const id of ids) {
  for (const slot of ['head', 'body', 'legs', 'feet']) {
    await page.evaluate(([i, s]) => window.__thumbJob(i, s), [id, slot]);
    await page.waitForTimeout(900);
    const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`${OUT}/${id}-${slot}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('thumbs', id);
}
await browser.close();
