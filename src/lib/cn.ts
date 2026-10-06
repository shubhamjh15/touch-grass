import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge, validators } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default scales. Without the project's token names it takes
 * `text-body-sm` for a text colour and silently drops it next to `text-ink`. Keep these lists in step
 * with the `@theme` block in `src/styles/index.css`.
 */
const twMerge = extendTailwindMerge<'lift' | 'dc' | 'flat' | 'hit'>({
  extend: {
    theme: {
      text: [
        'display-hero',
        'display-xl',
        'display-lg',
        'display-md',
        'display-sm',
        'display-xs',
        'h1',
        'h2',
        'h3',
        'h4',
        'reading',
        'lead',
        'body',
        'body-sm',
        'caption',
        'label',
        'button-sm',
        'button',
        'button-lg',
        'tab',
        'data-lg',
        'data',
        'data-sm',
        'slug',
        'tick',
      ],
      radius: ['paper', 'xs', 'sm', 'ctl', 'md', 'lg', 'xl', 'pill'],
      shadow: ['1', '2', '3', '4', '5', 'carry', 'plate', 'key', 'tooltip', 'thumb', 'thumb-on'],
      'inset-shadow': ['deboss', 'misreg'],
      ease: ['out', 'in', 'in-out', 'stick', 'peel', 'mech'],
      animate: [
        'stick',
        'peel',
        'stamp',
        'pop',
        'caret',
        'puppet',
        'colorbar',
        'hatch',
        'sheet-in',
        'sheet-out',
        'drawer-in',
        'drawer-out',
        'scrim-in',
        'scrim-out',
        'tear',
        'sweep',
        'ticker',
        'timer',
        'strike',
        'leader',
      ],
    },
    classGroups: {
      // The kit's own functional utilities: a later `lift-3` replaces an earlier `lift-5`.
      lift: [{ lift: [validators.isInteger] }],
      dc: [{ dc: [validators.isInteger] }],
      flat: [{ flat: [validators.isInteger] }],
      hit: [{ hit: [validators.isInteger] }],
    },
  },
});

/** Joins class names and resolves conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
