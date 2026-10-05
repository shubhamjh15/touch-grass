import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const WHERE_IT_COMES_FROM: Lesson = {
  id: 'where-it-comes-from',
  title: 'Where emissions actually come from',
  summary:
    'What CO2e means, which parts of life drive a footprint, and why numbers are not everything.',
  category: 'climate',
  focus: ['eat', 'move', 'power'],
  readingMinutes: 3,
  sections: [
    {
      id: 'one-unit',
      heading: 'One unit for many gases',
      blocks: [
        {
          kind: 'p',
          text: 'A footprint adds up different gases, so it needs one common unit: CO2e, "carbon dioxide equivalent". It says how much CO2 would have the same warming effect.',
        },
        {
          kind: 'p',
          text: 'Over 100 years, a tonne of methane warms the planet about 27 to 30 times as much as a tonne of CO2. Nitrous oxide is about 270 times. Over 20 years, methane is about 80 times, which is why cutting it works fast.',
        },
        {
          kind: 'fact',
          stat: '27–30×',
          text: 'Methane versus CO2, tonne for tonne, over 100 years.',
          source: 'ipccAR6wg1ch7',
        },
      ],
    },
    {
      id: 'whole-world',
      heading: 'The whole world, in one paragraph',
      blocks: [
        {
          kind: 'p',
          text: 'The world emitted about 57.7 billion tonnes of CO2e in 2024. Roughly three-quarters comes from energy: electricity and heat, transport, buildings and industry. About a fifth comes from farming, forestry and land use. The rest is industrial processes such as cement, and waste.',
        },
        {
          kind: 'fact',
          stat: '73% · 18% · 5%',
          text: 'Energy, agriculture with land use, and industrial processes, as shares of global emissions.',
          source: 'owidSectors',
        },
      ],
    },
    {
      id: 'one-person',
      heading: 'Zoom in to one person',
      blocks: [
        {
          kind: 'p',
          text: 'In a wealthy country the same picture shows up as four piles: getting around, powering and heating a home, food, and stuff. The global average is about 6.7 tonnes of CO2e per person a year with every source counted.',
        },
        {
          kind: 'p',
          text: 'One widely used benchmark puts a 1.5 °C-compatible lifestyle footprint at about 2.5 tonnes per person by 2030. That is the part households steer, so it is smaller than the 6.7 tonnes above, which includes industry and public services.',
        },
      ],
    },
    {
      id: 'unequal',
      heading: 'Footprints are very unequal',
      blocks: [
        {
          kind: 'p',
          text: 'The highest-emitting 10% of households cause 34 to 45% of household emissions, according to the IPCC. Oxfam and the Stockholm Environment Institute put the richest 10% at about half of consumption CO2.',
        },
        {
          kind: 'p',
          text: 'That is not a reason to feel guilty. It is a reason to look at where the big levers are.',
        },
      ],
    },
    {
      id: 'both-halves',
      heading: 'You need both halves',
      blocks: [
        {
          kind: 'p',
          text: "Measuring your own slice is useful, because it shows where your levers are. It never replaces changing the systems that set everyone's defaults. You need both. This app is for the first half, and it gets more fun when you start with the biggest piece.",
        },
        {
          kind: 'action',
          actionId: 'plant-based-meal',
          text: 'Do this today: log a plant-based meal and see the number for yourself.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'plant-based-meal', label: 'Have a plant-based meal' },
    { actionId: 'bus-instead-of-car', label: 'Take the bus instead of the car' },
  ],
  quiz: [
    {
      id: 'where-it-comes-from-q1',
      prompt: 'What does "CO2e" mean?',
      options: [
        'CO2 from electricity only',
        'All greenhouse gases, expressed as the amount of CO2 with the same warming effect',
        '"Extra" CO2',
      ],
      correct: 1,
      explanation: 'It lets methane, nitrous oxide and CO2 be added together in one number.',
    },
    {
      id: 'where-it-comes-from-q2',
      prompt: 'Roughly what share of global emissions comes from energy use?',
      options: ['A quarter', 'About three-quarters', 'Half'],
      correct: 1,
      explanation:
        'Electricity and heat, transport, buildings and industry dominate. Farming and land use add about a fifth.',
    },
    {
      id: 'where-it-comes-from-q3',
      prompt:
        'Over 100 years, a tonne of methane warms the planet about ___ times as much as a tonne of CO2.',
      options: ['1', '1,000', '27 to 30'],
      correct: 2,
      explanation: 'And about 80 times over 20 years, which is why cutting methane works fast.',
    },
  ],
  sources: sourcesFor(
    'ipccAR6wg1ch7',
    'unepEgr2025',
    'owidSectors',
    'gcbOwidPerCapita',
    'hotOrCool2021',
    'ipccAR6wg3',
    'oxfamSei2023',
  ),
  claims: [
    {
      id: 'where-gwp100',
      figure: '27 to 30',
      statement: 'GWP-100 of methane is 27 (non-fossil) to 29.8 (fossil).',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
      note: 'IPCC AR6 WG1 Table 7.15.',
    },
    {
      id: 'where-gwp100-short',
      figure: '27–30×',
      statement: 'Same figure as the callout.',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
    },
    {
      id: 'where-n2o',
      figure: '270',
      statement: 'GWP-100 of nitrous oxide is 273, rounded to about 270.',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
    },
    {
      id: 'where-gwp20',
      figure: '80',
      statement: 'GWP-20 of methane is roughly 80 (79.7 non-fossil, 82.5 fossil).',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
      note: 'From IPCC AR6 WG1 Table 7.15; the 20-year column was not re-fetched on 2026-10-06 (the 100-year column was).',
    },
    {
      id: 'where-100yr',
      figure: '100 years',
      statement: 'The conventional time horizon for CO2e (GWP-100).',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
    },
    {
      id: 'where-20yr',
      figure: '20 years',
      statement: 'The shorter horizon at which methane is about 80 times CO2.',
      source: 'ipccAR6wg1ch7',
      basis: 'web',
    },
    {
      id: 'where-total',
      figure: '57.7 billion tonnes',
      statement: 'Global greenhouse gas emissions reached 57.7 GtCO2e in 2024, up 2.3%.',
      source: 'unepEgr2025',
      basis: 'web',
    },
    {
      id: 'where-energy',
      figure: '73%',
      statement: 'Energy use is 73.2% of global greenhouse gas emissions.',
      source: 'owidSectors',
      basis: 'web',
    },
    {
      id: 'where-agri',
      figure: '18%',
      statement: 'Agriculture, forestry and land use are 18.4% of global emissions.',
      source: 'owidSectors',
      basis: 'web',
    },
    {
      id: 'where-industry',
      figure: '5%',
      statement: 'Industrial processes are 5.2% of global emissions.',
      source: 'owidSectors',
      basis: 'web',
    },
    {
      id: 'where-per-person',
      figure: '6.7 tonnes',
      statement:
        'World average greenhouse gas emissions including land use were 6.669 tCO2e per person in 2024.',
      source: 'gcbOwidPerCapita',
      basis: 'dataset',
      note: 'per_capita_emissions, WORLD row, ghgInclLandUse.',
    },
    {
      id: 'where-benchmark',
      figure: '2.5 tonnes',
      statement:
        'The 1.5-degree lifestyle benchmark for 2030 is 2.5 tCO2e per person per year (range 2.5 to 3.2).',
      source: 'hotOrCool2021',
      basis: 'evidence-base',
      note: 'An equal-per-capita benchmark that ignores historical responsibility; a guide, not a law of nature.',
    },
    {
      id: 'where-top10-ipcc',
      figure: '34 to 45%',
      statement:
        'The 10% of households with the highest per-capita emissions contribute 34–45% of consumption-based household emissions.',
      source: 'ipccAR6wg3',
      basis: 'evidence-base',
      note: 'IPCC AR6 WG3 SPM B.3.4.',
    },
    {
      id: 'where-top10-oxfam',
      figure: 'about half',
      statement:
        'The richest 10% were responsible for about 50% of consumption CO2 emissions in 2019.',
      source: 'oxfamSei2023',
      basis: 'web',
    },
    {
      id: 'where-quarter-third',
      figure: '1.5 °C',
      statement: 'The 1.5 °C target the benchmark is built on.',
      source: 'hotOrCool2021',
      basis: 'evidence-base',
    },
  ],
  reviewBy: '2027-10-06',
};
