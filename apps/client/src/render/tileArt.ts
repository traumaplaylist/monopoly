// Visual direction V2 «солнечный стол»: every board surface is drawn on canvas (crisp Cyrillic,
// no image downloads). Tiles are bright rounded «cards» with a gradient, a translucent pattern and
// bold condensed type; special tiles are cream cards with a coloured badge. PNG icons from
// assets.json replace the emoji placeholders.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { GROUPS, MEGAPOLIS } from '@pb/content';
import type { TileDef } from '@pb/content';

export const UI_FONT = 'Rubik, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const DISPLAY_FONT = 'Oswald, "Arial Narrow", "Roboto Condensed", sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const VISUAL_ICONS: Record<string, string> = {
  flag: '🏁', cup: '☕', question: '?', bread: '🥐', receipt: '🧾', gamepad: '🎮', film: '🎬', gavel: '🔨',
  bed: '🛏️', disco: '🪩', palette: '🎨', stall: '🏪', cross: '➕', basket: '🛒', coffee: '☕', columns: '🏛️',
  swords: '⚔️', frame: '🖼️', masks: '🎭', tree: '🌳', book: '📚', car: '🚗', cap: '🎓', anchor: '⚓',
  train: '🚆', note: '🎵', tower: '🏙️',
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
const PX = 200;

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


function coinPrice(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, value: string, pill: boolean) {
  ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
  const tw = ctx.measureText(value).width;
  const r = size * 0.4;
  const gap = size * 0.2;
  const total = r * 2 + gap + tw;
  if (pill) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = size * 0.2;
    ctx.shadowOffsetY = size * 0.06;
    rr(ctx, cx - total / 2 - size * 0.35, cy - size * 0.62, total + size * 0.7, size * 1.24, size * 0.62);
    ctx.fill();
    ctx.restore();
  }
  const x0 = cx - total / 2;
  const cg = ctx.createRadialGradient(x0 + r * 0.7, cy - r * 0.3, 0, x0 + r, cy, r);
  cg.addColorStop(0, '#ffe68a');
  cg.addColorStop(1, '#f0a800');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(x0 + r, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x0 + r * 2 + gap, cy + size * 0.04);
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
export const CORNER_STYLE: Record<string, { bg: string; ink: string }> = {
  start: { bg: '#fbf6ec', ink: '#26284a' },
  auction: { bg: '#f2c979', ink: '#4a2f17' },
  parking: { bg: '#e2e7ef', ink: '#26284a' },
  pause: { bg: '#cbb6f6', ink: '#26284a' },
};

/** Icon colour for a tile (white on colour, dark ink on light corners). */
export function iconColor(t: TileDef): string {
  return CORNER_STYLE[t.kind]?.ink ?? '#ffffff';
}

/** Colour of the card's edge/thickness. */
export function cardEdgeColor(t: TileDef): string {
  const corner = CORNER_STYLE[t.kind];
  return corner ? shade(corner.bg, -0.22) : shade(specialColor(t) ?? '#cccccc', -0.3);
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
  ctx.shadowColor = color === '#ffffff' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)';
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
  const t = MEGAPOLIS.tiles[index]!;
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
    drawIcon(ctx, t, W / 2, H * 0.36, S * 0.42, img, st.ink);
    label(ctx, name, W / 2, H * 0.76, W * 0.86, S * 0.25, st.ink, false);
    return finish(c);
  }

  const color = specialColor(t)!;
  cardBackground(ctx, W, H, color);
  sheen(ctx, W, H, index * 7 + 1);
  const price = t.price ? String(t.price) : '';
  const dark = t.group === 'trade';
  const ink = dark ? '#5a3a00' : '#ffffff';
  if (H >= W * 0.9) {
    drawIcon(ctx, t, W / 2, H * (price ? 0.3 : 0.36), S * (price ? 0.4 : 0.46), img, ink);
    label(ctx, name, W / 2, H * (price ? 0.62 : 0.74), W * 0.9, S * 0.22, ink, !dark);
    if (price) priceTag(ctx, W / 2, H * 0.84, S * 0.19, price, ink);
  } else {
    const iconS = H * 0.62;
    drawIcon(ctx, t, H * 0.5, H / 2, iconS, img, ink);
    const tx = H * 0.9;
    const cw = W - tx - H * 0.1;
    label(ctx, name, tx + cw / 2, H * (price ? 0.36 : 0.5), cw, H * 0.3, ink, !dark);
    if (price) priceTag(ctx, tx + cw / 2, H * 0.72, H * 0.24, price, ink);
  }
  return finish(c);
}

// ------------------------------------------------------------------ board & table

