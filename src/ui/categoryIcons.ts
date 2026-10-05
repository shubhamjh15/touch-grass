import { Apple, Bike, Droplet, Leaf, Recycle, Tag, Zap, type LucideIcon } from 'lucide-react';
import type { CategoryId } from './tokens';

/** The default glyph of each category sticker. An action may override it with its own icon. */
export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  move: Bike,
  eat: Apple,
  power: Zap,
  water: Droplet,
  stuff: Tag,
  waste: Recycle,
  nature: Leaf,
};
