// Рисуем верх поля на 2D-canvas и используем как текстуру: без загрузки шрифтов,
// корректная кириллица, одна текстура на всё поле (дёшево для мобильных GPU).
import { CanvasTexture, SRGBColorSpace } from 'three';
import { GROUPS, TILES } from '../engine';
import type { TileDef } from '../engine';
import { BAND, BOARD, CORNER, SIDE, tileRect } from './layout';

const PX = 2048;
const S = PX / BOARD;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const C = {
  board: '#101a33',
  tile: '#e9eef8',
  tileAlt: '#dfe7f5',
  line: '#1d2a4d',
  text: '#16213e',
  muted: '#4a5677',
  center: '#0c1530',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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
  return lines;
}

/** Подбирает размер шрифта так, чтобы текст влез в maxW и не более maxLines строк. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, base: number, weight = 700) {
  for (let size = base; size > base * 0.5; size *= 0.94) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size };
  }
  const size = base * 0.5;
  ctx.font = `${weight} ${size}px ${FONT}`;
  return { lines: wrap(ctx, text, maxW), size };
}

function drawIcon(ctx: CanvasRenderingContext2D, t: TileDef, cy: number, size: number) {
  ctx.save();
  ctx.translate(0, cy);
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = C.text;
  ctx.fillStyle = C.text;
  switch (t.kind) {
    case 'transport': {
      // Ракета
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.5);
      ctx.quadraticCurveTo(size * 0.28, -size * 0.1, size * 0.18, size * 0.35);
      ctx.lineTo(-size * 0.18, size * 0.35);
      ctx.quadraticCurveTo(-size * 0.28, -size * 0.1, 0, -size * 0.5);
      ctx.fill();
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.moveTo(-size * 0.12, size * 0.38);
      ctx.lineTo(0, size * 0.6);
      ctx.lineTo(size * 0.12, size * 0.38);
      ctx.fill();
      break;
    }
    case 'utility': {
      if (t.index === 12) {
        ctx.fillStyle = '#f5b400';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5b400';
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3);
          ctx.lineTo(Math.cos(a) * size * 0.45, Math.sin(a) * size * 0.45);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#2b8fd6';
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.45);
        ctx.bezierCurveTo(size * 0.35, 0, size * 0.3, size * 0.4, 0, size * 0.4);
        ctx.bezierCurveTo(-size * 0.3, size * 0.4, -size * 0.35, 0, 0, -size * 0.45);
        ctx.fill();
      }
      break;
    }
    case 'card': {
      ctx.fillStyle = t.deck === 'signal' ? '#7b5cff' : '#11a37f';
      ctx.font = `bold ${size * 0.9}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.deck === 'signal' ? '⌁' : '✦', 0, 0);
      break;
    }
    case 'tax': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `bold ${size * 0.4}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₡', 0, size * 0.02);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function drawTile(ctx: CanvasRenderingContext2D, t: TileDef) {
  const r = tileRect(t.index);
  // Локальная система клетки: ширина вдоль стороны, высота — от внутреннего края к внешнему.
  const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][r.side]!;
  const w = (r.corner ? CORNER : SIDE) * S;
  const h = CORNER * S;
  ctx.save();
  ctx.translate((r.x + BOARD / 2) * S, (r.z + BOARD / 2) * S);
  ctx.rotate(angle);
  if (r.corner) ctx.rotate(-Math.PI / 4);
  const top = -h / 2;

  if (!r.corner) {
    ctx.fillStyle = t.index % 2 ? C.tile : C.tileAlt;
    ctx.fillRect(-w / 2, top, w, h);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2, top, w, h);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;

  if (r.corner) {
    const d = CORNER * S * 1.2;
    const fit = fitLines(ctx, t.name.toUpperCase(), d * 0.95, 1, S * 0.3, 800);
    ctx.fillText(fit.lines[0]!, 0, S * 0.1);
    ctx.font = `500 ${S * 0.17}px ${FONT}`;
    ctx.fillStyle = C.muted;
    const sub: Record<string, string> = {
      start: `+200 за проход`,
      jail: 'или просто в гостях',
      rest: 'бесплатная стоянка',
      goToJail: 'отправляйтесь в карантин',
    };
    ctx.fillText(sub[t.kind] ?? '', 0, S * 0.4);
    if (t.kind === 'start') {
      ctx.fillStyle = '#ff5d73';
      ctx.font = `900 ${S * 0.55}px ${FONT}`;
      ctx.fillText('➜', 0, -S * 0.35);
    }
    ctx.restore();
    return;
  }

  let textTop = top + S * 0.12;
  if (t.kind === 'property') {
    ctx.fillStyle = GROUPS[t.group!].color;
    ctx.fillRect(-w / 2, top, w, BAND * S);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2, top, w, BAND * S);
    textTop = top + BAND * S + S * 0.08;
  }
  ctx.fillStyle = C.text;
  const { lines, size } = fitLines(ctx, t.name.toUpperCase(), w - S * 0.14, 3, S * 0.16);
  lines.forEach((ln, k) => ctx.fillText(ln, 0, textTop + size + k * size * 1.15));

  if (t.kind !== 'property') drawIcon(ctx, t, S * 0.25, S * 0.62);

  const priceText = t.price ? `₡${t.price}` : t.tax ? `−₡${t.tax}` : '';
  if (priceText) {
    ctx.font = `600 ${S * 0.17}px ${FONT}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(priceText, 0, h / 2 - S * 0.14);
  }
  ctx.restore();
}

function drawCenter(ctx: CanvasRenderingContext2D) {
  const inner = (BOARD - CORNER * 2) * S;
  const x0 = CORNER * S;
  const grad = ctx.createRadialGradient(PX / 2, PX / 2, 50, PX / 2, PX / 2, inner * 0.75);
  grad.addColorStop(0, '#1d2f63');
  grad.addColorStop(1, C.center);
  ctx.fillStyle = grad;
  ctx.fillRect(x0, x0, inner, inner);

  // Орбиты
  ctx.save();
  ctx.translate(PX / 2, PX / 2);
  ctx.strokeStyle = 'rgba(140,170,255,0.18)';
  ctx.lineWidth = 3;
  for (const rr of [0.18, 0.28, 0.38]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, inner * rr, inner * rr * 0.55, -Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(0, 0, inner * 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8eeff';
  ctx.font = `900 ${S * 0.85}px ${FONT}`;
  ctx.fillText('ОРБИТАЛЬНЫЙ', 0, -S * 1.15);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('КАПИТАЛ', 0, -S * 0.2);
  ctx.restore();

  // Места колод
  const deck = (cx: number, cy: number, color: string, label: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    const cw = S * 1.6;
    const ch = S * 1.0;
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${S * 0.22}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };
  deck(PX / 2 - S * 2.6, PX / 2 + S * 2.6, '#5b3fd6', 'СИГНАЛ');
  deck(PX / 2 + S * 2.6, PX / 2 - S * 2.6, '#0e8a6b', 'СОВЕТ КОЛОНИИ');
}

export function createBoardTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = PX;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.board;
  ctx.fillRect(0, 0, PX, PX);
  drawCenter(ctx);
  // Углы — фон
  for (const i of [0, 10, 20, 30]) {
    const r = tileRect(i);
    ctx.fillStyle = '#cfdcf3';
    ctx.fillRect((r.x - CORNER / 2 + BOARD / 2) * S, (r.z - CORNER / 2 + BOARD / 2) * S, CORNER * S, CORNER * S);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.strokeRect((r.x - CORNER / 2 + BOARD / 2) * S, (r.z - CORNER / 2 + BOARD / 2) * S, CORNER * S, CORNER * S);
  }
  for (const t of TILES) drawTile(ctx, t);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
