/**
 * What the sticker sheet adds to the catalogue: a caption short enough for a sticker,
 * a glyph of its own, and the words people actually type when they look for an action.
 * Keyed by the catalogue's id type, so a new action cannot ship without them.
 */
import {
  Bath,
  BatteryCharging,
  Bean,
  Bike,
  Bird,
  Bus,
  Carrot,
  Coffee,
  CookingPot,
  Droplets,
  Drumstick,
  Fan,
  Flower2,
  Footprints,
  GlassWater,
  Handshake,
  HeartHandshake,
  Laptop,
  Lightbulb,
  Megaphone,
  MessagesSquare,
  Milk,
  Newspaper,
  Package,
  PlugZap,
  Recycle,
  Refrigerator,
  Salad,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Shovel,
  ShowerHead,
  Smartphone,
  Snowflake,
  Thermometer,
  TrainFront,
  TrainTrack,
  Trash2,
  TreeDeciduous,
  Unplug,
  Users,
  Vegan,
  WashingMachine,
  Wind,
  Wine,
  Wrench,
  Battery,
  type LucideIcon,
} from 'lucide-react';
import type { CatalogueActionId } from '@/data/catalogue';

export interface ActionMeta {
  /** The caption under the sticker: two short lines at most. */
  label: string;
  icon: LucideIcon;
  /** Search words beyond the title (spec 3.4: 4 to 8 per action). Lower case. */
  synonyms: readonly string[];
}

