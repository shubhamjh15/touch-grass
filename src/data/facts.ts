/**
 * The thirty daily facts, shown once a day after check-in:
 * `FACTS[(diffDays("2026-01-01", today) + userSeed) mod 30]`. Each has a source, a "Tell me
 * more" link and, where it prints a figure, a claim with a source key.
 */
import type { Claim, Fact, FactLink } from './lessons/types';
import type { ContentSourceKey } from './lessons/sources';

const REVIEW_BY = '2027-10-06';

const lesson = (lessonId: string): FactLink => ({ kind: 'lesson', lessonId });

function fact(
  n: number,
  text: string,
  sourceLabel: string,
  source: ContentSourceKey,
  link: FactLink,
  claims: readonly Omit<Claim, 'id'>[],
  hopeful = false,
): Fact {
  const id = `fact-${String(n).padStart(2, '0')}`;
  return {
    id,
    text,
    sourceLabel,
    source,
    hopeful,
    link,
    claims: claims.map((claim, index) => ({ id: `${id}-${index + 1}`, ...claim })),
    reviewBy: REVIEW_BY,
  };
}

export const FACTS: readonly Fact[] = [
  fact(
    1,
    'About 90% of the energy a washing machine uses goes to heating the water. 30 °C does the job.',
    'ENERGY STAR',
    'energyStarWashers',
    lesson('power-at-home'),
    [
      {
        figure: '90%',
        statement:
          'Water heating consumes about 90% of the energy it takes to operate a clothes washer.',
        source: 'energyStarWashers',
        basis: 'web',
      },
      {
        figure: '30 °C',
        statement:
          'A cooler cycle cuts the water-heating share; the exact saving depends on the machine.',
        source: 'energyStarWashers',
        basis: 'web',
      },
    ],
  ),
  fact(
    2,
    'Turning the heating down by 1 °C saves around 7% of your heating energy.',
    'IEA',
    'ieaPlayingMyPart',
    lesson('power-at-home'),
    [
      {
        figure: '7%',
        statement:
          'Turning the thermostat down by 1 °C saves around 7% of the energy used for heating.',
        source: 'ieaPlayingMyPart',
        basis: 'web',
      },
      {
        figure: '1 °C',
        statement: 'The size of the thermostat change in the IEA estimate.',
        source: 'ieaPlayingMyPart',
        basis: 'web',
      },
    ],
  ),
  fact(
    3,
    'Solar electricity costs about 90% less than it did in 2010.',
    'IRENA',
    'irenaCosts2024',
    lesson('good-news'),
    [
      {
        figure: '90%',
        statement:
          'The global weighted-average cost of electricity from newly commissioned solar PV has fallen by about 90% since 2010.',
        source: 'irenaCosts2024',
        basis: 'web',
      },
    ],
    true,
  ),
  fact(
    4,
    "In 2025, renewables generated more of the world's electricity than coal: 33.8% against 33.1%.",
    'Ember',
    'ember2026',
    lesson('good-news'),
    [
      {
        figure: '33.8%',
        statement: 'Renewables produced 33.78% of world electricity in 2025.',
        source: 'ember2026',
        basis: 'dataset',
        note: 'electricity_mix_world, 2025.',
      },
      {
        figure: '33.1%',
        statement: 'Coal produced 33.06% of world electricity in 2025.',
        source: 'ember2026',
        basis: 'dataset',
      },
    ],
    true,
  ),
  fact(
    5,
    'Recycling an aluminium can saves about 95% of the energy needed to make a new one.',
    'International Aluminium Institute',
    'iaiRecycling',
    lesson('recycling-honestly'),
    [
      {
        figure: '95%',
        statement:
          'Recycled aluminium needs 8.3 GJ per tonne against 186 GJ for primary, a 95.5% energy saving (2019 data).',
        source: 'iaiRecycling',
        basis: 'web',
      },
    ],
  ),
  fact(
    6,
    'Around 60% of consumer food waste happens at home, which means it is ours to fix.',
    'UNEP 2024',
    'unepFwi2024',
    lesson('food-we-never-eat'),
    [
      {
        figure: '60%',
        statement: '60% of the food wasted in 2022 was wasted in households.',
        source: 'unepFwi2024',
        basis: 'web',
      },
    ],
  ),
  fact(
    7,
    'Food loss and waste cause an estimated 8 to 10% of global greenhouse gas emissions.',
    'UNEP 2024',
    'unepFwi2024',
    lesson('food-we-never-eat'),
    [
      {
        figure: '8 to 10%',
        statement:
          'Food loss and waste are responsible for 8-10% of annual global greenhouse gas emissions.',
        source: 'unepFwi2024',
        basis: 'web',
      },
    ],
  ),
  fact(
    8,
    "What you eat matters more than where it came from: transport is usually under 10% of a food's footprint.",
    'Our World in Data',
    'owidFoodLocal',
    lesson('on-your-plate'),
    [
      {
        figure: '10%',
        statement: 'For most foods, transport is less than 10% of the footprint.',
        source: 'owidFoodLocal',
        basis: 'web',
      },
    ],
  ),
  fact(
    9,
    'A kilo of beef causes roughly 3 to 10 times the emissions of a kilo of chicken, depending on the herd.',
    'Poore and Nemecek 2018',
    'pnFoodKg',
    lesson('on-your-plate'),
    [
      {
        figure: '3 to 10 times',
        statement:
          'Beef from dairy herds is 33.3 kg CO2e per kg and from beef herds 99.48, against 9.87 for poultry: about 3.4 and 10.1 times.',
        source: 'pnFoodKg',
        basis: 'derived',
      },
    ],
  ),
  fact(
    10,
    'Per passenger-kilometre, a train emits several times less CO2 than driving alone.',
    'UK Government conversion factors',
    'desnz2026',
    lesson('getting-around'),
    [],
  ),
  fact(
    11,
    'Flying is about 2.5% of global CO2 emissions but around 4% of warming so far.',
    'Our World in Data; Klöwer et al. 2021',
    'owidAviation',
    lesson('getting-around'),
    [
      {
        figure: '2.5%',
        statement: 'Aviation accounted for 2.5% of CO2 emissions in 2019.',
        source: 'owidAviation',
        basis: 'web',
      },
      {
        figure: '4%',
        statement:
          'Aviation has contributed about 4% of human-caused warming to date, with non-CO2 effects counted.',
        source: 'kloewer2021',
        basis: 'web',
      },
    ],
  ),
  fact(
    12,
    'Electric cars sold in Europe emit about 73% less over their whole life than petrol cars.',
    'ICCT 2025',
    'icct2025',
    lesson('getting-around'),
    [
      {
        figure: '73%',
        statement:
          'A battery-electric car sold in Europe emits 73% less over its lifetime than a petrol car.',
        source: 'icct2025',
        basis: 'web',
      },
    ],
    true,
  ),
  fact(
    13,
    'LED bulbs use at least 75% less electricity than old incandescent ones.',
    'US Department of Energy',
    'doeLed',
    lesson('power-at-home'),
    [
      {
        figure: '75%',
        statement: 'Residential LEDs use at least 75% less energy than incandescent bulbs.',
        source: 'doeLed',
        basis: 'web',
      },
    ],
  ),
  fact(
    14,
    "Standby power is an estimated 5 to 10% of a home's electricity use.",
    'Lawrence Berkeley National Laboratory',
    'lblStandby',
    lesson('power-at-home'),
    [
      {
        figure: '5 to 10%',
        statement: 'Standby power is 5-10% of residential electricity use.',
        source: 'lblStandby',
        basis: 'web',
      },
    ],
  ),
  fact(
    15,
    "Only about 9% of the world's plastic waste gets recycled. Refuse and reuse come first.",
    'OECD 2022',
    'oecdPlastics2022',
    lesson('recycling-honestly'),
    [
      {
        figure: '9%',
        statement: 'Only 9% of plastic waste was ultimately recycled.',
        source: 'oecdPlastics2022',
        basis: 'web',
      },
    ],
  ),
  fact(
    16,
    'The world made 62 million tonnes of e-waste in 2022. Under a quarter was properly recycled.',
    'Global E-waste Monitor 2024',
    'ewaste2024',
    lesson('stuff'),
    [
      {
        figure: '62 million tonnes',
        statement: 'A record 62 Mt of e-waste was produced in 2022.',
        source: 'ewaste2024',
        basis: 'web',
      },
      {
        figure: 'Under a quarter',
        statement: '22.3% was documented as properly collected and recycled.',
        source: 'ewaste2024',
        basis: 'web',
      },
    ],
  ),
  fact(
    17,
    "About 80% of an iPhone 17's life-cycle emissions are made before you switch it on. Keeping a phone longer is a real cut.",
    'Apple Product Environmental Report 2025',
    'appleIphone17',
    lesson('stuff'),
    [
      {
        figure: '80%',
        statement:
          'Production (53% + 23%) and transportation (4%) are 80% of the 55 kg CO2e life-cycle total of an iPhone 17.',
        source: 'appleIphone17',
        basis: 'evidence-base',
        note: "One configuration, Apple's own assessment, assuming three years of use.",
      },
      {
        figure: 'iPhone 17',
        statement: 'The product the Product Environmental Report covers.',
        source: 'appleIphone17',
        basis: 'evidence-base',
      },
    ],
  ),
  fact(
    18,
    'A cotton tote needs at least 131 uses to beat a single-use plastic bag on climate. Keep using yours.',
    'UK Environment Agency',
    'ukEABags',
    lesson('recycling-honestly'),
    [
      {
        figure: '131 uses',
        statement:
          'A cotton bag should be reused at least 131 times to beat a conventional plastic bag on global warming potential.',
        source: 'ukEABags',
        basis: 'web',
        note: 'Study of bags sold in England in 2006.',
      },
    ],
  ),
  fact(
    19,
    'There is about 50% more CO2 in the air today than before the industrial era.',
    'NOAA',
    'noaaMaunaLoa',
    lesson('the-blanket'),
    [
      {
        figure: '50%',
        statement:
          '427.35 ppm in 2025 against about 280 ppm before industry is a rise of about 50%.',
        source: 'noaaMaunaLoa',
        basis: 'derived',
      },
    ],
  ),
  fact(
    20,
    'The ocean absorbs more than a quarter of the CO2 we emit, and its surface water is about 30% more acidic for it.',
    'Global Carbon Project; NOAA',
    'gcb2024',
    lesson('the-blanket'),
    [
      {
        figure: 'more than a quarter',
        statement: 'The ocean sink absorbs about 26% of anthropogenic CO2 emissions.',
        source: 'gcb2024',
        basis: 'web',
      },
      {
        figure: '30%',
        statement:
          'Surface ocean pH has fallen by 0.1 units since the industrial revolution, about a 30% increase in acidity.',
        source: 'noaaAcidification',
        basis: 'web',
      },
    ],
  ),
  fact(
    21,
    'In a 125-country survey, 89% of people wanted their government to do more on climate. You are not alone.',
    'Andre et al. 2024',
    'andre2024',
    lesson('good-news'),
    [
      {
        figure: '125-country',
        statement: 'A representative survey in 125 countries of nearly 130,000 people.',
        source: 'andre2024',
        basis: 'web',
      },
      {
        figure: '89%',
        statement: '89% demanded intensified political action.',
        source: 'andre2024',
        basis: 'web',
      },
    ],
    true,
  ),
  fact(
    22,
    'A heat pump is three to five times more efficient than a gas boiler.',
    'IEA',
    'ieaHeatPumps',
    lesson('power-at-home'),
    [
      {
        figure: 'three to five times',
        statement: 'Current heat pump models are 3-5 times more energy efficient than gas boilers.',
        source: 'ieaHeatPumps',
        basis: 'web',
      },
    ],
    true,
  ),
  fact(
    23,
    "Livestock uses about three-quarters of the world's farmland but supplies about 18% of its calories.",
    'Our World in Data',
    'owidLand',
    lesson('on-your-plate'),
    [
      {
        figure: 'three-quarters',
        statement:
          'Livestock accounts for 77% of global farming land, including land used for feed.',
        source: 'owidLand',
        basis: 'web',
      },
      {
        figure: '18%',
        statement: "Livestock supplies 18% of the world's calories.",
        source: 'owidLand',
        basis: 'web',
      },
    ],
  ),
  fact(
    24,
    "An hour of video streaming emitted about 36 g of CO2 in the IEA's 2019 estimate, roughly a 170-metre drive. Big levers first.",
    'IEA',
    'ieaStreaming',
    lesson('big-levers'),
    [
      {
        figure: '36 g',
        statement:
          "The IEA's central estimate for one hour of streaming video in 2019 is 36 g CO2.",
        source: 'ieaStreaming',
        basis: 'web',
        note: 'A 2019 figure; the IEA expects it to keep falling as networks and devices get more efficient.',
      },
      {
        figure: '170-metre',
        statement: '36 g divided by 0.2099 kg CO2e per km for an average car is about 170 metres.',
        source: 'desnz2026',
        basis: 'derived',
      },
    ],
  ),
  fact(
    25,
    '"Best before" is about quality, not safety. Look, smell, taste, then decide.',
    'UK Food Standards Agency',
    'foodGovUk',
    lesson('food-we-never-eat'),
    [],
  ),
  fact(
    26,
    'Methane traps about 80 times more heat than CO2 over 20 years, so cutting food waste works fast.',
    'IPCC AR6',
    'ipccAR6wg1ch7',
    lesson('food-we-never-eat'),
    [
      {
        figure: '80 times',
        statement: 'GWP-20 of methane is roughly 80 (79.7 non-fossil, 82.5 fossil).',
        source: 'ipccAR6wg1ch7',
        basis: 'web',
        note: 'From IPCC AR6 WG1 Table 7.15; the 20-year column was not re-fetched on 2026-10-06.',
      },
      {
        figure: '20 years',
        statement: 'The shorter time horizon at which methane is about 80 times CO2.',
        source: 'ipccAR6wg1ch7',
        basis: 'web',
      },
    ],
  ),
  fact(
    27,
    'The highest-emitting 10% of households cause 34 to 45% of household emissions.',
    'IPCC AR6',
    'ipccAR6wg3',
    lesson('where-it-comes-from'),
    [
      {
        figure: '34 to 45%',
        statement:
          'The 10% of households with the highest per-capita emissions contribute 34-45% of consumption-based household emissions.',
        source: 'ipccAR6wg3',
        basis: 'evidence-base',
      },
      {
        figure: '10%',
        statement: 'The top decile of households by per-capita emissions.',
        source: 'ipccAR6wg3',
        basis: 'evidence-base',
      },
    ],
  ),
  fact(
    28,
    'Two hours a week in nature is linked to better health and wellbeing. Your break counts.',
    'White et al. 2019',
    'white2019',
    { kind: 'touch-grass' },
    [
      {
        figure: 'Two hours',
        statement:
          'People spending at least 120 minutes a week in nature were significantly more likely to report good health and high wellbeing.',
        source: 'white2019',
        basis: 'web',
        note: 'An association in a survey of 19,806 people, not proof of cause.',
      },
    ],
    true,
  ),
  fact(
    29,
    'One in four new cars sold worldwide in 2025 was electric.',
    'IEA Global EV Outlook 2026',
    'ieaOwidEv',
    lesson('good-news'),
    [
      {
        figure: 'One in four',
        statement:
          'Electric cars (battery and plug-in hybrid) were 25% of new car sales worldwide in 2025.',
        source: 'ieaOwidEv',
        basis: 'dataset',
        note: 'ev_sales_share, 2025.',
      },
    ],
    true,
  ),
  fact(
    30,
    'The ozone layer is on track to recover to 1980 levels around 2040 for most of the world, because countries agreed to fix it. Cooperation works.',
    'WMO and UNEP ozone assessment 2022',
    'wmoOzone2022',
    lesson('good-news'),
    [
      {
        figure: '1980 levels around 2040',
        statement:
          'The ozone layer is projected to return to 1980 levels around 2040 outside the polar regions (2045 over the Arctic, 2066 over Antarctica).',
        source: 'wmoOzone2022',
        basis: 'web',
      },
    ],
    true,
  ),
];

/** The fact for a given day, as the spec defines it. `dayIndex` is the days since 2026-01-01. */
export function factForDay(dayIndex: number, userSeed: number): Fact {
  const length = FACTS.length;
  const index = (((dayIndex + userSeed) % length) + length) % length;
  return FACTS[index] as Fact;
}
