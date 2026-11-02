// Tile icons: Lucide (ISC licence, https://lucide.dev) line icons, recoloured and slightly filled.
// The same SVG is drawn on canvas tile textures and shown in the DOM (sheets, action bar).
// Artist PNGs from assets.json still take priority on the board.
import {
  Anchor, BedDouble, BookOpen, Building2, Car, Clapperboard, Coffee, Croissant, Drama, Flag, Gamepad2, Gavel,
  GraduationCap, Image as ImageIcon, Landmark, Music, Palette, Plus, Receipt, ShoppingCart, Sparkles, Store, Swords,
  TrainFront, TreeDeciduous,
} from 'lucide-static';

const SVG: Record<string, string> = {
  flag: Flag, cup: Coffee, bread: Croissant, receipt: Receipt, gamepad: Gamepad2, film: Clapperboard, gavel: Gavel,
  bed: BedDouble, disco: Sparkles, palette: Palette, stall: Store, cross: Plus, basket: ShoppingCart, coffee: Coffee,
  columns: Landmark, swords: Swords, frame: ImageIcon, masks: Drama, tree: TreeDeciduous, book: BookOpen, car: Car,
  cap: GraduationCap, anchor: Anchor, train: TrainFront, note: Music, tower: Building2,
};

/** SVG markup for a tile visual key (null for «?» chance tiles and unknown keys). */
export function iconSvg(visual: string, color = '#ffffff', fillOpacity = 0.32, strokeWidth = 2.6): string | null {
  const src = SVG[visual];
  if (!src) return null;
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace('stroke="currentColor"', `stroke="${color}"`)
    .replace('fill="none"', `fill="${color}" fill-opacity="${fillOpacity}"`)
    .replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)
    .replace(/width="24"\s+height="24"/, 'width="96" height="96"')
    .trim();
}

const cache = new Map<string, Promise<HTMLImageElement | null>>();

/** Icon as an image for canvas drawing. */
export function iconImage(visual: string, color = '#ffffff'): Promise<HTMLImageElement | null> {
  const key = `${visual}:${color}`;
  let p = cache.get(key);
  if (!p) {
    const svg = iconSvg(visual, color);
    p = svg
      ? new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        })
      : Promise.resolve(null);
    cache.set(key, p);
  }
  return p;
}