export const ACTION_META: Readonly<Record<CatalogueActionId, ActionMeta>> = {
  'walk-cycle-instead-of-car': {
    label: 'Walk or bike',
    icon: Bike,
    synonyms: ['bike', 'bicycle', 'cycling', 'on foot', 'walking', 'commute', 'ride', 'stroll'],
  },
  'bus-instead-of-car': {
    label: 'Bus',
    icon: Bus,
    synonyms: ['coach', 'public transport', 'transit', 'commute', 'shuttle', 'tram'],
  },
  'train-metro-instead-of-car': {
    label: 'Train or metro',
    icon: TrainFront,
    synonyms: ['subway', 'underground', 'tube', 'rail', 'tram', 'commute', 'public transport'],
  },
  carpool: {
    label: 'Shared ride',
    icon: Users,
    synonyms: ['carpool', 'car share', 'lift share', 'rideshare', 'gave a lift', 'school run'],
  },
  'ebike-escooter-instead-of-car': {
    label: 'E-bike',
    icon: BatteryCharging,
    synonyms: ['ebike', 'electric bike', 'e-scooter', 'escooter', 'scooter', 'pedelec'],
  },
  'ev-instead-of-petrol-car': {
    label: 'Drove electric',
    icon: PlugZap,
    synonyms: ['ev', 'electric car', 'electric vehicle', 'battery car', 'plug-in', 'tesla'],
  },
  'work-from-home-day': {
    label: 'Home office',
    icon: Laptop,
    synonyms: ['wfh', 'remote work', 'telework', 'no commute', 'home working', 'stayed home'],
  },
  'train-instead-of-short-flight-km': {
    label: 'Train, not plane',
    icon: TrainTrack,
    synonyms: ['flight', 'fly', 'plane', 'no fly', 'rail trip', 'sleeper', 'long distance train'],
  },
  'train-instead-of-short-flight-trip': {
    label: 'Train, not plane',
    icon: TrainTrack,
    synonyms: ['flight', 'fly', 'plane', 'no fly', 'holiday by train', 'night train'],
  },
  'car-free-day': {
    label: 'Car-free day',
    icon: Footprints,
    synonyms: ['no car', 'left the car', 'car free', 'did not drive', 'without a car'],
  },
  'plant-based-meal': {
    label: 'Plant-based meal',
    icon: Salad,
    synonyms: [
      'vegan meal',
      'veggie',
      'vegetarian meal',
      'meat free',
      'meatless',
      'lentils',
      'tofu',
    ],
  },
  'plant-based-instead-of-beef': {
    label: 'Beans, not beef',
    icon: Bean,
    synonyms: ['no beef', 'beef swap', 'burger swap', 'veggie burger', 'lentil', 'steak', 'mince'],
  },
  'chicken-instead-of-beef': {
    label: 'Chicken, not beef',
    icon: Drumstick,
    synonyms: ['poultry', 'no beef', 'beef swap', 'turkey', 'less red meat', 'steak'],
  },
  'vegetarian-day': {
    label: 'Veggie day',
    icon: Carrot,
    synonyms: ['vegetarian', 'meat free day', 'meatless monday', 'no meat', 'veggie'],
  },
  'vegan-day': {
    label: 'Plant-based day',
    icon: Vegan,
    synonyms: ['vegan', 'no animal products', 'dairy free day', 'plant based', 'veganuary'],
  },
  'plant-milk-instead-of-dairy': {
    label: 'Plant milk',
    icon: Milk,
    synonyms: ['oat milk', 'soy milk', 'almond milk', 'dairy free', 'oat latte', 'non dairy'],
  },
  'food-waste-avoided': {
    label: 'Saved food',
    icon: Refrigerator,
    synonyms: ['food waste', 'used up', 'fridge', 'froze it', 'wonky veg', 'scraps', 'stale bread'],
  },
  'meal-saved-from-waste': {
    label: 'Rescued a meal',
    icon: CookingPot,
    synonyms: ['leftovers', 'too good to go', 'food rescue', 'doggy bag', 'batch cooking'],
  },
  'local-seasonal-swap': {
    label: 'Local, in season',
    icon: ShoppingBasket,
    synonyms: ['farmers market', 'seasonal', 'local produce', 'veg box', 'allotment', 'home grown'],
  },
  'thermostat-down-1c': {
    label: 'Heating down',
    icon: Thermometer,
    synonyms: ['thermostat', 'radiator', 'jumper', 'sweater', 'boiler', 'turned the heat down'],
  },
  'line-dry-instead-of-tumble': {
    label: 'Air-dried',
    icon: Wind,
    synonyms: ['line dry', 'washing line', 'clothes horse', 'drying rack', 'no dryer', 'tumble'],
  },
  'standby-off': {
    label: 'Standby off',
    icon: Unplug,
    synonyms: ['vampire power', 'unplug', 'switched off', 'power strip', 'tv off', 'phantom load'],
  },
  'led-bulb-swap': {
    label: 'LED bulb',
    icon: Lightbulb,
    synonyms: ['light bulb', 'lighting', 'lamp', 'incandescent', 'halogen', 'energy saving bulb'],
  },
  'ac-up-1c': {
    label: 'AC up, or a fan',
    icon: Fan,
    synonyms: ['air conditioning', 'aircon', 'cooling', 'fan', 'air con', 'hot day'],
  },
  'shorter-shower': {
    label: 'Short shower',
    icon: ShowerHead,
    synonyms: ['quick shower', 'shower timer', 'four minute shower', 'wash', 'bathroom'],
  },
  'hot-water-saved': {
    label: 'Hot water saved',
    icon: Bath,
    synonyms: [
      'bath',
      'washing up',
      'dishes',
      'kettle',
      'boiled only what i need',
      'full dishwasher',
    ],
  },
  'wash-30-instead-of-40': {
    label: 'Wash at 30',
    icon: WashingMachine,
    synonyms: ['laundry', 'washing machine', 'cool wash', '30 degrees', 'eco wash', 'clothes'],
  },
  'wash-cold-instead-of-40': {
    label: 'Cold wash',
    icon: Snowflake,
    synonyms: ['laundry', 'washing machine', 'cold cycle', '20 degrees', 'clothes', 'cold water'],
  },
  'tap-off-while-brushing': {
    label: 'Tap off',
    icon: Droplets,
    synonyms: ['brushing teeth', 'toothbrush', 'running tap', 'faucet', 'sink', 'shaving'],
  },
  'second-hand-tshirt': {
    label: 'Second-hand',
    icon: Shirt,
    synonyms: [
      'thrift',
      'thrifted',
      'charity shop',
      'vintage',
      'preloved',
      'vinted',
      'used clothes',
    ],
  },
  'second-hand-jeans': {
    label: 'Second-hand',
    icon: Shirt,
    synonyms: ['thrift', 'denim', 'charity shop', 'vintage', 'preloved', 'coat', 'jacket'],
  },
  'repair-instead-of-replace': {
    label: 'Repaired it',
    icon: Wrench,
    synonyms: ['fix', 'fixed', 'mend', 'mended', 'sew', 'patched', 'repair cafe', 'cobbler'],
  },
  'borrow-instead-of-buy': {
    label: 'Borrowed it',
    icon: Handshake,
    synonyms: ['rent', 'rented', 'library', 'tool library', 'lend', 'hire', 'shared a drill'],
  },
  'keep-phone-one-more-year': {
    label: 'Kept my phone',
    icon: Smartphone,
    synonyms: ['no upgrade', 'old phone', 'new battery', 'mobile', 'smartphone', 'skipped upgrade'],
  },
  'pass-it-on': {
    label: 'Passed it on',
    icon: Package,
    synonyms: [
      'donate',
      'donated',
      'sold',
      'swap',
      'gave away',
      'freecycle',
      'charity',
      'decluttered',
    ],
  },
  'recycle-aluminium-can': {
    label: 'Recycling',
    icon: Recycle,
    synonyms: ['cans', 'tin', 'aluminum', 'drinks can', 'metal', 'sorted the bins'],
  },
  'recycle-glass-bottle': {
    label: 'Recycling',
    icon: Wine,
    synonyms: ['glass', 'jars', 'bottle bank', 'wine bottle', 'sorted the bins'],
  },
  'recycle-plastic-bottle': {
    label: 'Recycling',
    icon: Recycle,
    synonyms: ['plastic', 'pet bottle', 'deposit return', 'bottle return', 'sorted the bins'],
  },
  'recycle-paper': {
    label: 'Recycling',
    icon: Newspaper,
    synonyms: ['cardboard', 'newspaper', 'boxes', 'paper bin', 'junk mail', 'sorted the bins'],
  },
  'compost-food-waste': {
    label: 'Composted',
    icon: Shovel,
    synonyms: ['compost', 'food caddy', 'peelings', 'wormery', 'green bin', 'coffee grounds'],
  },
  'refuse-single-use-bag': {
    label: 'Own bag',
    icon: ShoppingBag,
    synonyms: ['tote', 'reusable bag', 'no plastic bag', 'carrier bag', 'shopping bag'],
  },
  'refuse-single-use-cup': {
    label: 'Own cup',
    icon: Coffee,
    synonyms: ['keep cup', 'reusable cup', 'travel mug', 'coffee cup', 'takeaway coffee'],
  },
  'refuse-single-use-bottle': {
    label: 'Refilled bottle',
    icon: GlassWater,
    synonyms: [
      'water bottle',
      'refill',
      'reusable bottle',
      'tap water',
      'flask',
      'no bottled water',
    ],
  },
  'ewaste-dropoff': {
    label: 'E-waste drop-off',
    icon: Battery,
    synonyms: ['batteries', 'electronics', 'old cables', 'recycling centre', 'old phone', 'weee'],
  },
  'plant-a-tree': {
    label: 'Planted a tree',
    icon: TreeDeciduous,
    synonyms: ['sapling', 'tree planting', 'orchard', 'hedge', 'reforest', 'planted'],
  },
  'litter-pick': {
    label: 'Litter pick',
    icon: Trash2,
    synonyms: ['clean up', 'beach clean', 'plogging', 'trash', 'rubbish', 'park clean'],
  },
  'habitat-volunteering': {
    label: 'Volunteered',
    icon: HeartHandshake,
    synonyms: [
      'volunteer',
      'conservation',
      'habitat',
      'community garden',
      'rewilding',
      'trail work',
    ],
  },
  'tend-plants': {
    label: 'Tended plants',
    icon: Flower2,
    synonyms: ['garden', 'gardening', 'balcony', 'watered', 'houseplants', 'weeding', 'pots'],
  },
  'help-wildlife': {
    label: 'Helped wildlife',
    icon: Bird,
    synonyms: ['bird feeder', 'bee hotel', 'pollinators', 'hedgehog', 'wild corner', 'bug hotel'],
  },
  'climate-conversation': {
    label: 'Climate chat',
    icon: MessagesSquare,
    synonyms: ['talked', 'conversation', 'discussion', 'friends', 'family', 'spoke up'],
  },
  'civic-action': {
    label: 'Spoke up',
    icon: Megaphone,
    synonyms: ['petition', 'vote', 'voted', 'mp', 'council', 'protest', 'letter', 'town hall'],
  },
};

/** Glyphs and captions for the three tiles that stand for a whole overlap group (spec 3.3). */
export const MERGED_TILE_META = {
  recycling: {
    label: 'Sorted recycling',
    title: 'Sorted recycling',
    icon: Recycle,
    synonyms: ['recycle', 'recycling', 'sorting', 'bins', 'bottle bank', 'kerbside'],
  },
  secondhand: {
    label: 'Second-hand',
    title: 'Bought clothes second-hand',
    icon: Shirt,
    synonyms: ['thrift', 'second hand', 'secondhand', 'used', 'preloved', 'charity shop'],
  },
  'flight-swap': {
    label: 'Train, not plane',
    title: 'Took the train instead of a short flight',
    icon: TrainTrack,
    synonyms: ['flight', 'plane', 'fly', 'no fly', 'rail'],
  },
} as const satisfies Record<string, ActionMeta & { title: string }>;
