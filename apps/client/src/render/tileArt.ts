// Top faces of tile blocks, drawn on canvas (crisp Cyrillic, no font downloads).
// Icons are emoji placeholders keyed by the tile's visual key; PNG icons from assets.json replace them.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { GROUPS, MEGAPOLIS } from '@pb/content';
import type { TileDef } from '@pb/content';
import { STRIP, tileRect } from './layout';
import type { Profile } from './layout';

export const UI_FONT = 'Rubik, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const VISUAL_ICONS: Record<string, string> = {
  flag: '🏁', cup: '☕', question: '?', bread: '🥐', receipt: '🧾', gamepad: '🎮', film: '🎬', gavel: '🔨',
  bed: '🛏️', disco: '🪩', palette: '🎨', stall: '🏪', cross: '➕', basket: '🛒', coffee: '☕', columns: '🏛️',
  swords: '⚔️', frame: '🖼️', masks: '🎭', tree: '🌳', book: '📚', car: '🚗', cap: '🎓', anchor: '⚓',
  train: '🚆', note: '🎵', tower: '🏙️',
};

export const PALETTE = {
  paper: '#f4ead6',
  paperShade: '#d9c6a2',
  ink: '#2b2236',
  coin: '#f4b81c',
  chance: '#e8743a',
  tax: '#d6474c',
  minigame: '#3a6fc4',
  duel: '#d6474c',
  corner: { start: '#dccff3', auction: '#f0a36d', pause: '#b49be8', parking: '#b8c2d0' } as Record<string, string>,
};

const PX = 170;

export function specialColor(t: TileDef): string | null {
  if (t.group) return GROUPS[t.group].color;
  if (t.kind === 'chance') return PALETTE.chance;
  if (t.kind === 'tax') return PALETTE.tax;
  if (t.kind === 'minigame') return PALETTE.minigame;
  if (t.kind === 'duel') return PALETTE.duel;
  return null;
}

