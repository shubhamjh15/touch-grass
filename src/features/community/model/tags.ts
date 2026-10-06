import { JOURNAL_TAGS, journalTagLabel } from '@/game';
import { CATEGORY_IDS, type Hue } from '@/ui';

/** The four tags the composer offers first. Categories and "Touch Grass" sit behind "More tags". */
export const MAIN_TAGS = ['win', 'wobble', 'idea', 'question'] as const;

/** Everything else a note may carry: the Touch Grass break and the seven action categories. */
export const MORE_TAGS: readonly string[] = [
  ...JOURNAL_TAGS.filter((tag) => !(MAIN_TAGS as readonly string[]).includes(tag)),
  ...CATEGORY_IDS,
];

const TAG_HUE: Readonly<Record<string, Hue>> = {
  win: 'green',
  wobble: 'orange',
  idea: 'yellow',
  question: 'blue',
  'touch-grass': 'teal',
};

/** The colour a tag prints in. Category tags fall back to violet; the tag name is the real signal. */
export function tagHue(tag: string): Hue {
  return TAG_HUE[tag] ?? 'violet';
}

export { journalTagLabel };
