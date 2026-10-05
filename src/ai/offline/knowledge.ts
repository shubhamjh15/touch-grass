/**
 * The built-in coach's curated knowledge. Everything here is written by hand,
 * deliberately conservative, and honest about its limits: where a number
 * depends on the household or the country it is given as a range or in words.
 * Nothing in this file pretends to come from a live model.
 */

export const OFFLINE_LABEL = 'Built-in coach';

export interface QuickPrompt {
  id: string;
  label: string;
}

/** Spec 8.6: the first three sit above the input, the rest behind "More ideas". */
export const QUICK_PROMPTS: { primary: QuickPrompt[]; more: QuickPrompt[] } = {
  primary: [
    { id: 'easy_win', label: 'One easy win for today' },
    { id: 'biggest_lever', label: "What's my biggest lever?" },
    { id: 'food', label: 'Plan me a low-carbon dinner' },
  ],
  more: [
    { id: 'explain_numbers', label: 'Explain my numbers' },
    { id: 'quests', label: "Help me finish this week's quests" },
    { id: 'recycling_worth', label: 'Is recycling actually worth it?' },
    { id: 'anxiety', label: "I'm feeling climate-anxious" },
    { id: 'money_swap', label: 'A swap that saves money' },
  ],
};

/** Short, checkable facts used for the daily tip when nothing personal is more useful. */
export const DAILY_FACTS: readonly string[] = [
  'Beef and lamb have the biggest footprint of common foods, per meal and per gram of protein. Beans, lentils and vegetables sit far lower.',
  'Short car trips are the least efficient ones, because engines run cold. Those are the trips a walk or a bike replaces most easily.',
  "Washing at 30 °C instead of 60 °C uses far less energy, because most of a wash's energy goes into heating the water.",
  'Per passenger-kilometre, a train typically emits several times less than a car with one person in it.',
  "Most of a phone or laptop's lifetime emissions come from making it, so every extra year you keep one is a real saving.",
  'Food that gets thrown away carries the emissions of growing, shipping and cooking it. Eating the leftovers keeps all of that from being wasted.',
  'Trees store carbon, but slowly and over decades. That is why cutting emissions comes first and planting comes alongside.',
  "In cooler climates heating and hot water are usually the biggest part of a home's energy use, so a degree off the thermostat matters.",
  'Repairing something usually beats recycling it: the energy and materials in the object are kept, not just its raw material.',
  'Standby power is small per device, but it adds up over a whole home. A switchable power strip turns it all off in one tap.',
];

export const JOKES: readonly string[] = [
  'Why did the tree get kicked out of the group chat? Too many branches in the conversation.',
  'What do you call a tree that does maths? A root-ine.',
  "I'd tell you a joke about compost, but it's still developing.",
];

/** Foods, in words: ordered roughly from highest to lowest footprint per serving. */
export const FOOD_LADDER =
  'Beef and lamb sit at the top by a wide margin, then cheese and farmed prawns, then pork, chicken and eggs, and lowest of all are beans, lentils, vegetables, fruit and grains.';

export const DINNER_IDEAS: readonly string[] = [
  'lentil bolognese',
  'chickpea and spinach curry',
  'veggie stir-fry with tofu',
  'bean and sweet-potato chilli',
  'mushroom and barley stew',
  'dal with rice and greens',
];

/** Crisis answer. Never coaches; points to people. Resource names are real and international. */
export const CRISIS_REPLY =
  "I'm really sorry you're carrying this. You matter more than any habit or number in this app, and I'm only a built-in coach, so I can't be the support you deserve right now.\n\nPlease reach out to someone who can help: if you might act on these thoughts or are in immediate danger, call your local emergency number now. In the US you can call or text 988; findahelpline.com lists free, confidential lines in most countries. If you can, tell someone you trust how you're feeling today.\n\nThe tree will be here whenever you want to come back.";
