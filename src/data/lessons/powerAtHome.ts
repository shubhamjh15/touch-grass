import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const POWER_AT_HOME: Lesson = {
  id: 'power-at-home',
  title: 'Power at home: heat is the big one',
  summary: 'Find the few home-energy habits that matter, and stop sweating the rest.',
  category: 'power',
  focus: ['power', 'water'],
  readingMinutes: 3,
  sections: [
    {
      id: 'not-equal',
      heading: 'Not every tip is equal',
      blocks: [
        {
          kind: 'p',
          text: 'Most home-energy advice treats every tip the same. They are not the same. In an average EU home, space heating is about 64% of energy use and hot water another 15%. Together that is almost four-fifths. Lighting and most appliances are about 14%.',
        },
        {
          kind: 'fact',
          stat: '64% + 15%',
          text: 'Share of EU household energy used for space heating and for hot water, 2022.',
          source: 'eurostatHouseholds2022',
        },
        {
          kind: 'p',
          text: 'In hot climates, cooling plays the same starring role. Either way, the habits that matter are about heat. In hot places that means the cooling equivalents: a slightly higher air-conditioning setting, and blinds closed against the afternoon sun.',
        },
      ],
    },
    {
      id: 'heat-habits',
      heading: 'The heat habits',
      blocks: [
        {
          kind: 'p',
          text: 'Most of these cost nothing, and they trim your bills as well as your footprint. They also stack: heating is the biggest piece of home energy, so even a small cut in it is a real slice of the whole.',
        },
        {
          kind: 'list',
          items: [
            'Turning the thermostat down 1 °C saves around 7% of your heating energy.',
            "About 90% of a washing machine's energy goes to heating the water, so 30 °C or cold is nearly free savings.",
            'Shorter showers cut hot water. Air-drying skips one of the hungriest appliances in the house.',
          ],
        },
      ],
    },
    {
      id: 'small-but-real',
      heading: 'Smaller, but real',
      blocks: [
        {
          kind: 'p',
          text: 'Standby power is an estimated 5 to 10% of household electricity. LED bulbs use at least 75% less electricity than old incandescent ones. These are worth doing once, then forgetting.',
        },
      ],
    },
    {
      id: 'bigger',
      heading: 'When you can make bigger changes',
      blocks: [
        {
          kind: 'p',
          text: 'Insulate and draught-proof first. Then think about a heat pump, which is three to five times more efficient than a gas boiler. Heat pumps work best in well-insulated homes, which is why insulation comes first. Renters can still ask a landlord, and everyone can ask a council or an employer.',
        },
      ],
    },
    {
      id: 'grid',
      heading: 'Where you live changes the maths',
      blocks: [
        {
          kind: 'p',
          text: "One kilowatt-hour does not always mean the same CO2. In 2025 France's grid averaged about 41 grams of CO2e per kWh and India's about 671. That is why EcoQuest asks for your region: the same habit can be worth very different amounts.",
        },
        {
          kind: 'action',
          actionId: 'thermostat-down-1c',
          text: 'Do this today: turn the heating down 1 °C, or wash one load at 30 °C or cold.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'thermostat-down-1c', label: 'Turn the heating down 1 °C' },
    { actionId: 'wash-cold-instead-of-40', label: 'Wash cold instead of at 40 °C' },
  ],
  quiz: [
    {
      id: 'power-at-home-q1',
      prompt: 'In a typical European home, most energy goes to…',
      options: ['Lighting', 'Space heating', 'Phone chargers'],
      correct: 1,
      explanation: 'About 64%, plus about 15% for hot water.',
    },
    {
      id: 'power-at-home-q2',
      prompt: 'Turning the thermostat down 1 °C saves about ___ of heating energy.',
      options: ['0.5%', '50%', '7%'],
      correct: 2,
      explanation: 'The IEA estimate, which is why it is such an easy first step.',
    },
    {
      id: 'power-at-home-q3',
      prompt: "How much of a washing machine's energy goes to heating water?",
      options: ['About 90%', '10%', '50%'],
      correct: 0,
      explanation: 'Hence 30 °C or cold cycles.',
    },
  ],
  sources: sourcesFor(
    'eurostatHouseholds2022',
    'ieaPlayingMyPart',
    'energyStarWashers',
    'lblStandby',
    'doeLed',
    'ieaHeatPumps',
    'ember2026',
  ),
  claims: [
    {
      id: 'power-heating',
      figure: '64%',
      statement: 'Space heating was 63.5% of final energy consumption in EU households in 2022.',
      source: 'eurostatHouseholds2022',
      basis: 'web',
    },
    {
      id: 'power-hotwater',
      figure: '15%',
      statement: 'Water heating was 14.9%.',
      source: 'eurostatHouseholds2022',
      basis: 'web',
    },
    {
      id: 'power-four-fifths',
      figure: 'four-fifths',
      statement: 'Heating of space and water together were 78.4%.',
      source: 'eurostatHouseholds2022',
      basis: 'web',
    },
    {
      id: 'power-lighting',
      figure: '14%',
      statement: 'Lighting and most electrical appliances represent 13.9%.',
      source: 'eurostatHouseholds2022',
      basis: 'web',
    },
    {
      id: 'power-callout',
      figure: '64% + 15%',
      statement: 'Same as above, in the callout.',
      source: 'eurostatHouseholds2022',
      basis: 'derived',
    },
    {
      id: 'power-thermostat',
      figure: '7%',
      statement:
        'Turning the thermostat down by 1 °C would save around 7% of the energy used for heating.',
      source: 'ieaPlayingMyPart',
      basis: 'web',
    },
    {
      id: 'power-thermostat-1c',
      figure: '1 °C',
      statement: 'The size of the thermostat change.',
      source: 'ieaPlayingMyPart',
      basis: 'web',
    },
    {
      id: 'power-washer',
      figure: '90%',
      statement:
        'Water heating consumes about 90% of the energy it takes to operate a clothes washer.',
      source: 'energyStarWashers',
      basis: 'web',
    },
    {
      id: 'power-washer-temps',
      figure: '30 °C',
      statement: 'A 30 °C cycle uses far less water-heating energy than a 40 °C one.',
      source: 'energyStarWashers',
      basis: 'web',
      note: 'Direction is from the same source; the amount is in the catalogue factors for the wash actions.',
    },
    {
      id: 'power-standby',
      figure: '5 to 10%',
      statement: 'Standby power is 5–10% of residential electricity use.',
      source: 'lblStandby',
      basis: 'web',
    },
    {
      id: 'power-led',
      figure: '75%',
      statement: 'Residential LEDs use at least 75% less energy than incandescent bulbs.',
      source: 'doeLed',
      basis: 'web',
    },
    {
      id: 'power-heatpump',
      figure: 'three to five times',
      statement: 'Current heat pump models are 3–5 times more energy efficient than gas boilers.',
      source: 'ieaHeatPumps',
      basis: 'web',
    },
    {
      id: 'power-france',
      figure: '41 grams',
      statement: "France's grid intensity in 2025 was 41.45 gCO2e per kWh (lifecycle basis).",
      source: 'ember2026',
      basis: 'evidence-base',
    },
    {
      id: 'power-india',
      figure: '671',
      statement: "India's grid intensity in 2025 was 670.55 gCO2e per kWh.",
      source: 'ember2026',
      basis: 'evidence-base',
    },
    {
      id: 'power-year',
      figure: '2025',
      statement: 'Year of the grid values.',
      source: 'ember2026',
      basis: 'evidence-base',
    },
  ],
  reviewBy: '2027-10-06',
};
