import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const FOOD_WE_NEVER_EAT: Lesson = {
  id: 'food-we-never-eat',
  title: 'The food we never eat',
  summary: 'Food waste is a climate problem you can shrink in your own kitchen this week.',
  category: 'eat',
  focus: ['eat', 'waste'],
  readingMinutes: 3,
  sections: [
    {
      id: 'scale',
      heading: 'How much gets thrown away',
      blocks: [
        {
          kind: 'p',
          text: 'In 2022 the world threw away about 1.05 billion tonnes of food in shops, restaurants and homes. That is roughly a fifth of all the food available to consumers. More is lost earlier, between the farm and the shop.',
        },
        {
          kind: 'fact',
          stat: '60%',
          text: 'Share of that consumer-level waste that happens in households.',
          source: 'unepFwi2024',
        },
      ],
    },
    {
      id: 'climate',
      heading: 'Why it matters for the climate',
      blocks: [
        {
          kind: 'p',
          text: 'Food loss and waste cause an estimated 8 to 10% of global greenhouse gas emissions. There are two reasons. Every emission from growing, chilling and carrying that food was for nothing. And food rotting in landfill, without oxygen, makes methane, a gas that traps about 80 times more heat than CO2 over 20 years.',
        },
      ],
    },
    {
      id: 'ours-to-fix',
      heading: 'Most of it is ours to fix',
      blocks: [
        {
          kind: 'p',
          text: 'Because so much of it happens at home, this is one of the rare problems you can shrink this week. Four moves cover most of it.',
        },
        {
          kind: 'list',
          items: [
            'Check the fridge before shopping and plan a few meals.',
            'Store food so it lasts, and freeze what you will not reach in time.',
            'Cook one "use-it-up" meal a week.',
            'Serve a little less, and save the rest for tomorrow.',
          ],
        },
      ],
    },
    {
      id: 'in-the-kitchen',
      heading: 'What it looks like in a kitchen',
      blocks: [
        {
          kind: 'p',
          text: 'Most waste is not dramatic. It is the half bag of salad, the heel of the loaf, the portion that was a bit too big. Shop with a list, and put older food at the front of the fridge so it gets eaten first. Freeze bread, ripe bananas and spare portions in labelled containers.',
        },
        {
          kind: 'p',
          text: 'Wasting less food also means throwing away less money. That makes this one of the few climate habits that pays you back right away.',
        },
      ],
    },
    {
      id: 'labels',
      heading: 'Learn the labels',
      blocks: [
        {
          kind: 'p',
          text: '"Use by" is about safety. "Best before" is about quality. Food past its best-before date is often still fine, so look, smell and taste before you decide.',
        },
      ],
    },
    {
      id: 'compost',
      heading: 'And when it is truly inedible',
      blocks: [
        {
          kind: 'p',
          text: 'Composting what cannot be eaten keeps it out of landfill and returns nutrients to soil. But preventing waste always beats composting it, so start with the first one.',
        },
        {
          kind: 'action',
          actionId: 'meal-saved-from-waste',
          text: 'Do this today: eat something that was about to go off, and log it.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'meal-saved-from-waste', label: 'Save a meal from the bin' },
    { actionId: 'compost-food-waste', label: 'Compost food scraps' },
  ],
  quiz: [
    {
      id: 'food-we-never-eat-q1',
      prompt: 'Where does most consumer-level food waste happen?',
      options: ['In restaurants', 'In supermarkets', 'In households'],
      correct: 2,
      explanation: 'About 60%, according to the UN Environment Programme.',
    },
    {
      id: 'food-we-never-eat-q2',
      prompt: 'Food loss and waste cause roughly what share of global emissions?',
      options: ['Under 1%', '8 to 10%', '40%'],
      correct: 1,
      explanation: 'Wasted production emissions plus methane from landfill.',
    },
    {
      id: 'food-we-never-eat-q3',
      prompt: 'A "best before" date means…',
      options: [
        'The food is unsafe afterwards',
        'Bin it the day before',
        'Quality may dip afterwards, but it is often still fine to eat',
      ],
      correct: 2,
      explanation: '"Use by" is the safety date. Look, smell and taste for the rest.',
    },
  ],
  sources: sourcesFor('unepFwi2024', 'foodGovUk', 'warmOrganics', 'ipccAR6wg1ch7'),
  claims: [
    {
      id: 'waste-total',
      figure: '1.05 billion tonnes',
      statement:
        'About 1.05 billion tonnes of food were wasted at retail, food service and household level in 2022.',
      source: 'unepFwi2024',
      basis: 'web',
    },
    {
      id: 'waste-fifth',
      figure: 'a fifth',
      statement: '19% of food available to consumers was wasted.',
      source: 'unepFwi2024',
      basis: 'web',
    },
    {
      id: 'waste-households',
      figure: '60%',
      statement:
        '60% of the food wasted in 2022 was wasted in households (food service 28%, retail 12%).',
      source: 'unepFwi2024',
      basis: 'web',
    },
    {
      id: 'waste-ghg',
      figure: '8 to 10%',
      statement:
        'Food loss and waste are responsible for 8–10% of annual global greenhouse gas emissions.',
      source: 'unepFwi2024',
      basis: 'web',
    },
    {
      id: 'waste-year',
      figure: '2022',
      statement: 'Reference year of the Food Waste Index 2024.',
      source: 'unepFwi2024',
      basis: 'web',
    },
    {
      id: 'waste-gwp20',
      figure: '80 times',
      statement: 'GWP-20 of methane is roughly 80 (79.7 non-fossil, 82.5 fossil).',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
      note: 'From IPCC AR6 WG1 Table 7.15; the 20-year column was not re-fetched on 2026-10-06.',
    },
    {
      id: 'waste-20yr',
      figure: '20 years',
      statement: 'The shorter time horizon at which methane is about 80 times CO2.',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
    },
  ],
  reviewBy: '2027-10-06',
};
