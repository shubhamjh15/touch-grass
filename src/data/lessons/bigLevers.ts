import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const BIG_LEVERS: Lesson = {
  id: 'big-levers',
  title: 'Big levers vs. small gestures',
  summary:
    'Everyday actions differ in impact by a factor of ten or more. Here is how to spend your effort well.',
  category: 'action',
  focus: ['move', 'eat', 'power'],
  readingMinutes: 3,
  sections: [
    {
      id: 'ten-times',
      heading: 'Some actions are ten times bigger',
      blocks: [
        {
          kind: 'p',
          text: 'Green actions are not equal. A much-cited 2017 review by Wynes and Nicholas looked at what people in high-income countries can do and compared the typical yearly savings.',
        },
        {
          kind: 'list',
          items: [
            'Living car-free: about 2.4 tonnes CO2e a year.',
            'Skipping one transatlantic round trip: about 1.6 tonnes.',
            'Eating a plant-based diet: about 0.8 tonnes.',
            'Recycling thoroughly: about 0.2 tonnes.',
            'Swapping lightbulbs: about 0.1 tonnes.',
          ],
        },
        {
          kind: 'fact',
          stat: '2.4 t vs 0.2 t',
          text: 'Living car-free against recycling thoroughly, per person per year, in a high-income country.',
          source: 'wynes2017',
        },
      ],
    },
    {
      id: 'your-numbers-differ',
      heading: 'Your numbers will differ',
      blocks: [
        {
          kind: 'p',
          text: 'Those are averages for rich countries. If you already live without a car, or never fly, the big levers have been pulled for you. If you live somewhere with a very clean grid, home electricity matters less. The ranking is a guide to where to look first, not a score.',
        },
      ],
    },
    {
      id: 'small-matter',
      heading: 'So are small actions pointless?',
      blocks: [
        {
          kind: 'p',
          text: 'No. Small actions are where habits start. They cost nothing, they make the next step feel normal, and the people around you notice them.',
        },
        {
          kind: 'p',
          text: 'Just do not let a tote bag be the whole plan. A workable rule is one big lever, a handful of easy habits, and your voice.',
        },
      ],
    },
    {
      id: 'systems',
      heading: 'It is not individuals versus systems',
      blocks: [
        {
          kind: 'p',
          text: 'The IPCC estimates that demand-side changes, meaning how we move, eat and use buildings, could cut emissions in those sectors by 40 to 70% by 2050. That only happens if infrastructure and policy make the better choice the easy one.',
        },
        {
          kind: 'fact',
          stat: '40–70%',
          text: 'Possible cut in end-use sector emissions by 2050 from demand-side changes, with supporting policy.',
          source: 'ipccAR6wg3',
        },
        {
          kind: 'p',
          text: 'So your choices count, and so do your vote and your voice.',
        },
      ],
    },
    {
      id: 'how-we-count',
      heading: 'How EcoQuest handles this',
      blocks: [
        {
          kind: 'p',
          text: 'XP rewards effort, so every lifestyle can play, whether or not a car is part of your life. The ≈ kg figure shows impact honestly, so you can see what moves the needle.',
        },
        {
          kind: 'action',
          actionId: 'car-free-day',
          text: 'Do this today: log a car-free day if you went without one.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'car-free-day', label: 'Log a car-free day' },
    { actionId: 'plant-based-meal', label: 'Have a plant-based meal' },
  ],
  quiz: [
    {
      id: 'big-levers-q1',
      prompt: 'For someone in a high-income country, which usually saves the most CO2e in a year?',
      options: ['Recycling thoroughly', 'Switching to LED bulbs', 'Living car-free'],
      correct: 2,
      explanation:
        'Roughly 2.4 t, against 0.2 t for recycling and 0.1 t for bulbs in the Wynes and Nicholas review.',
    },
    {
      id: 'big-levers-q2',
      prompt:
        'According to the IPCC, demand-side changes could cut end-use sector emissions by 2050 by…',
      options: ['40 to 70%', '1 to 5%', '10 to 15%'],
      correct: 0,
      explanation: 'With supporting infrastructure and policy. It is both and, not either or.',
    },
    {
      id: 'big-levers-q3',
      prompt: 'Why does EcoQuest still reward small actions?',
      options: [
        'They save more carbon than flying less',
        'They build the habit, even though bigger levers matter more',
        'It does not: small actions earn nothing',
      ],
      correct: 1,
      explanation: 'XP tracks effort. The ≈ kg figure tells you the impact.',
    },
  ],
  sources: sourcesFor('wynes2017', 'ipccAR6wg3'),
  claims: [
    {
      id: 'levers-carfree',
      figure: '2.4 tonnes',
      statement: 'Living car-free saves about 2.4 tCO2e per year.',
      source: 'wynes2017',
      basis: 'evidence-base',
      note: 'Per person, high-income countries. Also confirmed against the paper’s summary on 2026-10-06.',
    },
    {
      id: 'levers-flight',
      figure: '1.6 tonnes',
      statement: 'One transatlantic round trip is about 1.6 tCO2e.',
      source: 'wynes2017',
      basis: 'evidence-base',
    },
    {
      id: 'levers-diet',
      figure: '0.8 tonnes',
      statement: 'A plant-based diet saves about 0.8 tCO2e per year.',
      source: 'wynes2017',
      basis: 'evidence-base',
    },
    {
      id: 'levers-recycling',
      figure: '0.2 tonnes',
      statement: 'Thorough recycling saves about 0.2 tCO2e per year (0.21 in the paper).',
      source: 'wynes2017',
      basis: 'evidence-base',
    },
    {
      id: 'levers-bulbs',
      figure: '0.1 tonnes',
      statement:
        'Changing household lightbulbs saves about 0.1 tCO2e per year; the authors call it eight times less than a plant-based diet.',
      source: 'wynes2017',
      basis: 'web',
    },
    {
      id: 'levers-short',
      figure: '2.4 t vs 0.2 t',
      statement: 'Same figures as above, in the callout.',
      source: 'wynes2017',
      basis: 'derived',
    },
    {
      id: 'levers-short-2',
      figure: '2.4 t',
      statement: 'Same as the car-free figure.',
      source: 'wynes2017',
      basis: 'derived',
    },
    {
      id: 'levers-short-3',
      figure: '0.2 t',
      statement: 'Same as the recycling figure.',
      source: 'wynes2017',
      basis: 'derived',
    },
    {
      id: 'levers-short-4',
      figure: '0.1 t',
      statement: 'Same as the lightbulb figure.',
      source: 'wynes2017',
      basis: 'derived',
    },
    {
      id: 'levers-demand',
      figure: '40 to 70%',
      statement:
        'Demand-side measures can reduce global GHG emissions in end-use sectors by 40–70% by 2050 compared with baseline scenarios.',
      source: 'ipccAR6wg3',
      basis: 'evidence-base',
      note: 'IPCC AR6 WG3 SPM C.10, high confidence.',
    },
    {
      id: 'levers-demand-callout',
      figure: '40–70%',
      statement: 'Same as above, in the callout.',
      source: 'ipccAR6wg3',
      basis: 'derived',
    },
    {
      id: 'levers-year',
      figure: '2050',
      statement: 'Horizon of the IPCC demand-side estimate.',
      source: 'ipccAR6wg3',
      basis: 'evidence-base',
    },
    {
      id: 'levers-tenx',
      figure: 'ten times',
      statement: 'Roughly 2.4 t compared with 0.2 t is a factor of ten or more.',
      source: 'wynes2017',
      basis: 'derived',
    },
  ],
  reviewBy: '2027-10-06',
};
