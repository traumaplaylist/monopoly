// The free board area of the match layout (the «stage» element). The 3D canvas covers the whole
// screen; the camera fits the board into this rectangle and DOM anchors are offset by it.
let stageEl: HTMLElement | null = null;
let canvasEl: HTMLElement | null = null;

export function setStageElement(el: HTMLElement | null) {
  stageEl = el;
}

export function setCanvasElement(el: HTMLElement | null) {
  canvasEl = el;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Stage rectangle in canvas pixels (whole canvas if the layout has no stage yet). */
export function stageRect(width: number, height: number): Rect {
  if (!stageEl) return { x: 0, y: 0, w: width, h: height };
  const s = stageEl.getBoundingClientRect();
  const c = canvasEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const r = { x: Math.round(s.left - c.left), y: Math.round(s.top - c.top), w: Math.round(s.width), h: Math.round(s.height) };
  if (r.w < 50 || r.h < 50) return { x: 0, y: 0, w: width, h: height };
  return r;
}

/** Offset of the stage element relative to the canvas (for DOM overlays placed inside the stage). */
export function stageOffset(): { x: number; y: number } {
  if (!stageEl) return { x: 0, y: 0 };
  const s = stageEl.getBoundingClientRect();
  const c = canvasEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return { x: s.left - c.left, y: s.top - c.top };
}

/** Calls `cb` when the stage element changes size (layout changes without a window resize). */
export function observeStage(cb: () => void): () => void {
  if (!stageEl || typeof ResizeObserver === 'undefined') return () => undefined;
  const ro = new ResizeObserver(cb);
  ro.observe(stageEl);
  return () => ro.disconnect();
}
