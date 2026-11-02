// Visual direction V2 «солнечный стол»: every board surface is drawn on canvas (crisp Cyrillic,
// no image downloads). Tiles are bright rounded «cards» with a gradient, a translucent pattern and
// bold condensed type; special tiles are cream cards with a coloured badge. PNG icons from
// assets.json replace the emoji placeholders.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { GROUPS, WORLD } from '@pb/content';
import type { TileDef } from '@pb/content';

export const UI_FONT = 'Rubik, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const DISPLAY_FONT = 'Oswald, "Arial Narrow", "Roboto Condensed", sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const VISUAL_ICONS: Record<string, string> = {
  flag: '🏁', cup: '☕', question: '?', bread: '🥐', receipt: '🧾', gamepad: '🎮', film: '🎬', gavel: '🔨',
  bed: '🛏️', disco: '🪩', palette: '🎨', stall: '🏪', cross: '➕', basket: '🛒', coffee: '☕', columns: '🏛️',
  swords: '⚔️', frame: '🖼️', masks: '🎭', tree: '🌳', book: '📚', car: '🚗', cap: '🎓', anchor: '⚓',
  train: '🚆', note: '🎵', tower: '🏙️',
  pyramid: '🔺', fish: '🐟', plane: '✈️', palm: '🌴', landmark: '🏛️', sun: '☀️', guitar: '🎸', umbrella: '⛱️',
  ship: '🚢', moon: '🌙', citrus: '🍊', music: '🎵', ferris: '🎡', pizza: '🍕', shirt: '👔', sailboat: '⛵',
  wine: '🍷', utensils: '🍣', sakura: '🌸',
};

export const PALETTE = {
  paper: '#fbf3e4',
  paperEdge: '#eadcc2',
  ink: '#3b2a1f',
  coin: '#ffc21a',
  chance: '#ff7a2f',
  tax: '#e8434f',
  minigame: '#2f7ff0',
  duel: '#e8434f',
  corner: { start: '#20b26b', auction: '#ff7a1a', pause: '#7c5cff', parking: '#1ea0e6' } as Record<string, string>,
};

type Pattern = 'stars' | 'rays' | 'circles' | 'dots' | 'waves' | 'diamonds' | 'confetti' | 'stripes';

/** Pixels per world unit for tile cards. */
const PX = 260;

export function specialColor(t: TileDef): string | null {
  if (t.group) return GROUPS[t.group].color;
  if (t.kind === 'chance') return PALETTE.chance;
  if (t.kind === 'tax') return PALETTE.tax;
  if (t.kind === 'minigame') return PALETTE.minigame;
  if (t.kind === 'duel') return PALETTE.duel;
  return PALETTE.corner[t.kind] ?? null;
}

