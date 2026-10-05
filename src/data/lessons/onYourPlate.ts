import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const ON_YOUR_PLATE: Lesson = {
  id: 'on-your-plate',
  title: "What's on your plate",
  summary: 'Which food choices change your footprint most, and which ones barely matter.',
  category: 'eat',
  focus: ['eat'],
  readingMinutes: 3,
  sections: [
    {
      id: 'big-slice',
      heading: 'Food is a big slice',
      blocks: [
        {
          kind: 'p',
          text: "Food production causes about a quarter of the world's greenhouse gas emissions. And what dominates is not packaging or distance. It is the kind of food.",
        },
      ],
    },
    {
      id: 'kinds',
      heading: 'The kind of food is what counts',
      blocks: [
        {
          kind: 'p',
          text: 'The largest global dataset, by Poore and Nemecek, averages emissions per kilogram of food from farm to shop. The gaps are huge.',
        },
        {
          kind: 'list',
          items: [
            'Beef from beef herds: about 100 kg CO2e per kg.',
            'Beef from dairy herds: about 33 kg.',
            'Pork: about 12 kg. Chicken: about 10 kg.',
            'Peas, other pulses and tofu: about 1 to 3 kg.',
          ],
        },
        {
          kind: 'fact',
          stat: '≈ 100 vs 1',
          text: 'Kilograms of CO2e per kilogram of food: beef from a beef herd against peas.',
          source: 'pnFoodKg',
        },
        {
          kind: 'p',
          text: "Cattle belch methane and need a lot of land and feed. Livestock uses about three-quarters of the world's farmland yet supplies about 18% of its calories.",
        },
      ],
    },
    {
      id: 'local',
      heading: '"Eat local" is weaker advice than it sounds',
      blocks: [
        {
          kind: 'p',
          text: 'For most foods, transport is under 10% of the footprint. For beef it is about 0.5%. So what you eat matters far more than where it came from.',
        },
        {
          kind: 'p',
          text: 'The exception is food that arrives by air, often out-of-season berries or green beans. Air freight is far more carbon-hungry than shipping. Seasonal food is lovely, but it is not the first lever.',
        },
      ],
    },
    {
      id: 'graded',
      heading: 'Think in steps, not all or nothing',
      blocks: [
        {
          kind: 'p',
          text: 'Beef and lamb, then chicken, eggs or fish, then beans, lentils and tofu. Each step down the ladder helps. Swapping beef for beans a few times a week captures much of the gain without anyone becoming vegan overnight.',
        },
        {
          kind: 'p',
          text: 'And waste less of what you buy. That is the next lesson.',
        },
      ],
    },
    {
      id: 'try-it',
      heading: 'Try it this week',
      blocks: [
        {
          kind: 'p',
          text: 'Pick one meal you already half-like in a plant-based version, or one dinner where chicken replaces beef. Make it the easy kind: a dish you would cook anyway.',
        },
        {
          kind: 'action',
          actionId: 'chicken-instead-of-beef',
          text: 'Do this today: log a chicken-instead-of-beef swap, or a plant-based meal.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'chicken-instead-of-beef', label: 'Chicken instead of beef' },
    { actionId: 'plant-based-meal', label: 'Have a plant-based meal' },
  ],
  quiz: [
    {
      id: 'on-your-plate-q1',
      prompt: "Which swap usually cuts a meal's footprint most?",
      options: [
        'Imported veg to local veg',
        'Plastic-wrapped to loose veg',
        'Beef to beans or lentils',
      ],
      correct: 2,
      explanation: 'The type of food dwarfs transport and packaging.',
    },
    {
      id: 'on-your-plate-q2',
      prompt: 'For most foods, transport is what share of the footprint?',
      options: ['About half', 'Typically under 10%', 'Nearly all'],
      correct: 1,
      explanation: 'Air-freighted produce is the main exception.',
    },
    {
      id: 'on-your-plate-q3',
      prompt:
        "Livestock uses about three-quarters of the world's farmland. What share of our calories does it supply?",
      options: ['About 18%', 'About 50%', 'About 75%'],
      correct: 0,
      explanation: 'Animal products are land-hungry per calorie.',
    },
  ],
  sources: sourcesFor('pnFoodKg', 'owidFoodLocal', 'owidLand'),
  claims: [
    {
      id: 'plate-quarter',
      figure: 'a quarter',
      statement:
        'Food production is responsible for about one quarter of global greenhouse gas emissions (Poore and Nemecek 2018).',
      source: 'owidFoodLocal',
      basis: 'web',
      note: 'Other studies count more of the supply chain and report up to about a third.',
    },
    {
      id: 'plate-beef-herd',
      figure: '100 kg',
      statement: 'Beef from beef herds averages 99.48 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'evidence-base',
      note: 'Farm to retail, including land-use change; a global mean.',
    },
    {
      id: 'plate-beef-dairy',
      figure: '33 kg',
      statement: 'Beef from dairy herds averages 33.3 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'evidence-base',
    },
    {
      id: 'plate-pork',
      figure: '12 kg',
      statement: 'Pig meat averages 12.31 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'evidence-base',
    },
    {
      id: 'plate-chicken',
      figure: '10 kg',
      statement: 'Poultry meat averages 9.87 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'evidence-base',
    },
    {
      id: 'plate-pulses',
      figure: '1 to 3 kg',
      statement: 'Peas average 0.98, other pulses 1.79 and tofu 3.16 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'evidence-base',
    },
    {
      id: 'plate-ratio',
      figure: '≈ 100 vs 1',
      statement: 'Beef herd 99.48 against peas 0.98 kg CO2e per kg.',
      source: 'pnFoodKg',
      basis: 'derived',
    },
    {
      id: 'plate-land',
      figure: 'three-quarters',
      statement: 'Livestock accounts for 77% of global farming land, including land used for feed.',
      source: 'owidLand',
      basis: 'web',
    },
    {
      id: 'plate-calories',
      figure: '18%',
      statement: "Livestock supplies 18% of the world's calories (and 37% of protein).",
      source: 'owidLand',
      basis: 'web',
    },
    {
      id: 'plate-transport',
      figure: '10%',
      statement: 'For most foods, transport is less than 10% of the footprint.',
      source: 'owidFoodLocal',
      basis: 'web',
    },
    {
      id: 'plate-transport-beef',
      figure: '0.5%',
      statement: 'Transport is about 0.5% of the footprint of beef.',
      source: 'owidFoodLocal',
      basis: 'web',
    },
  ],
  reviewBy: '2027-10-06',
};
