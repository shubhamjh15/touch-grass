import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const STUFF: Lesson = {
  id: 'stuff',
  title: 'Stuff: the footprint you wear and carry',
  summary:
    'Most of a product’s footprint is made before you own it, so using things longer is the win.',
  category: 'stuff',
  focus: ['stuff'],
  readingMinutes: 2,
  sections: [
    {
      id: 'made-before',
      heading: 'The footprint is made before you buy',
      blocks: [
        {
          kind: 'p',
          text: "For most things you own, the emissions happened before you bought them: digging, refining, making, shipping. A smartphone is the classic case. Apple's own report puts production and transport at about 80% of an iPhone 17's life-cycle emissions. Using it, over an assumed three years, is about 18%.",
        },
        {
          kind: 'fact',
          stat: '≈ 80%',
          text: "Share of an iPhone 17's life-cycle emissions from production and transport, before you switch it on.",
          source: 'appleIphone17',
        },
        {
          kind: 'p',
          text: 'So the simplest cut is also the least exciting: keep your phone for another year or two.',
        },
      ],
    },
    {
      id: 'ewaste',
      heading: 'Where devices end up',
      blocks: [
        {
          kind: 'p',
          text: 'The world produced a record 62 million tonnes of e-waste in 2022. Only 22.3% of it was documented as properly collected and recycled. Old phones, cables and chargers are worth taking to a proper drop-off point rather than a drawer or a bin.',
        },
      ],
    },
    {
      id: 'clothes',
      heading: 'Clothes work the same way',
      blocks: [
        {
          kind: 'p',
          text: "Fashion's trend is clear even where exact shares are debated: more garments, each worn fewer times. In a life-cycle study of Levi's 501 jeans, about 37% of the climate impact came from how consumers wash and dry them, not from making them.",
        },
        {
          kind: 'p',
          text: 'That is good news. Wearing clothes more often, washing less and cooler, and air-drying are all in your hands.',
        },
      ],
    },
    {
      id: 'circular',
      heading: 'The circular idea in three lines',
      blocks: [
        {
          kind: 'list',
          items: [
            'Design out waste and pollution.',
            'Keep products and materials in use.',
            'Regenerate nature.',
          ],
        },
        {
          kind: 'p',
          text: 'One honest note: buying second-hand or repairing does not always replace a new purchase. Some of the time the item would not have been bought at all. EcoQuest counts only part of the saving for that reason.',
        },
      ],
    },
    {
      id: 'order-of-play',
      heading: 'Your order of play',
      blocks: [
        {
          kind: 'list',
          items: [
            'Use what you have.',
            'Borrow or rent.',
            'Buy second-hand.',
            'Repair.',
            'Buy new and durable.',
            'Recycle properly at the end.',
          ],
        },
        {
          kind: 'action',
          actionId: 'repair-instead-of-replace',
          text: 'Do this today: fix, patch or mend one thing instead of replacing it.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'repair-instead-of-replace', label: 'Repair instead of replacing' },
    { actionId: 'second-hand-tshirt', label: 'Buy a second-hand T-shirt' },
  ],
  quiz: [
    {
      id: 'stuff-q1',
      prompt: 'For a typical smartphone, most lifetime emissions come from…',
      options: ['Charging it', 'Streaming video on it', 'Making it'],
      correct: 2,
      explanation: 'Production and transport are about 80%, so keeping it longer is the lever.',
    },
    {
      id: 'stuff-q2',
      prompt:
        "In 2022, what share of the world's e-waste was documented as properly collected and recycled?",
      options: ['About 60%', 'About 22%', 'About 90%'],
      correct: 1,
      explanation: 'Global E-waste Monitor 2024: 22.3%.',
    },
    {
      id: 'stuff-q3',
      prompt: 'When you "need" something, the lowest-footprint option is usually to…',
      options: [
        'Buy the new "eco" version',
        'Use or repair what you already have',
        'Buy two so one is spare',
      ],
      correct: 1,
      explanation: 'The greenest product is the one that already exists.',
    },
  ],
  sources: sourcesFor('appleIphone17', 'ewaste2024', 'levis2015', 'ellenMacArthur'),
  claims: [
    {
      id: 'stuff-iphone-before',
      figure: '80%',
      statement:
        'iPhone 17 (256 GB), 55 kg CO2e over its life: production 53% + 23% (electricity) and transportation 4% add up to 80%.',
      source: 'appleIphone17',
      basis: 'evidence-base',
      note: "Apple's numbers for one configuration; it assumes three years of use.",
    },
    {
      id: 'stuff-iphone-before-callout',
      figure: '≈ 80%',
      statement: 'Same as above, in the callout.',
      source: 'appleIphone17',
      basis: 'derived',
    },
    {
      id: 'stuff-iphone-use',
      figure: '18%',
      statement: 'Use accounts for 18% of the life-cycle emissions.',
      source: 'appleIphone17',
      basis: 'evidence-base',
    },
    {
      id: 'stuff-iphone-years',
      figure: 'three years',
      statement: 'Apple assumes three years of use for an iPhone.',
      source: 'appleIphone17',
      basis: 'evidence-base',
    },
    {
      id: 'stuff-iphone-model',
      figure: 'iPhone 17',
      statement: 'The product the report covers.',
      source: 'appleIphone17',
      basis: 'evidence-base',
    },
    {
      id: 'stuff-ewaste',
      figure: '62 million tonnes',
      statement: 'A record 62 Mt of e-waste was produced in 2022.',
      source: 'ewaste2024',
      basis: 'web',
    },
    {
      id: 'stuff-ewaste-recycled',
      figure: '22.3%',
      statement: 'Less than a quarter (22.3%) was documented as properly collected and recycled.',
      source: 'ewaste2024',
      basis: 'web',
    },
    {
      id: 'stuff-ewaste-quiz',
      figure: 'About 22%',
      statement: 'Quiz wording for 22.3%.',
      source: 'ewaste2024',
      basis: 'derived',
    },
    {
      id: 'stuff-jeans',
      figure: '37%',
      statement: 'Consumer care is 12.5 of 33.4 kg CO2e for a pair of 501 jeans, which is 37%.',
      source: 'levis2015',
      basis: 'evidence-base',
      note: "Levi's own 2015 study of one product, using its consumer-behaviour assumptions.",
    },
    {
      id: 'stuff-jeans-model',
      figure: '501',
      statement: 'The jeans model the study covers.',
      source: 'levis2015',
      basis: 'evidence-base',
    },
  ],
  reviewBy: '2027-10-06',
};
