import type { CategoryDef, CategoryId } from './types';

/** The seven product categories, in the order the Log page shows them. */
export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'move',
    label: 'Move',
    emoji: '🚲',
    blurb: 'How you get around.',
    evidenceCategories: ['transport'],
  },
  {
    id: 'eat',
    label: 'Eat',
    emoji: '🥗',
    blurb: "What's on your plate, and what never reaches the bin.",
    evidenceCategories: ['food'],
  },
  {
    id: 'power',
    label: 'Power',
    emoji: '⚡',
    blurb: 'Heating, cooling and electricity at home.',
    evidenceCategories: ['energy'],
  },
  {
    id: 'water',
    label: 'Water',
    emoji: '💧',
    blurb: 'Hot water, showers and laundry.',
    evidenceCategories: ['water', 'energy'],
  },
  {
    id: 'stuff',
    label: 'Stuff',
    emoji: '🧵',
    blurb: 'What you buy, keep, mend and pass on.',
    evidenceCategories: ['shopping', 'waste'],
  },
  {
    id: 'waste',
    label: 'Waste',
    emoji: '♻️',
    blurb: 'Refusing, sorting and composting.',
    evidenceCategories: ['waste'],
  },
  {
    id: 'nature',
    label: 'Nature & Voice',
    emoji: '🌳',
    blurb: 'Tending living things and speaking up.',
    evidenceCategories: ['nature'],
  },
];

export const CATEGORY_BY_ID: Readonly<Record<CategoryId, CategoryDef>> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<CategoryId, CategoryDef>;
