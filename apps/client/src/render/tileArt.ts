// Оформление клеток: иконки, цвета и рисование верхней грани блока на canvas.
// Иконки-эмодзи — временные; картинки из public/assets.json (icons) их заменяют.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { GROUPS, tile } from '../engine';
import type { TileDef } from '../engine';
import { STRIP, tileRect } from './layout';

export const UI_FONT = 'Rubik, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const TILE_ICONS: Record<number, string> = {
  0: '🚀',
  1: '🌑',
  2: '✦',
  3: '⛰️',
  4: '💨',
  5: '🗼',
  6: '🧊',
  7: '?',
  8: '❄️',
  9: '🌌',
  10: '☣️',
  11: '🏜️',
  12: '☀️',
  13: '🏔️',
  14: '🏛️',
  15: '🛸',
  16: '⛏️',
  17: '✦',
  18: '☄️',
  19: '🏰',
  20: '☕',
  21: '☁️',
  22: '?',
  23: '⚓',
  24: '🎡',
  25: '🛰️',
  26: '🌊',
  27: '🌋',
  28: '💧',
  29: '🏙️',
  30: '🚨',
  31: '🪐',
  32: '🏗️',
  33: '✦',
  34: '🌿',
  35: '🌀',
  36: '?',
  37: '🏨',
  38: '💸',
  39: '👑',
};

export const PALETTE = {
  paper: '#f6ecd8',
  paperShade: '#d8c39e',
  ink: '#2b2236',
  muted: '#7a6a5a',
  coin: '#f4b81c',
  signal: '#ef7a3b',
  council: '#3a72c2',
  tax: '#d9474b',
  corner: { 0: '#d9c9f2', 10: '#f2a679', 20: '#b49be8', 30: '#a7b6cc' } as Record<number, string>,
};

const PX = 180; // пикселей на единицу мира

/** Цвет «бумаги» клетки (для боковых граней блока). */
export function tileBaseColor(t: TileDef): string {
  if (t.index in PALETTE.corner) return PALETTE.corner[t.index]!;
  if (t.kind === 'card') return t.deck === 'signal' ? PALETTE.signal : PALETTE.council;
  return PALETTE.paperShade;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, base: number, weight = 700) {
  for (let size = base; size > base * 0.45; size *= 0.94) {
    ctx.font = `${weight} ${size}px ${UI_FONT}`;
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size };
  }
  ctx.font = `${weight} ${base * 0.45}px ${UI_FONT}`;
  return { lines: [text], size: base * 0.45 };
}

function drawCoinPrice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  value: string,
  align: 'center' | 'left',
) {
  ctx.font = `700 ${size}px ${UI_FONT}`;
  const tw = ctx.measureText(value).width;
  const r = size * 0.42;
  const total = r * 2 + size * 0.25 + tw;
  const x0 = align === 'center' ? x - total / 2 : x;
  ctx.fillStyle = PALETTE.coin;
  ctx.beginPath();
  ctx.arc(x0 + r, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b07a00';
  ctx.lineWidth = size * 0.08;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x0 + r * 2 + size * 0.25, y + size * 0.04);
}