export function sideColor(t: TileDef): string {
  return PALETTE.corner[t.kind] ?? PALETTE.paperShade;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, base: number, weight = 700): number {
  let size = base;
  for (; size > base * 0.5; size *= 0.94) {
    ctx.font = `${weight} ${size}px ${UI_FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${size}px ${UI_FONT}`;
  return size;
}

function coinPrice(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, value: string): void {
  ctx.font = `700 ${size}px ${UI_FONT}`;
  const tw = ctx.measureText(value).width;
  const r = size * 0.42;
  const x0 = cx - (r * 2 + size * 0.22 + tw) / 2;
  ctx.fillStyle = PALETTE.coin;
  ctx.beginPath();
  ctx.arc(x0 + r, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a06e00';
  ctx.lineWidth = size * 0.09;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x0 + r * 2 + size * 0.22, cy + size * 0.04);
}

function icon(ctx: CanvasRenderingContext2D, t: TileDef, cx: number, cy: number, size: number, img: HTMLImageElement | null, light: boolean): void {
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    return;
  }
  const e = VISUAL_ICONS[t.visual] ?? '•';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (e === '?') {
    ctx.fillStyle = light ? '#fff' : PALETTE.ink;
    ctx.font = `900 ${size * 1.1}px ${UI_FONT}`;
  } else {
    ctx.font = `${size * 0.82}px ${EMOJI_FONT}`;
  }
  ctx.fillText(e, cx, cy + size * 0.06);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function createTileTexture(index: number, p: Profile, img: HTMLImageElement | null): CanvasTexture {
  const t = MEGAPOLIS.tiles[index]!;
  const r = tileRect(index, p);
  const W = Math.round(r.w * PX);
  const H = Math.round(r.d * PX);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const pad = PX * 0.07;
  const label = t.shortLabel.toUpperCase();
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);

  if (r.corner) {
    ctx.fillStyle = PALETTE.corner[t.kind]!;
    rr(ctx, pad, pad, W - pad * 2, H - pad * 2, PX * 0.12);
    ctx.fill();
    icon(ctx, t, W / 2, H * 0.38, Math.min(W, H) * 0.42, img, false);
    ctx.fillStyle = PALETTE.ink;
    fit(ctx, label, W - pad * 4, PX * 0.27, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H * 0.76);
    return finish(c);
  }

  const color = specialColor(t);
  const special = t.kind !== 'property';
  const strip = STRIP * PX;
  // Group colour strip at the outer edge (where upgrades stand).
  if (color && !special) {
    ctx.fillStyle = color;
    if (r.side === 0) ctx.fillRect(0, 0, W, strip);
    if (r.side === 2) ctx.fillRect(0, H - strip, W, strip);
    if (r.side === 1) ctx.fillRect(W - strip, 0, strip, H);
    if (r.side === 3) ctx.fillRect(0, 0, strip, H);
  }
  const box = { x: 0, y: 0, w: W, h: H };
  if (!special) {
    if (r.side === 0) box.y = strip;
    if (r.side === 0 || r.side === 2) box.h = H - strip;
    if (r.side === 3) box.x = strip;
    if (r.side === 1 || r.side === 3) box.w = W - strip;
  }
  if (special && color) {
    // Special tiles: coloured plate with a light icon, as on the concept.
    ctx.fillStyle = color;
    rr(ctx, pad, pad, W - pad * 2, H - pad * 2, PX * 0.08);
    ctx.fill();
  }
  const ink = special ? '#ffffff' : PALETTE.ink;
  const price = t.price ? String(t.price) : '';
  const portraitTile = box.h >= box.w * 0.95;
  if (portraitTile) {
    icon(ctx, t, box.x + box.w / 2, box.y + box.h * 0.32, Math.min(box.w, box.h) * 0.42, img, special);
    ctx.fillStyle = ink;
    const size = fit(ctx, label, box.w - pad * 1.5, PX * 0.19);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, box.x + box.w / 2, box.y + box.h * (price ? 0.64 : 0.74));
    if (price) coinPrice(ctx, box.x + box.w / 2, box.y + box.h * 0.85, Math.min(size * 1.05, PX * 0.19), price);
  } else {
    const iconSize = box.h * 0.62;
    icon(ctx, t, box.x + pad + iconSize * 0.6, box.y + box.h / 2, iconSize, img, special);
    const tx = box.x + pad * 1.5 + iconSize * 1.15;
    const maxW = box.x + box.w - tx - pad;
    ctx.fillStyle = ink;
    const size = fit(ctx, label, maxW, PX * 0.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tx + maxW / 2, box.y + box.h * (price ? 0.36 : 0.5));
    if (price) coinPrice(ctx, tx + maxW / 2, box.y + box.h * 0.72, Math.min(size, PX * 0.19), price);
  }
  return finish(c);
}

function finish(c: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createDeckTexture(kind: 'chance' | 'minigame', w: number, d: number): CanvasTexture {
  const W = Math.round(w * PX);
  const H = Math.round(d * PX);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = kind === 'chance' ? PALETTE.chance : PALETTE.minigame;
  rr(ctx, PX * 0.1, PX * 0.1, W - PX * 0.2, H - PX * 0.2, PX * 0.1);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'chance') {
    ctx.font = `900 ${H * 0.42}px ${UI_FONT}`;
    ctx.fillText('?', W / 2, H * 0.4);
  } else {
    ctx.font = `${H * 0.34}px ${EMOJI_FONT}`;
    ctx.fillText('🎮', W / 2, H * 0.4);
  }
  ctx.font = `800 ${H * 0.15}px ${UI_FONT}`;
  ctx.fillText(kind === 'chance' ? 'ШАНС' : 'МИНИ-ИГРЫ', W / 2, H * 0.77);
  return finish(c);
}

/** Calm city-map pattern for the board centre. */
export function createCenterTexture(w: number, h: number): CanvasTexture {
  const W = Math.round(w * 80);
  const H = Math.round(h * 80);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2f6b6a';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 10;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    const y = rnd() * H;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + (rnd() - 0.5) * H * 0.3);
    ctx.stroke();
    const x = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * W * 0.3, H);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let k = 0; k < 40; k++) ctx.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 40, 20 + rnd() * 40);
  return finish(c);
}