/** Warm honey-coloured wooden planks (tileable). */
export function createWoodTexture(): CanvasTexture {
  const W = 1024;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  const rnd = rng(11);
  const planks = 6;
  const ph = H / planks;
  for (let p = 0; p < planks; p++) {
    const tone = 0.9 + rnd() * 0.2;
    const base = [196 * tone, 132 * tone, 78 * tone].map((v) => Math.min(255, Math.round(v)));
    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    ctx.fillRect(0, p * ph, W, ph);
    // Grain: long wavy lines.
    for (let k = 0; k < 46; k++) {
      const y0 = p * ph + rnd() * ph;
      const amp = 2 + rnd() * 6;
      const freq = 0.004 + rnd() * 0.01;
      const phase = rnd() * 10;
      ctx.strokeStyle = rnd() > 0.5 ? `rgba(120,64,24,${0.08 + rnd() * 0.12})` : `rgba(255,214,160,${0.05 + rnd() * 0.08})`;
      ctx.lineWidth = 0.6 + rnd() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3);
      ctx.stroke();
    }
    // Occasional knot.
    if (rnd() > 0.5) {
      const kx = rnd() * W;
      const ky = p * ph + ph * (0.3 + rnd() * 0.4);
      for (let r = 18; r > 2; r -= 4) {
        ctx.strokeStyle = 'rgba(110,58,22,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 2.4, r * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Plank seam.
    ctx.fillStyle = 'rgba(70,36,12,0.45)';
    ctx.fillRect(0, p * ph, W, 3);
    ctx.fillStyle = 'rgba(255,220,170,0.15)';
    ctx.fillRect(0, p * ph + 3, W, 2);
  }
  const tex = finish(c, true);
  return tex;
}

/** Cream cardboard with fine fibres and a debossed title in the centre. */
export function createPaperTexture(w: number, h: number, title: string): CanvasTexture {
  const P = 120;
  const W = Math.round(w * P);
  const H = Math.round(h * P);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);
  const rnd = rng(5);
  for (let k = 0; k < W * H * 0.004; k++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(160,120,70,0.06)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
  }
  // Soft pale-yellow stars scattered over the paper (reference: printed sunny pattern).
  const srnd = rng(17);
  ctx.fillStyle = 'rgba(255,206,100,0.4)';
  for (let k = 0; k < 26; k++) {
    ctx.save();
    ctx.translate(srnd() * W, srnd() * H);
    ctx.rotate(srnd() * Math.PI);
    star(ctx, 0, 0, Math.min(W, H) * (0.05 + srnd() * 0.08), 6);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(251,243,228,0.0)');
  vg.addColorStop(1, 'rgba(251,243,228,0.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  void title; // no centre title: the reference centre is calm (decks and dice live there)
  return finish(c);
}

/** Alpha mask of leaves and branches for the gobo shadow (alpha = leaf). */
export function createLeavesTexture(): CanvasTexture {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const rnd = rng(42);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.lineWidth = Math.max(2, depth * 3.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + (rnd() - 0.5) * 30, (y + y2) / 2 + (rnd() - 0.5) * 30, x2, y2);
    ctx.stroke();
    const leaves = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < leaves; i++) {
      const t = rnd();
      const lx = x + (x2 - x) * t;
      const ly = y + (y2 - y) * t;
      const la = a + (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.8);
      const ll = 26 + rnd() * 34;
      ctx.save();
      ctx.translate(lx + Math.cos(la) * ll * 0.6, ly + Math.sin(la) * ll * 0.6);
      ctx.rotate(la);
      ctx.beginPath();
      ctx.ellipse(0, 0, ll * 0.62, ll * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (depth > 0) {
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) branch(x2, y2, a + (rnd() - 0.5) * 1.3, len * (0.55 + rnd() * 0.2), depth - 1);
    }
  };
  branch(S * 1.02, S * 0.08, Math.PI * 0.82, 280, 3);
  branch(S * 1.02, S * 0.5, Math.PI * 0.97, 200, 2);
  const tex = new CanvasTexture(c);
  return tex;
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

export const BILLS: { value: number; color: string }[] = [
  { value: 500, color: '#8b55e6' },
  { value: 100, color: '#13b5a6' },
  { value: 50, color: '#ff8a1f' },
  { value: 20, color: '#ff4fa8' },
];

/** Rounded banknote with a big denomination. */
export function createBillTexture(value: number, color: string): CanvasTexture {
  const W = 360;
  const H = 180;
  const [c, ctx] = canvas(W, H);
  cardBackground(ctx, W, H, color);
  drawPattern(ctx, 'waves', W, H, value, 'rgba(255,255,255,0.18)');
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 5;
  rr(ctx, 12, 12, W - 24, H - 24, 18);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 64, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, String(value), W / 2, H / 2 + 2, 110, 72, color, false);
  label(ctx, String(value), 50, 40, 60, 30, '#fff', false);
  label(ctx, String(value), W - 50, H - 40, 60, 30, '#fff', false);
  return finish(c);
}

/** Small property deed lying on the table. */
export function createDeedTexture(index: number): CanvasTexture {
  const t = MEGAPOLIS.tiles[index]!;
  const color = specialColor(t)!;
  const W = 220;
  const H = 300;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  rr(ctx, 12, 12, W - 24, 92, 14);
  ctx.fill();
  label(ctx, t.shortLabel.toUpperCase(), W / 2, 58, W - 50, 44, '#fff', true);
  ctx.fillStyle = 'rgba(59,42,31,0.25)';
  for (let i = 0; i < 6; i++) ctx.fillRect(28, 130 + i * 24, W - 56 - (i % 2) * 40, 8);
  coinPrice(ctx, W / 2, H - 34, 28, String(t.price ?? ''), false);
  return finish(c);
}