function drawIcon(ctx: CanvasRenderingContext2D, t: TileDef, cx: number, cy: number, size: number, img: HTMLImageElement | null) {
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    return;
  }
  const icon = TILE_ICONS[t.index] ?? '';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (icon === '?' || icon === '✦') {
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${size * 1.05}px ${UI_FONT}`;
    ctx.fillText(icon, cx, cy + size * 0.05);
    return;
  }
  ctx.font = `${size * 0.85}px ${EMOJI_FONT}`;
  ctx.fillText(icon, cx, cy + size * 0.05);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Текстура верхней грани клетки. Надписи всегда «к зрителю». */
export function createTileTexture(index: number, img: HTMLImageElement | null): CanvasTexture {
  const t = tile(index);
  const r = tileRect(index);
  const W = Math.round(r.w * PX);
  const H = Math.round(r.d * PX);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const pad = PX * 0.08;
  const isCard = t.kind === 'card';
  const label = t.name.toUpperCase();

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);

  if (r.corner) {
    ctx.fillStyle = PALETTE.corner[index]!;
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, PX * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,54,0.25)';
    ctx.lineWidth = PX * 0.03;
    ctx.stroke();
    drawIcon(ctx, t, W / 2, H * 0.38, PX * 0.62, img);
    ctx.fillStyle = PALETTE.ink;
    const f = fit(ctx, label, W - pad * 4, 1, PX * 0.26, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.lines[0]!, W / 2, H * 0.75);
    return finish(c);
  }

  // Полоса группы / цвет спецклетки — у внешнего края.
  const stripPx = STRIP * PX;
  const stripColor = t.group
    ? GROUPS[t.group].color
    : isCard
      ? t.deck === 'signal'
        ? PALETTE.signal
        : PALETTE.council
      : t.kind === 'tax'
        ? PALETTE.tax
        : null;
  const horizontal = r.side === 0 || r.side === 2;
  if (stripColor) {
    ctx.fillStyle = stripColor;
    if (r.side === 0) ctx.fillRect(0, 0, W, stripPx);
    if (r.side === 2) ctx.fillRect(0, H - stripPx, W, stripPx);
    if (r.side === 1) ctx.fillRect(W - stripPx, 0, stripPx, H);
    if (r.side === 3) ctx.fillRect(0, 0, stripPx, H);
  }
  // Карточки и налоги — крупная цветная плашка под иконкой, как на макете.
  const iconBg = isCard || t.kind === 'tax' ? stripColor : null;

  const price = t.price ? String(t.price) : t.tax ? `−${t.tax}` : '';
  ctx.fillStyle = PALETTE.ink;

  if (horizontal) {
    const top = r.side === 0 ? stripPx : 0;
    const bottom = r.side === 2 ? H - stripPx : H;
    const h = bottom - top;
    const iconSize = PX * 0.42;
    const iconY = top + h * 0.26;
    if (iconBg) {
      ctx.fillStyle = iconBg;
      roundRect(ctx, pad, top + pad * 0.6, W - pad * 2, h * 0.5, PX * 0.08);
      ctx.fill();
    }
    drawIcon(ctx, t, W / 2, iconY, iconSize, img);
    ctx.fillStyle = PALETTE.ink;
    const f = fit(ctx, label, W - pad * 1.2, 2, PX * 0.19, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nameY = top + h * (price ? 0.62 : 0.72);
    f.lines.forEach((ln, k) => ctx.fillText(ln, W / 2, nameY + (k - (f.lines.length - 1) / 2) * f.size * 1.1));
    if (price) drawCoinPrice(ctx, W / 2, top + h * 0.87, PX * 0.19, price, 'center');
  } else {
    const left = r.side === 3 ? stripPx : 0;
    const right = r.side === 1 ? W - stripPx : W;
    const iconBox = (H - pad * 2) * 0.9;
    if (iconBg) {
      ctx.fillStyle = iconBg;
      roundRect(ctx, left + pad * 0.6, pad, iconBox * 1.25, iconBox, PX * 0.08);
      ctx.fill();
    }
    drawIcon(ctx, t, left + pad * 0.6 + iconBox * 0.62, H / 2, iconBox * 0.78, img);
    const textX = left + pad * 0.6 + iconBox * 1.3;
    const maxW = right - textX - pad;
    ctx.fillStyle = PALETTE.ink;
    const f = fit(ctx, label, maxW, 2, PX * 0.2, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = textX + maxW / 2;
    const nameY = price ? H * 0.38 : H / 2;
    f.lines.forEach((ln, k) => ctx.fillText(ln, cx, nameY + (k - (f.lines.length - 1) / 2) * f.size * 1.1));
    if (price) drawCoinPrice(ctx, cx, H * 0.76, PX * 0.18, price, 'center');
  }
  return finish(c);
}

function finish(c: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Текстура верха колоды карточек в центре поля. */
export function createDeckTexture(deck: 'signal' | 'council'): CanvasTexture {
  const W = 2.4 * PX;
  const H = 1.6 * PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f6ecd8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = deck === 'signal' ? PALETTE.signal : PALETTE.council;
  roundRect(ctx, PX * 0.1, PX * 0.1, W - PX * 0.2, H - PX * 0.2, PX * 0.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = PX * 0.03;
  roundRect(ctx, PX * 0.18, PX * 0.18, W - PX * 0.36, H - PX * 0.36, PX * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${PX * 0.6}px ${UI_FONT}`;
  ctx.fillText(deck === 'signal' ? '?' : '✦', W / 2, H * 0.4);
  ctx.font = `800 ${PX * 0.2}px ${UI_FONT}`;
  ctx.fillText(deck === 'signal' ? 'СИГНАЛ' : 'СОВЕТ КОЛОНИИ', W / 2, H * 0.76);
  return finish(c);
}
