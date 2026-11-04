// Tile icons: Lucide (ISC licence, https://lucide.dev) line icons, recoloured and slightly filled.
// The same SVG is drawn on canvas tile textures and shown in the DOM (sheets, action bar).
// Artist PNGs from assets.json still take priority on the board.
import {
  Anchor, BedDouble, BookOpen, Building2, Car, Citrus, Clapperboard, Coffee, Croissant, Drama, FerrisWheel, Fish, Flag,
  Flower2, Gamepad2, Gavel, GraduationCap, Guitar, Image as ImageIcon, Landmark, Moon, Music, Palette, Pizza, Plane, Plus,
  Pyramid, Receipt, Sailboat, Ship, Shirt, ShoppingCart, Sparkles, Store, Sun, Swords, TrainFront, TreeDeciduous, TreePalm,
  Umbrella, Utensils, Wine,
} from 'lucide-static';

const SVG: Record<string, string> = {
  flag: Flag, cup: Coffee, bread: Croissant, receipt: Receipt, gamepad: Gamepad2, film: Clapperboard, gavel: Gavel,
  bed: BedDouble, disco: Sparkles, palette: Palette, stall: Store, cross: Plus, basket: ShoppingCart, coffee: Coffee,
  columns: Landmark, swords: Swords, frame: ImageIcon, masks: Drama, tree: TreeDeciduous, book: BookOpen, car: Car,
  cap: GraduationCap, anchor: Anchor, train: TrainFront, note: Music, tower: Building2,
  // «Вокруг света»
  pyramid: Pyramid, fish: Fish, plane: Plane, palm: TreePalm, landmark: Landmark, sun: Sun, guitar: Guitar,
  umbrella: Umbrella, ship: Ship, moon: Moon, citrus: Citrus, music: Music, ferris: FerrisWheel, pizza: Pizza,
  shirt: Shirt, sailboat: Sailboat, wine: Wine, utensils: Utensils, sakura: Flower2,
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

/**
 * Colour 3D icons: Microsoft Fluent Emoji 3D (MIT, https://github.com/microsoft/fluentui-emoji),
 * files in public/icons/fluent/<visual>.png. They match the user's reference images; Lucide line
 * icons remain the fallback for visuals without a PNG.
 */
export const FLUENT = new Set([
  'flag', 'receipt', 'gamepad', 'gavel', 'coffee', 'car', 'swords', 'plane', 'pyramid', 'columns', 'fish', 'palm',
  'landmark', 'film', 'sun', 'cactus', 'guitar', 'umbrella', 'ship', 'moon', 'citrus', 'music', 'ferris', 'pizza',
  'shirt', 'sailboat', 'wine', 'bread', 'utensils', 'sakura', 'tower', 'money', 'dice',
  // «По России»
  'bear', 'comet', 'gem', 'books', 'spruce', 'seal', 'rocket', 'castle', 'mosque', 'sunflower', 'mountain', 'tiger',
  'volcano', 'anchor', 'bell', 'dolls', 'church', 'wood', 'snowflake', 'whale', 'fountain', 'bridge', 'train',
  // «Космос»
  'newmoon', 'astronaut', 'satellite', 'robot', 'desert', 'cloud', 'rain', 'fire', 'pick', 'rock', 'cyclone', 'bolt',
  'ice', 'fog', 'droplet', 'saturn', 'sparkles', 'dizzy', 'hole', 'galaxy', 'star', 'telescope', 'ufo',
]);

export function fluentUrl(visual: string): string | null {
  return FLUENT.has(visual) ? `icons/fluent/${visual}.png` : null;
}

const cache = new Map<string, Promise<HTMLImageElement | null>>();

function loadUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Icon as an image for canvas drawing: colour 3D PNG if available, else a tinted line icon. */
export function iconImage(visual: string, color = '#ffffff'): Promise<HTMLImageElement | null> {
  const fluent = fluentUrl(visual);
  const key = fluent ?? `${visual}:${color}`;
  let p = cache.get(key);
  if (!p && fluent) {
    p = loadUrl(fluent);
    cache.set(key, p);
  }
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
