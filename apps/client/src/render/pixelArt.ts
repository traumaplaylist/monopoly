// Procedural pixel-art characters (replaceable placeholders). Flat 2D sprites on small stands,
// as in the chosen style. Drawn once per (avatar, colour) and cached.
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

export const AVATARS = [
  { skin: '#f1c7a3', hair: '#6b3a22', style: 'long' },
  { skin: '#d9a07a', hair: '#1d1d26', style: 'short' },
  { skin: '#8d5a3c', hair: '#2b1a10', style: 'bun' },
  { skin: '#f6d2b0', hair: '#d48a2a', style: 'spiky' },
  { skin: '#c68a62', hair: '#3a2a50', style: 'cap' },
  { skin: '#e8b48f', hair: '#9b2f2f', style: 'pony' },
] as const;

export const AVATAR_NAMES = ['Рыжая', 'Тихий', 'Пончик', 'Искра', 'Кепка', 'Хвостик'];

type Px = (x: number, y: number, c: string) => void;

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

function drawHead(px: Px, a: (typeof AVATARS)[number], ox: number, oy: number): void {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px(ox + x, oy + y, a.skin);
  // Hair
  for (let x = -1; x < 9; x++) px(ox + x, oy - 1, a.hair);
  for (let x = 0; x < 8; x++) px(ox + x, oy, a.hair);
  if (a.style === 'long' || a.style === 'pony') for (let y = 0; y < 9; y++) {
    px(ox - 1, oy + y, a.hair);
    if (a.style === 'long') px(ox + 8, oy + y, a.hair);
  }
  if (a.style === 'pony') for (let y = 1; y < 7; y++) px(ox + 9, oy + y, a.hair);
  if (a.style === 'bun') for (let y = -4; y < -1; y++) for (let x = 2; x < 6; x++) px(ox + x, oy + y, a.hair);
  if (a.style === 'spiky') for (const x of [0, 2, 4, 6]) px(ox + x, oy - 2, a.hair);
  if (a.style === 'cap') {
    for (let x = -1; x < 9; x++) px(ox + x, oy, '#3466c2');
    for (let x = 0; x < 8; x++) px(ox + x, oy - 1, '#3466c2');
    for (let x = 6; x < 11; x++) px(ox + x, oy + 1, '#2a4f99');
  }
  if (a.style === 'short' || a.style === 'spiky') {
    px(ox, oy + 1, a.hair);
    px(ox + 7, oy + 1, a.hair);
  }
  // Face
  px(ox + 2, oy + 4, '#22192e');
  px(ox + 5, oy + 4, '#22192e');
  px(ox + 3, oy + 6, shade(a.skin, 0.75));
  px(ox + 4, oy + 6, shade(a.skin, 0.75));
}

function outline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  out.data.set(img.data);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img.data[(y * w + x) * 4 + 3]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (a(x, y)) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
        const i = (y * w + x) * 4;
        out.data[i] = 34;
        out.data[i + 1] = 25;
        out.data[i + 2] = 46;
        out.data[i + 3] = 255;
      }
    }
  ctx.putImageData(out, 0, 0);
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const px: Px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  return { c, ctx, px };
}

/** Full-body sprite 18×28 px. */
export function drawCharacter(avatar: number, shirt: string): HTMLCanvasElement {
  const a = AVATARS[avatar % AVATARS.length]!;
  const { c, ctx, px } = canvas(18, 28);
  const ox = 5;
  drawHead(px, a, ox, 4);
  // Body
  for (let y = 12; y < 19; y++) for (let x = 4; x < 14; x++) px(x, y, y === 12 ? shade(shirt, 1.15) : shirt);
  for (let y = 12; y < 18; y++) {
    px(3, y, shade(shirt, 0.8));
    px(14, y, shade(shirt, 0.8));
  }
  px(3, 18, a.skin);
  px(14, 18, a.skin);
  // Legs
  for (let y = 19; y < 25; y++) {
    for (const x of [5, 6, 7]) px(x, y, '#2d2a45');
    for (const x of [10, 11, 12]) px(x, y, '#2d2a45');
  }
  for (const x of [4, 5, 6, 7]) px(x, 25, '#4a3b2a');
  for (const x of [10, 11, 12, 13]) px(x, 25, '#4a3b2a');
  outline(ctx, 18, 28);
  return c;
}

export function drawGhost(): HTMLCanvasElement {
  const { c, ctx, px } = canvas(18, 20);
  const body = '#b48cff';
  for (let y = 2; y < 16; y++)
    for (let x = 3; x < 15; x++) {
      const dx = x - 8.5;
      const dy = y - 7;
      if (y < 8 && dx * dx + dy * dy > 34) continue;
      px(x, y, y < 5 ? '#cdb2ff' : body);
    }
  for (const x of [3, 4, 7, 8, 11, 12]) px(x, 16, body);
  px(6, 7, '#2b1a4a');
  px(6, 8, '#2b1a4a');
  px(11, 7, '#2b1a4a');
  px(11, 8, '#2b1a4a');
  for (let x = 7; x < 11; x++) px(x, 11, '#2b1a4a');
  outline(ctx, 18, 20);
  return c;
}

/** Portrait 20×20 px for player cards (DOM). */
export function drawPortrait(avatar: number, shirt: string, ghost = false): HTMLCanvasElement {
  if (ghost) return drawGhost();
  const a = AVATARS[avatar % AVATARS.length]!;
  const { c, ctx, px } = canvas(20, 20);
  drawHead(px, a, 6, 5);
  for (let y = 14; y < 20; y++) for (let x = 3; x < 17; x++) px(x, y, y === 14 ? shade(shirt, 1.15) : shirt);
  outline(ctx, 20, 20);
  return c;
}

const textureCache = new Map<string, CanvasTexture>();

export function spriteTexture(key: string, draw: () => HTMLCanvasElement): CanvasTexture {
  let t = textureCache.get(key);
  if (!t) {
    t = new CanvasTexture(draw());
    t.magFilter = NearestFilter;
    t.minFilter = NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = SRGBColorSpace;
    textureCache.set(key, t);
  }
  return t;
}

const urlCache = new Map<string, string>();
export function portraitUrl(avatar: number, color: string, ghost = false): string {
  const key = `${avatar}:${color}:${ghost}`;
  let u = urlCache.get(key);
  if (!u) {
    u = drawPortrait(avatar, color, ghost).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
