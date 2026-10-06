/**
 * The ten myth-busters behind the flip cards on /learn. Front: the myth. Back: the verdict,
 * two or three sentences and the source. Every figure has a claim with a source key.
 */
import { sourcesFor } from './lessons/sources';
import type { Myth } from './lessons/types';

const REVIEW_BY = '2027-10-06';

export const MYTHS: readonly Myth[] = [
  {
    id: 'one-person',
    myth: '"One person can\'t make a difference."',
    verdict: 'mostly-false',
    verdictLabel: 'Mostly false.',
    explanation:
      "Any single source is small next to the whole. That is true of every car, factory and country too. Changes in how we travel, eat and use buildings could cut those sectors' emissions by 40 to 70% by 2050, and most of that needs better infrastructure and policy, which is where voices and votes count.",
    lessonId: 'big-levers',
    sources: sourcesFor('ipccAR6wg3'),
    claims: [
      {
        id: 'myth-one-person-demand',
        figure: '40 to 70%',
        statement:
          'Demand-side measures can reduce global GHG emissions in end-use sectors by 40-70% by 2050 compared with baseline scenarios.',
        source: 'ipccAR6wg3',
        basis: 'evidence-base',
        note: 'IPCC AR6 WG3 SPM C.10, high confidence.',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'recycling-best',
    myth: '"Recycling is the best thing I can do for the climate."',
    verdict: 'false',
    verdictLabel: 'False.',
    explanation:
      'Recycling everything saves about 0.2 t CO2e a year. Living car-free saves about 2.4 t, and a plant-based diet about 0.8 t. Recycle, and then look at travel, heat and food.',
    lessonId: 'big-levers',
    sources: sourcesFor('wynes2017'),
    claims: [
      {
        id: 'myth-recycling-0-2',
        figure: '0.2 t',
        statement: 'Thorough recycling saves about 0.2 tCO2e per year (0.21 in the paper).',
        source: 'wynes2017',
        basis: 'evidence-base',
        note: 'Per person, high-income countries.',
      },
      {
        id: 'myth-recycling-2-4',
        figure: '2.4 t',
        statement: 'Living car-free saves about 2.4 tCO2e per year.',
        source: 'wynes2017',
        basis: 'evidence-base',
      },
      {
        id: 'myth-recycling-0-8',
        figure: '0.8 t',
        statement: 'A plant-based diet saves about 0.8 tCO2e per year.',
        source: 'wynes2017',
        basis: 'evidence-base',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'eat-local',
    myth: '"Eating local is the best way to cut my food footprint."',
    verdict: 'mostly-false',
    verdictLabel: 'Mostly false.',
    explanation:
      "Transport is usually under 10% of a food's footprint, and about 0.5% for beef. What you eat matters far more than where it is from. The exception is anything flown in.",
    lessonId: 'on-your-plate',
    sources: sourcesFor('owidFoodLocal', 'pnFoodKg'),
    claims: [
      {
        id: 'myth-local-10',
        figure: '10%',
        statement: 'For most foods, transport is less than 10% of the footprint.',
        source: 'owidFoodLocal',
        basis: 'web',
      },
      {
        id: 'myth-local-beef',
        figure: '0.5%',
        statement: 'Transport is about 0.5% of the footprint of beef.',
        source: 'owidFoodLocal',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'ev-batteries',
    myth: '"Electric cars are worse because of their batteries."',
    verdict: 'false',
    verdictLabel: 'False.',
    explanation:
      'Building the battery adds an upfront "debt" that is paid back after about 17,000 km. Over the whole life cycle, electric cars sold in Europe emit about 73% less than petrol cars.',
    lessonId: 'getting-around',
    sources: sourcesFor('icct2025'),
    claims: [
      {
        id: 'myth-ev-payback',
        figure: '17,000 km',
        statement:
          'Extra battery-production emissions are more than offset after around 17,000 km.',
        source: 'icct2025',
        basis: 'web',
      },
      {
        id: 'myth-ev-73',
        figure: '73%',
        statement:
          'A battery-electric car sold in Europe emits 73% less over its lifetime than a petrol car.',
        source: 'icct2025',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'natural-cycle',
    myth: '"It\'s just a natural cycle."',
    verdict: 'false',
    verdictLabel: 'False.',
    explanation:
      'Natural drivers such as the sun and volcanoes explain about −0.1 to +0.1 °C of the change since 1850–1900. Human influence explains about 1.1 °C. The IPCC\'s word for it is "unequivocal".',
    lessonId: 'the-blanket',
    sources: sourcesFor('ipccAR6wg1'),
    claims: [
      {
        id: 'myth-natural-range',
        figure: '−0.1 to +0.1 °C',
        statement:
          'Changes in solar and volcanic drivers likely made a small contribution of -0.1 to +0.1 °C.',
        source: 'ipccAR6wg1',
        basis: 'web',
        note: 'IPCC AR6 WG1 SPM A.1.3 (likely range).',
      },
      {
        id: 'myth-natural-human',
        figure: '1.1 °C',
        statement:
          'Human influence explains about 1.07 °C of warming since 1850–1900, rounded to 1.1.',
        source: 'ipccAR6wg1',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'plant-trees',
    myth: '"We can just plant trees."',
    verdict: 'misleading',
    verdictLabel: 'Misleading.',
    explanation:
      'Trees are worth planting, but they are slow. A young urban tree takes up about 60 kg of CO2 in its first ten years, while one return flight across the Atlantic is about 1,600 kg. Trees also need land and can release their carbon again in fires or droughts, so they cannot stand in for cutting emissions.',
    lessonId: 'big-levers',
    sources: sourcesFor('doeTree1998', 'wynes2017', 'ipccAR6wg3'),
    claims: [
      {
        id: 'myth-trees-seedling',
        figure: '60 kg',
        statement:
          'An urban tree seedling takes up about 60 kg of CO2 over its first ten years, including mortality (60.5 kg).',
        source: 'doeTree1998',
        basis: 'evidence-base',
        note: 'A national-average method for urban trees in the United States; forests and species differ.',
      },
      {
        id: 'myth-trees-flight',
        figure: '1,600 kg',
        statement: 'One transatlantic round trip is about 1.6 tCO2e per person.',
        source: 'wynes2017',
        basis: 'evidence-base',
      },
      {
        id: 'myth-trees-decade',
        figure: 'ten years',
        statement: 'The first ten years of growth are the span the 60.5 kg figure covers.',
        source: 'doeTree1998',
        basis: 'evidence-base',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'renewables-expensive',
    myth: '"Renewable energy is too expensive."',
    verdict: 'false',
    verdictLabel: 'False.',
    explanation:
      'Solar electricity costs about 90% less than in 2010. And 91% of the new renewable projects built in 2024 were cheaper than the cheapest fossil alternative.',
    lessonId: 'good-news',
    sources: sourcesFor('irenaCosts2024'),
    claims: [
      {
        id: 'myth-renew-90',
        figure: '90%',
        statement:
          'The weighted-average cost of electricity from new solar PV has fallen by about 90% since 2010.',
        source: 'irenaCosts2024',
        basis: 'web',
      },
      {
        id: 'myth-renew-91',
        figure: '91%',
        statement:
          '91% of newly commissioned utility-scale renewable capacity delivered power at lower cost than the cheapest new fossil alternative.',
        source: 'irenaCosts2024',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'too-late',
    myth: '"It\'s too late to do anything."',
    verdict: 'false',
    verdictLabel: 'False.',
    explanation:
      "There is no cliff. Every increment of warming avoided means less harm. UNEP's projection for current policies fell from 3.1 °C to 2.8 °C between its 2024 and 2025 reports, though part of that is a change of method. It is still too high, and it shows the number can move.",
    lessonId: 'good-news',
    sources: sourcesFor('ipccAR6wg1', 'unepEgr2025'),
    claims: [
      {
        id: 'myth-late-3-1',
        figure: '3.1 °C',
        statement: 'The Emissions Gap Report 2024 projected 3.1 °C under current policies.',
        source: 'unepEgr2025',
        basis: 'web',
      },
      {
        id: 'myth-late-2-8',
        figure: '2.8 °C',
        statement:
          'The Emissions Gap Report 2025 projects 2.8 °C under current policies; about 0.1 °C of the change is methodological.',
        source: 'unepEgr2025',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'reusable-bag',
    myth: '"A reusable bag is automatically greener."',
    verdict: 'conditional',
    verdictLabel: 'Only if you reuse it.',
    explanation:
      'The UK Environment Agency found a cotton tote must be used at least 131 times to beat a single-use plastic bag on climate. The greenest bag is the one you already own.',
    lessonId: 'recycling-honestly',
    sources: sourcesFor('ukEABags'),
    claims: [
      {
        id: 'myth-bag-131',
        figure: '131 times',
        statement:
          'A cotton bag should be reused at least 131 times to beat a conventional plastic bag on global warming potential.',
        source: 'ukEABags',
        basis: 'web',
        note: 'The study covers the bags sold in 2006 in England.',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'only-for-rich',
    myth: '"Sustainable living is only for the rich."',
    verdict: 'mostly-false',
    verdictLabel: 'Mostly false.',
    explanation:
      'Many of the biggest cuts save money: driving less, wasting less food, lower heating, buying less and buying second-hand. Footprints rise with income, and the highest-emitting 10% of households cause 34 to 45% of household emissions. Some upgrades do cost upfront, which is where policy has to help.',
    lessonId: 'big-levers',
    sources: sourcesFor('ipccAR6wg3', 'oxfamSei2023'),
    claims: [
      {
        id: 'myth-rich-ipcc',
        figure: '34 to 45%',
        statement:
          'The 10% of households with the highest per-capita emissions contribute 34-45% of consumption-based household emissions.',
        source: 'ipccAR6wg3',
        basis: 'evidence-base',
        note: 'IPCC AR6 WG3 SPM B.3.4.',
      },
      {
        id: 'myth-rich-top10',
        figure: '10%',
        statement: 'The top decile of households by per-capita emissions.',
        source: 'ipccAR6wg3',
        basis: 'evidence-base',
      },
    ],
    reviewBy: REVIEW_BY,
  },
];
