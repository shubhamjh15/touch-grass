/**
 * Two-word captions for the one-tap stickers. A catalogue title ("Walked or cycled instead
 * of driving") is a sentence; a sticker caption has to fit under a 66 px sticker. The full
 * title is always kept as the control's description, so nothing is lost for screen readers.
 */
import type { ActionDef } from '@/data/catalogue';

const SHORT: Readonly<Record<string, string>> = {
  'walk-cycle-instead-of-car': 'Walked or cycled',
  'bus-instead-of-car': 'Took the bus',
  'train-metro-instead-of-car': 'Took the train',
  carpool: 'Shared a ride',
  'ebike-escooter-instead-of-car': 'E-bike ride',
  'ev-instead-of-petrol-car': 'Drove electric',
  'work-from-home-day': 'Worked from home',
  'train-instead-of-short-flight-km': 'Train, not plane',
  'train-instead-of-short-flight-trip': 'Train, not plane',
  'car-free-day': 'Car-free day',
  'plant-based-meal': 'Veggie meal',
  'plant-based-instead-of-beef': 'Skipped the beef',
  'chicken-instead-of-beef': 'Chicken, not beef',
  'vegetarian-day': 'Veggie day',
  'vegan-day': 'Plant-based day',
  'plant-milk-instead-of-dairy': 'Plant milk',
  'food-waste-avoided': 'Saved food',
  'meal-saved-from-waste': 'Rescued a meal',
  'local-seasonal-swap': 'Local, in season',
  'thermostat-down-1c': 'Heat down 1°',
  'line-dry-instead-of-tumble': 'Air-dried',
  'standby-off': 'Standby off',
  'led-bulb-swap': 'LED swap',
  'ac-up-1c': 'AC up 1°',
  'shorter-shower': 'Short shower',
  'hot-water-saved': 'Saved hot water',
  'wash-30-instead-of-40': 'Washed at 30°',
  'wash-cold-instead-of-40': 'Cold wash',
  'tap-off-while-brushing': 'Tap off',
  'second-hand-tshirt': 'Thrifted a top',
  'second-hand-jeans': 'Thrifted jeans',
  'repair-instead-of-replace': 'Fixed it',
  'borrow-instead-of-buy': 'Borrowed it',
  'keep-phone-one-more-year': 'Kept my phone',
  'pass-it-on': 'Passed it on',
  'recycle-aluminium-can': 'Recycled cans',
  'recycle-glass-bottle': 'Recycled glass',
  'recycle-plastic-bottle': 'Recycled plastic',
  'recycle-paper': 'Recycled paper',
  'compost-food-waste': 'Composted',
  'refuse-single-use-bag': 'Own bag',
  'refuse-single-use-cup': 'Own cup',
  'refuse-single-use-bottle': 'Refilled',
  'ewaste-dropoff': 'E-waste drop',
  'plant-a-tree': 'Planted a tree',
  'litter-pick': 'Litter pick',
  'habitat-volunteering': 'Volunteered',
  'tend-plants': 'Tended plants',
  'help-wildlife': 'Helped wildlife',
  'climate-conversation': 'Climate chat',
  'civic-action': 'Spoke up',
};

const MAX_CAPTION = 18;

/** The caption under a one-tap sticker. Unknown ids fall back to a trimmed title. */
export function stickerLabel(action: Pick<ActionDef, 'id' | 'title'>): string {
  const short = SHORT[action.id];
  if (short) return short;
  if (action.title.length <= MAX_CAPTION) return action.title;
  // Cut at a word, never mid-word: a caption is two short lines at most.
  const words = action.title.split(' ');
  let caption = '';
  for (const word of words) {
    if (`${caption} ${word}`.trim().length > MAX_CAPTION) break;
    caption = `${caption} ${word}`.trim();
  }
  return caption || action.title.slice(0, MAX_CAPTION);
}