// ------------------------------------------------------------------ helpers

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix colour with white (k>0) or black (k<0). */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = k >= 0 ? 255 : 0;
  const a = Math.abs(k);
  const f = (c: number) => Math.round(c + (t - c) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function rng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvas(W: number, H: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(W));
  c.height = Math.max(2, Math.round(H));
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat = false): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, base: number, weight: number, family: string): number {
  let size = base;
  for (; size > base * 0.4; size *= 0.95) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPattern(ctx: CanvasRenderingContext2D, kind: Pattern, W: number, H: number, seed: number, color = 'rgba(255,255,255,0.2)') {
  const rnd = rng(seed);
  const S = Math.min(W, H);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (kind) {
    case 'rays': {
      const cx = W * (0.2 + rnd() * 0.6);
      const cy = H * 0.15;
      const n = 14;
      for (let i = 0; i < n; i += 1) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = a0 + Math.PI / n;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * S * 3, cy + Math.sin(a0) * S * 3);
        ctx.lineTo(cx + Math.cos(a1) * S * 3, cy + Math.sin(a1) * S * 3);
        ctx.closePath();
        ctx.globalAlpha = 0.55;
        ctx.fill();
      }
      break;
    }
    case 'stars':
      for (let i = 0; i < 9; i++) star(ctx, rnd() * W, rnd() * H, S * (0.05 + rnd() * 0.09));
      break;
    case 'circles':
      ctx.lineWidth = S * 0.035;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(W * 0.85, H * 0.12, S * (0.18 + i * 0.16), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'dots': {
      const step = S * 0.16;
      for (let y = step / 2; y < H; y += step)
        for (let x = ((y / step) % 2) * (step / 2); x < W; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case 'waves':
      ctx.lineWidth = S * 0.03;
      for (let y = H * 0.1; y < H; y += S * 0.16) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) ctx.lineTo(x, y + Math.sin(x / (S * 0.08)) * S * 0.03);
        ctx.stroke();
      }
      break;
    case 'diamonds':
      for (let i = 0; i < 10; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const r = S * (0.04 + rnd() * 0.07);
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.7, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'confetti':
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.translate(rnd() * W, rnd() * H);
        ctx.rotate(rnd() * Math.PI);
        ctx.fillRect(-S * 0.05, -S * 0.015, S * 0.1, S * 0.03);
        ctx.restore();
      }
      break;
    case 'stripes':
      ctx.lineWidth = S * 0.05;
      for (let x = -H; x < W; x += S * 0.16) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

/** Soft «printed card» gradient: lighter top-left, deeper bottom-right. */
function cardBackground(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, shade(color, 0.1));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Glossy highlight band.
  const hl = ctx.createRadialGradient(W * 0.25, H * 0.1, 0, W * 0.25, H * 0.1, Math.max(W, H) * 0.7);
  hl.addColorStop(0, 'rgba(255,255,255,0.12)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, W, H);
}



function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, base: number, color: string, shadow: boolean) {
  ctx.save();
  fit(ctx, text, maxW, base, 700, DISPLAY_FONT);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = base * 0.12;
    ctx.shadowOffsetY = base * 0.06;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}


// ------------------------------------------------------------------ tiles

/** Light corner cards with dark ink (reference: white «Старт», beige «Аукцион», lilac «Пауза»). */
// Variant 1 of the user's reference (02.11): pastel property cards with a group band and coloured
// icons, bright special cards with white icons, tinted corners.
export const CORNER_STYLE: Record<string, { bg: string; ink: string }> = {
  start: { bg: '#cfe0ff', ink: '#1f2350' },
  auction: { bg: '#ff9a3c', ink: '#4a1f0a' },
  parking: { bg: '#e3e6ee', ink: '#1f2350' },
  pause: { bg: '#b79cf2', ink: '#1f2350' },
};

const INK = '#1f2350';

/** Icon colour for a tile: coloured on pastel property cards, white on bright specials. */
export function iconColor(t: TileDef): string {
  if (CORNER_STYLE[t.kind]) return CORNER_STYLE[t.kind]!.ink;
  if (t.group) return shade(GROUPS[t.group].color, t.group === 'turkey' ? -0.25 : -0.05);
  return '#ffffff';
}

/** Pastel card face of a property. */
function pastel(color: string): string {
  return shade(color, 0.78);
}

/** Colour of the card's edge/thickness. */
export function cardEdgeColor(t: TileDef): string {
  const corner = CORNER_STYLE[t.kind];
  if (corner) return shade(corner.bg, -0.22);
  if (t.group) return shade(GROUPS[t.group].color, 0.35);
  return shade(specialColor(t) ?? '#cccccc', -0.3);
}

/** Big soft diagonal light bands — the «printed glossy card» sheen of the reference. */
function sheen(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, alpha = 0.09) {
  const rnd = rng(seed);
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < 3; i++) {
    const x = (rnd() * 1.4 - 0.2) * W;
    const w = (0.12 + rnd() * 0.25) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w - H * 0.7, H);
    ctx.lineTo(x - H * 0.7, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, t: TileDef, cx: number, cy: number, size: number, img: HTMLImageElement | null, color: string) {
  ctx.save();
  ctx.shadowColor = color === '#ffffff' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.03;
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const e = VISUAL_ICONS[t.visual] ?? '?';
    ctx.font = e === '?' ? `700 ${size * 1.05}px ${DISPLAY_FONT}` : `${size * 0.8}px ${EMOJI_FONT}`;
    ctx.fillText(e, cx, cy + size * 0.04);
  }
  ctx.restore();
}

function priceTag(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, value: string, ink: string) {
  ctx.save();
  ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
  const tw = ctx.measureText(value).width;
  const r = size * 0.36;
  const gap = size * 0.18;
  const x0 = cx - (r * 2 + gap + tw) / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.05;
  const cg = ctx.createRadialGradient(x0 + r * 0.7, cy - r * 0.3, 0, x0 + r, cy, r);
  cg.addColorStop(0, '#fff1a8');
  cg.addColorStop(1, '#f2a900');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(x0 + r, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x0 + r * 2 + gap, cy + size * 0.04);
  ctx.restore();
}

