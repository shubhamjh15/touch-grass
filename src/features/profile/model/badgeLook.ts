import {
  BookOpen,
  CalendarCheck,
  CircleCheck,
  CircleDot,
  CloudRain,
  Compass,
  Droplets,
  Earth,
  Flame,
  Flower2,
  Footprints,
  Globe,
  Handshake,
  HeartPulse,
  History,
  Image as ImageIcon,
  Leaf,
  Lightbulb,
  Moon,
  NotebookPen,
  Palette,
  Recycle,
  Salad,
  ScrollText,
  Shapes,
  Shirt,
  Sparkles,
  Sprout,
  Sunrise,
  Target,
  TreeDeciduous,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Hue } from '@/ui';

export interface BadgeLook {
  icon: LucideIcon;
  hue: Hue;
}

/**
 * The picture and ink colour of every badge. Keyed by the catalogue's badge ids, so adding a
 * badge without a look fails the test next to this file instead of showing a blank medal.
 */
export const BADGE_LOOK: Readonly<Record<string, BadgeLook>> = {
  trailblazer: { icon: Footprints, hue: 'blue' },
  'plant-plate': { icon: Salad, hue: 'orange' },
  'watt-watcher': { icon: Zap, hue: 'yellow' },
  'drop-saver': { icon: Droplets, hue: 'blue' },
  'loop-maker': { icon: Shirt, hue: 'violet' },
  'bin-boss': { icon: Recycle, hue: 'teal' },
  'wild-heart': { icon: Flower2, hue: 'green' },
  'ring-collector': { icon: CircleDot, hue: 'orange' },
  'on-a-roll': { icon: Flame, hue: 'tomato' },
  'full-circle': { icon: CircleCheck, hue: 'green' },
  'kept-out': { icon: Globe, hue: 'teal' },
  'quest-hand': { icon: Compass, hue: 'violet' },
  bookworm: { icon: BookOpen, hue: 'blue' },
  'grass-toucher': { icon: TreeDeciduous, hue: 'green' },
  'dear-diary': { icon: NotebookPen, hue: 'pink' },
  'first-leaf': { icon: Leaf, hue: 'green' },
  rooted: { icon: Sprout, hue: 'green' },
  'well-rounded': { icon: Shapes, hue: 'violet' },
  'clean-sweep': { icon: Sparkles, hue: 'yellow' },
  'epic-tale': { icon: ScrollText, hue: 'orange' },
  'myth-buster': { icon: Lightbulb, hue: 'yellow' },
  sharpshooter: { icon: Target, hue: 'tomato' },
  'show-and-tell': { icon: ImageIcon, hue: 'pink' },
  challenger: { icon: Handshake, hue: 'blue' },
  'night-owl': { icon: Moon, hue: 'violet' },
  'dawn-chorus': { icon: Sunrise, hue: 'orange' },
  'rain-dancer': { icon: CloudRain, hue: 'blue' },
  'comeback-kid': { icon: HeartPulse, hue: 'pink' },
  'perfect-week': { icon: CalendarCheck, hue: 'green' },
  'earth-day': { icon: Earth, hue: 'teal' },
  polymath: { icon: Palette, hue: 'pink' },
  'hat-trick': { icon: Trophy, hue: 'yellow' },
  'old-growth': { icon: History, hue: 'orange' },
};

const FALLBACK: BadgeLook = { icon: Sparkles, hue: 'green' };

export function badgeLook(id: string): BadgeLook {
  return BADGE_LOOK[id] ?? FALLBACK;
}
