import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const GETTING_AROUND: Lesson = {
  id: 'getting-around',
  title: 'Getting around',
  summary: 'Compare ways of travelling and spot the trip changes that matter most.',
  category: 'move',
  focus: ['move'],
  readingMinutes: 3,
  sections: [
    {
      id: 'share',
      heading: 'Transport in the big picture',
      blocks: [
        {
          kind: 'p',
          text: 'Transport produces about 16% of global greenhouse gas emissions, and road vehicles are roughly three-quarters of that. How you travel changes the footprint of the very same trip enormously.',
        },
      ],
    },
    {
      id: 'per-km',
      heading: 'Per passenger-kilometre',
      blocks: [
        {
          kind: 'p',
          text: 'These are UK government conversion factors, in grams of CO2e for one person travelling one kilometre.',
        },
        {
          kind: 'list',
          items: [
            'Domestic flight: about 260 g, counting the extra warming from flying at altitude.',
            'Driving alone in an average car: about 210 g, fuel production included.',
            'Average local bus: about 130 g, and less when it is full.',
            'Coach: under 50 g.',
            'National rail: about 40 g.',
            'Walking and cycling: close to zero.',
          ],
        },
        {
          kind: 'fact',
          stat: '≈ 40 g vs 210 g',
          text: 'Grams of CO2e per passenger-kilometre: national rail against driving alone.',
          source: 'desnz2026',
        },
        {
          kind: 'p',
          text: 'Sharing a car halves emissions per person. These are UK values, so numbers elsewhere will differ, but the order is much the same.',
        },
      ],
    },
    {
      id: 'flying',
      heading: 'Flying looks small, but it is not',
      blocks: [
        {
          kind: 'p',
          text: 'Aviation is about 2.5% of global CO2. Once contrails and other non-CO2 effects are counted, it has caused around 4% of warming so far. For people who fly, flights are often the largest single item in their footprint.',
        },
      ],
    },
    {
      id: 'electric',
      heading: 'Electric cars are a real improvement',
      blocks: [
        {
          kind: 'p',
          text: 'Building a battery adds emissions up front, but they are paid back after roughly 17,000 km. Over the whole life, including the battery, an electric car sold in Europe today emits about 73% less than a petrol car, according to the ICCT.',
        },
        {
          kind: 'fact',
          stat: '−73%',
          text: 'Lifetime emissions of a new electric car in Europe against a petrol car (63 g against 235 g per km).',
          source: 'icct2025',
        },
      ],
    },
    {
      id: 'order',
      heading: 'A useful order of questions',
      blocks: [
        {
          kind: 'list',
          items: [
            'Can I avoid or combine the trip?',
            'Can I shift it: walk, cycle, bus or train?',
            'If I must drive, can I share, or go electric?',
          ],
        },
        {
          kind: 'p',
          text: 'Short car trips are the easiest target. In the United States, about half of all trips are shorter than 3 miles (5 km).',
        },
        {
          kind: 'action',
          actionId: 'walk-cycle-instead-of-car',
          text: 'Do this today: take one short trip on foot or by bike.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'walk-cycle-instead-of-car', label: 'Walk or cycle instead of driving' },
    { actionId: 'train-metro-instead-of-car', label: 'Take the train or metro' },
  ],
  quiz: [
    {
      id: 'getting-around-q1',
      prompt: 'Per passenger-kilometre, which is typically lowest-carbon?',
      options: ['Driving alone', 'A domestic flight', 'The train'],
      correct: 2,
      explanation: 'Rail is several times lower than a solo petrol car.',
    },
    {
      id: 'getting-around-q2',
      prompt: 'Aviation is about 2.5% of global CO2. Its share of warming so far is about…',
      options: ['0.5%', '25%', '4%'],
      correct: 2,
      explanation: 'Contrails and other non-CO2 effects add to the CO2.',
    },
    {
      id: 'getting-around-q3',
      prompt: 'Over its whole life, an electric car sold in Europe today emits ___ a petrol car.',
      options: ['More than', 'Roughly 70% less than', 'About the same as'],
      correct: 1,
      explanation: 'ICCT 2025, battery production included.',
    },
  ],
  sources: sourcesFor(
    'owidSectors',
    'desnz2026',
    'owidAviation',
    'kloewer2021',
    'icct2025',
    'doeTrips',
  ),
  claims: [
    {
      id: 'move-share',
      figure: '16%',
      statement: 'Transport is about 16% of global greenhouse gas emissions.',
      source: 'owidSectors',
      basis: 'web',
      note: 'Our World in Data sector breakdown (16.2%); road transport alone is almost 12%, close to three-quarters of it.',
    },
    {
      id: 'move-flight',
      figure: '260 g',
      statement: 'Domestic flight, including non-CO2 effects: 0.2628 kg CO2e per passenger-km.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'move-car',
      figure: '210 g',
      statement: 'Average car, tailpipe plus fuel production: 0.2099 kg CO2e per km.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'move-bus',
      figure: '130 g',
      statement: 'Average local bus: 0.128 kg CO2e per passenger-km.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'move-coach',
      figure: '50 g',
      statement: 'Coach: 0.046 kg CO2e per passenger-km.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'move-rail',
      figure: '40 g',
      statement: 'National rail: 0.0399 kg CO2e per passenger-km.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'move-callout',
      figure: '≈ 40 g vs 210 g',
      statement: 'Rail 0.0399 against car 0.2099.',
      source: 'desnz2026',
      basis: 'derived',
    },
    {
      id: 'move-aviation-co2',
      figure: '2.5%',
      statement: 'Aviation accounted for 2.5% of CO2 emissions in 2019.',
      source: 'owidAviation',
      basis: 'web',
    },
    {
      id: 'move-aviation-warming',
      figure: '4%',
      statement:
        'Aviation has contributed about 4% of human-caused warming to date, with non-CO2 effects counted (2.4% of CO2 in the underlying study).',
      source: 'kloewer2021',
      basis: 'web',
    },
    {
      id: 'move-payback',
      figure: '17,000 km',
      statement: 'Extra battery-production emissions are more than offset after around 17,000 km.',
      source: 'icct2025',
      basis: 'web',
    },
    {
      id: 'move-ev',
      figure: '73%',
      statement:
        'A battery-electric car sold in Europe emits 73% less over its lifetime than a petrol car.',
      source: 'icct2025',
      basis: 'web',
    },
    {
      id: 'move-ev-grams',
      figure: '63 g against 235 g',
      statement:
        '63 g CO2e per km for a BEV on the projected 2025–2044 EU mix against 235 g for a petrol car.',
      source: 'icct2025',
      basis: 'web',
    },
    {
      id: 'move-ev-short',
      figure: '−73%',
      statement: 'Same as above.',
      source: 'icct2025',
      basis: 'web',
    },
    {
      id: 'move-ev-70',
      figure: '70%',
      statement: 'Quiz wording for 73%, rounded down.',
      source: 'icct2025',
      basis: 'derived',
    },
    {
      id: 'move-trips',
      figure: '3 miles (5 km)',
      statement: 'About half of US trips are under three miles (50% in the NHTS; 52% in 2021).',
      source: 'doeTrips',
      basis: 'web',
    },
  ],
  reviewBy: '2027-10-06',
};
