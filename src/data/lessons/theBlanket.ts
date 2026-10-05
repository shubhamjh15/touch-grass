import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const THE_BLANKET: Lesson = {
  id: 'the-blanket',
  title: 'The blanket: how the greenhouse effect works',
  summary:
    'Why adding CO2 warms the planet, in one breath, with the three numbers worth remembering.',
  category: 'climate',
  focus: ['move', 'power'],
  readingMinutes: 3,
  sections: [
    {
      id: 'good-thing',
      heading: 'First, the surprise: it is a good thing',
      blocks: [
        {
          kind: 'p',
          text: 'Sunlight warms the ground. The warm ground gives that heat back out as infrared light. Some gases in the air, mainly water vapour, carbon dioxide, methane and nitrous oxide, soak up part of that heat and send some of it back down. That is the greenhouse effect.',
        },
        {
          kind: 'p',
          text: 'Without it, Earth would be a frozen rock, about −18 °C on average instead of the roughly +15 °C we live in. The blanket is the reason there are oceans, forests and you.',
        },
        {
          kind: 'fact',
          stat: '≈ 33 °C',
          text: 'How much warmer the natural greenhouse effect keeps Earth than it would otherwise be.',
          source: 'ipccAr4Faq13',
        },
      ],
    },
    {
      id: 'thicker',
      heading: 'The problem is the thickness',
      blocks: [
        {
          kind: 'p',
          text: 'Coal, oil and gas are carbon that sat underground for millions of years. Burning them moves it into the air within decades, and the blanket gets thicker.',
        },
        {
          kind: 'p',
          text: 'Before industry, the air held about 280 parts per million (ppm) of CO2. NOAA measured 427 ppm at Mauna Loa in 2025. That is over 50% more, and the IPCC says it is higher than at any time in at least 2 million years.',
        },
        {
          kind: 'fact',
          stat: '427 ppm',
          text: 'Average CO2 at Mauna Loa in 2025, up from about 280 ppm before industry.',
          source: 'noaaMaunaLoa',
        },
      ],
    },
    {
      id: 'thermometer',
      heading: 'What the thermometer says',
      blocks: [
        {
          kind: 'p',
          text: 'The decade 2011 to 2020 was about 1.1 °C warmer than 1850 to 1900. In 2024 the world was about 1.55 °C above that early baseline, according to the World Meteorological Organization, and 2025 came in a little lower, around 1.4 °C.',
        },
        {
          kind: 'p',
          text: 'One hot year does not break the Paris goal of 1.5 °C. That goal is about long-term warming, averaged over many years. But the direction is clear, and the heat is still building.',
        },
      ],
    },
    {
      id: 'unequivocal',
      heading: 'Why scientists say "human-caused"',
      blocks: [
        {
          kind: 'p',
          text: 'Natural drivers, such as the sun and volcanoes, explain somewhere between −0.1 and +0.1 °C of the change since 1850 to 1900. Human influence explains about 1.1 °C. The IPCC calls human influence on the climate "unequivocal", which is the strongest word it has.',
        },
        {
          kind: 'p',
          text: 'That is a hopeful finding, too. If people caused it, people can slow it.',
        },
      ],
    },
    {
      id: 'your-part',
      heading: 'Where your tree comes in',
      blocks: [
        {
          kind: 'p',
          text: 'CO2 lingers and accumulates. So every tonne that is not emitted leaves the blanket a little thinner than it would have been. That is what the tree on your island is counting, one honest estimate at a time.',
        },
        {
          kind: 'action',
          actionId: 'walk-cycle-instead-of-car',
          text: 'Do this today: swap one short car trip for a walk or a ride.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'walk-cycle-instead-of-car', label: 'Walk or cycle instead of driving' },
    { actionId: 'thermostat-down-1c', label: 'Turn the heating down 1 °C' },
  ],
  quiz: [
    {
      id: 'the-blanket-q1',
      prompt: "Without any greenhouse effect, Earth's average surface temperature would be about…",
      options: ['0 °C', '+15 °C', '−18 °C'],
      correct: 2,
      explanation:
        'The natural effect keeps the planet about 33 °C warmer than it would otherwise be.',
    },
    {
      id: 'the-blanket-q2',
      prompt: 'How much has CO2 in the air risen since before industry?',
      options: ['About 5%', 'About 50% (≈ 280 → 427 ppm)', 'It has tripled'],
      correct: 1,
      explanation:
        "NOAA's Mauna Loa record averaged about 427 ppm in 2025, against about 280 before industry.",
    },
    {
      id: 'the-blanket-q3',
      prompt:
        '2024 was about 1.5 °C above 1850–1900. Does that mean the Paris 1.5 °C goal is broken?',
      options: [
        'Yes, permanently',
        'The goal only covers the oceans',
        'No, the goal is about long-term warming, not one year',
      ],
      correct: 2,
      explanation:
        'Single years swing above and below the trend. The Paris goal is judged on warming averaged over many years, which is why the direction matters more than any one year.',
    },
  ],
  sources: sourcesFor('ipccAr4Faq13', 'noaaMaunaLoa', 'ipccAR6wg1', 'wmo2025'),
  claims: [
    {
      id: 'blanket-33c',
      figure: '33 °C',
      statement:
        'The natural greenhouse effect warms Earth by about 33 °C (about −18 °C without it, about +15 °C with it).',
      source: 'ipccAr4Faq13',
      basis: 'web',
      note: 'Textbook values; sources round the two temperatures slightly differently (−18 or −19, +14 or +15).',
    },
    {
      id: 'blanket-18c',
      figure: '−18 °C',
      statement: 'Average surface temperature without any greenhouse effect.',
      source: 'ipccAr4Faq13',
      basis: 'web',
    },
    {
      id: 'blanket-15c',
      figure: '+15 °C',
      statement: 'Average surface temperature with the natural greenhouse effect.',
      source: 'ipccAr4Faq13',
      basis: 'web',
    },
    {
      id: 'blanket-co2-now',
      figure: '427 ppm',
      statement: 'Mauna Loa annual mean CO2 in 2025 was 427.35 ppm.',
      source: 'noaaMaunaLoa',
      basis: 'dataset',
      note: 'atmospheric_co2_mauna_loa, latest point.',
    },
    {
      id: 'blanket-co2-then',
      figure: '280 ppm',
      statement: 'Pre-industrial CO2 was about 280 ppm (ice cores).',
      source: 'noaaMaunaLoa',
      basis: 'web',
      note: 'The figure is NOAA’s usual pre-industrial reference; it is not in the Mauna Loa file itself.',
    },
    {
      id: 'blanket-co2-rise',
      figure: '50%',
      statement: '427 ÷ 280 is about 1.5: more than 50% more CO2 than before industry.',
      source: 'noaaMaunaLoa',
      basis: 'derived',
    },
    {
      id: 'blanket-2myr',
      figure: '2 million years',
      statement: 'CO2 concentrations are higher than at any time in at least 2 million years.',
      source: 'ipccAR6wg1',
      basis: 'web',
      note: 'IPCC AR6 WG1 SPM A.2.1, stated for 2019; the 2025 value is higher still.',
    },
    {
      id: 'blanket-decade',
      figure: '1.1 °C',
      statement:
        'The decade 2011–2020 was 1.09 °C warmer than 1850–1900; human influence accounts for about 1.07 °C.',
      source: 'ipccAR6wg1',
      basis: 'web',
    },
    {
      id: 'blanket-2024',
      figure: '1.55 °C',
      statement: '2024 was about 1.55 ± 0.13 °C above the pre-industrial average (WMO).',
      source: 'wmo2025',
      basis: 'web',
    },
    {
      id: 'blanket-2025',
      figure: '1.4 °C',
      statement:
        '2025 came in at about 1.4 °C above 1850–1900 (WMO provisional: 1.42 ± 0.12 for January–August).',
      source: 'wmo2025',
      basis: 'web',
      note: 'Rounded on purpose: the final-year value was not re-fetched.',
    },
    {
      id: 'blanket-natural',
      figure: '−0.1 and +0.1 °C',
      statement:
        'Natural drivers (sun, volcanoes) changed temperature by between −0.1 and +0.1 °C since 1850–1900.',
      source: 'ipccAR6wg1',
      basis: 'web',
      note: 'IPCC AR6 WG1 SPM A.1.3 (likely range).',
    },
    {
      id: 'blanket-human',
      figure: 'about 1.1 °C',
      statement: 'Human influence explains about 1.07 °C of warming, rounded to 1.1.',
      source: 'ipccAR6wg1',
      basis: 'web',
    },
    {
      id: 'blanket-paris',
      figure: '1.5 °C',
      statement:
        'The Paris Agreement goal of 1.5 °C refers to long-term warming, not to a single year.',
      source: 'wmo2025',
      basis: 'web',
    },
  ],
  reviewBy: '2027-10-06',
};
