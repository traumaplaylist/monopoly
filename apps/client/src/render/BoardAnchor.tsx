// Привязка HTML-плашек интерфейса к точкам поля. Каждый кадр проецируем точку
// в координаты экрана и двигаем элемент через style.transform — без лишних ре-рендеров React.
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { BOARD_H, TOP_D } from './layout';

/** Точки поля (координата Z по центральной оси), к которым крепятся плашки. */
export const ANCHORS = {
  /** Баннер «Раунд / Твой ход» — у верхнего внутреннего края. */
  banner: -BOARD_H / 2 + TOP_D + 0.75,
  /** Подсказка действия (покупка, долг) — по центру. */
  prompt: 0.15,
  /** Плашка выбранной клетки — у нижнего внутреннего края. */
  tileBar: BOARD_H / 2 - TOP_D - 0.45,
} as const;

export type AnchorId = keyof typeof ANCHORS;

const elements = new Map<AnchorId, HTMLElement>();

/** ref-колбэк для элемента-плашки: <div ref={anchorRef('banner')}> */
export function anchorRef(id: AnchorId) {
  return (el: HTMLElement | null) => {
    if (el) elements.set(id, el);
    else elements.delete(id);
  };
}

const v = new Vector3();

/** Ставится внутрь <Canvas>: обновляет позиции плашек каждый кадр. */
export function AnchorTracker() {
  useFrame(({ camera, size }) => {
    // На маленьких экранах плашки уменьшаются вместе с полем.
    const scale = Math.min(1, Math.max(0.55, Math.min(size.width / 1250, size.height / 700)));
    for (const [id, el] of elements) {
      v.set(0, 0.3, ANCHORS[id]).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    }
  });
  return null;
}