/** Card face texture; w/d are the card's world size. `img` is the icon (artist PNG or Lucide SVG). */
export function createTileTexture(index: number, w: number, d: number, corner: boolean, img: HTMLImageElement | null): CanvasTexture {
  const t = WORLD.tiles[index]!;
  const W = Math.round(w * PX);
  const H = Math.round(d * PX);
  const [c, ctx] = canvas(W, H);
  const name = t.shortLabel.toUpperCase();
  const S = Math.min(W, H);

  if (corner) {
    const st = CORNER_STYLE[t.kind]!;
    const g = ctx.createLinearGradient(0, 0, W * 0.5, H);
    g.addColorStop(0, shade(st.bg, 0.25));
    g.addColorStop(1, st.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    sheen(ctx, W, H, index + 5, 0.35);
    drawIcon(ctx, t, W / 2, H * 0.37, S * 0.52, img, st.ink);
    label(ctx, name, W / 2, H * 0.79, W * 0.86, S * 0.24, st.ink, false);
    return finish(c);
  }

  const color = specialColor(t)!;
  const property = t.kind === 'property';
  const price = t.price ? String(t.price) : '';
  let ink = '#ffffff';
  if (property) {
    // Pastel face, group band along the top edge (set membership at a glance).
    const face = pastel(color);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(color, 0.86));
    g.addColorStop(1, face);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, Math.max(6, S * 0.1));
    sheen(ctx, W, H, index * 7 + 1, 0.3);
    ink = INK;
  } else {
    cardBackground(ctx, W, H, color);
    sheen(ctx, W, H, index * 7 + 1);
  }
  const dark = property;
  if (H >= W * 0.9) {
    drawIcon(ctx, t, W / 2, H * (price ? 0.34 : 0.4), S * (price ? 0.5 : 0.58), img, ink);
    label(ctx, name, W / 2, H * (price ? 0.68 : 0.8), W * 0.92, S * 0.2, ink, !dark);
    if (price) priceTag(ctx, W / 2, H * 0.87, S * 0.17, price, ink);
  } else {
    const iconS = H * 0.78;
    drawIcon(ctx, t, H * 0.55, H * 0.54, iconS, img, ink);
    const tx = H * 1.0;
    const cw = W - tx - H * 0.1;
    label(ctx, name, tx + cw / 2, H * (price ? 0.36 : 0.5), cw, H * 0.3, ink, !dark);
    if (price) priceTag(ctx, tx + cw / 2, H * 0.72, H * 0.24, price, ink);
  }
  return finish(c);
}

// ------------------------------------------------------------------ board & table


/** Board centre: pale city map. */
export function createPaperTexture(w: number, h: number, title: string): CanvasTexture {
  // Variant 1: calm pale city map — blocks, streets and a river — inside the tile ring.
  void title;
  const P = 110;
  const W = Math.round(w * P);
  const H = Math.round(h * P);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#f4ecdc';
  ctx.fillRect(0, 0, W, H);
  const rnd = rng(23);
  // City blocks on a slightly irregular grid.
  const step = P * 0.9;
  for (let y = -step / 2; y < H; y += step) {
    for (let x = -step / 2; x < W; x += step) {
      const jx = (rnd() - 0.5) * step * 0.2;
      const jy = (rnd() - 0.5) * step * 0.2;
      ctx.fillStyle = rnd() > 0.82 ? 'rgba(170,205,150,0.45)' : `rgba(230,214,188,${0.45 + rnd() * 0.3})`;
      rr(ctx, x + jx + step * 0.12, y + jy + step * 0.12, step * (0.55 + rnd() * 0.2), step * (0.55 + rnd() * 0.2), step * 0.08);
      ctx.fill();
    }
  }
  // Main avenues.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.lineWidth = P * (0.14 + rnd() * 0.08);
    ctx.beginPath();
    const y0 = rnd() * H;
    ctx.moveTo(-20, y0);
    ctx.lineTo(W + 20, y0 + (rnd() - 0.5) * H * 0.5);
    ctx.stroke();
    const x0 = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x0, -20);
    ctx.lineTo(x0 + (rnd() - 0.5) * W * 0.4, H + 20);
    ctx.stroke();
  }
  // River.
  ctx.strokeStyle = 'rgba(150,195,235,0.7)';
  ctx.lineWidth = P * 0.32;
  ctx.beginPath();
  ctx.moveTo(-30, H * 0.78);
  ctx.bezierCurveTo(W * 0.3, H * 0.62, W * 0.55, H * 0.98, W + 30, H * 0.7);
  ctx.stroke();
  // Paper fibres.
  for (let k = 0; k < W * H * 0.002; k++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(160,120,70,0.05)' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
  }
  return finish(c);
}


// ------------------------------------------------------------------ decks, money, cards

export function createDeckTexture(kind: 'chance' | 'minigame', w: number, d: number, icon: HTMLImageElement | null = null): CanvasTexture {
  const W = Math.round(w * PX);
  const H = Math.round(d * PX);
  const [c, ctx] = canvas(W, H);
  const color = kind === 'chance' ? PALETTE.chance : PALETTE.minigame;
  cardBackground(ctx, W, H, color);
  drawPattern(ctx, kind === 'chance' ? 'stars' : 'confetti', W, H, kind === 'chance' ? 4 : 9);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = H * 0.025;
  rr(ctx, H * 0.07, H * 0.07, W - H * 0.14, H - H * 0.14, H * 0.08);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = H * 0.03;
  ctx.shadowOffsetY = H * 0.015;
  ctx.fillStyle = '#fff';
  if (kind === 'chance' || !icon) {
    ctx.font = `700 ${H * 0.48}px ${DISPLAY_FONT}`;
    ctx.fillText('?', W / 2, H * 0.4);
  } else {
    ctx.drawImage(icon, W / 2 - H * 0.24, H * 0.16, H * 0.48, H * 0.48);
  }
  ctx.restore();
  label(ctx, kind === 'chance' ? 'ШАНС' : 'МИНИ-ИГРЫ', W / 2, H * 0.78, W * 0.8, H * 0.17, '#fff', true);
  return finish(c);
}



