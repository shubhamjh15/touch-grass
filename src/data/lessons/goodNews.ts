import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const GOOD_NEWS: Lesson = {
  id: 'good-news',
  title: 'The good news, and your part in it',
  summary: 'Swap doom for an accurate picture of progress, and see where one person fits.',
  category: 'hope',
  focus: ['nature'],
  readingMinutes: 3,
  sections: [
    {
      id: 'rarely-headlines',
      heading: 'The part that rarely makes headlines',
      blocks: [
        {
          kind: 'p',
          text: 'Climate news is mostly alarm. Here is the other half of the picture, and it is just as real.',
        },
      ],
    },
    {
      id: 'cheap-clean',
      heading: 'Clean power got cheap',
      blocks: [
        {
          kind: 'p',
          text: "The average cost of electricity from new solar farms has fallen by about 90% since 2010, according to IRENA. In 2025, renewables generated more of the world's electricity than coal: about 34% against 33%, in Ember's data. Wind and solar together made 17.3% of the world's electricity in 2025, up from 4.5% ten years earlier.",
        },
        {
          kind: 'fact',
          stat: '25%',
          text: 'Share of new cars sold worldwide in 2025 that were electric, including plug-in hybrids.',
          source: 'ieaOwidEv',
        },
      ],
    },
    {
      id: 'bent-curve',
      heading: 'The curve has already bent',
      blocks: [
        {
          kind: 'p',
          text: "The UN Environment Programme's latest report puts expected warming this century under current policies at 2.8 °C, down from 3.1 °C in last year's edition. That is still far too high. It is also proof that action moves the number.",
        },
        {
          kind: 'p',
          text: 'There is no cliff after which effort stops mattering. Every increment of warming avoided means less harm, says the IPCC.',
        },
      ],
    },
    {
      id: 'ozone',
      heading: 'A problem the world fixed',
      blocks: [
        {
          kind: 'p',
          text: 'In the 1980s the ozone layer was thinning because of man-made chemicals. Countries agreed to stop making them. The latest assessment projects the layer will return to 1980 levels around 2040 over most of the world, around 2045 over the Arctic and around 2066 over Antarctica. It is proof that people can solve a shared problem when they decide to.',
        },
      ],
    },
    {
      id: 'where-you-fit',
      heading: 'Where do you fit?',
      blocks: [
        {
          kind: 'list',
          items: [
            'Consumer: your own levers, such as travel, food and heat.',
            'Signal: people copy people. Visible choices like cycling to work or rooftop solar spread through streets and friend groups.',
            'Citizen: voting, speaking up at work or school, and backing better buses and cleaner energy locally.',
          ],
        },
      ],
    },
    {
      id: 'not-alone',
      heading: 'You are less alone than it feels',
      blocks: [
        {
          kind: 'p',
          text: 'In a survey of nearly 130,000 people in 125 countries, 89% wanted their government to do more on climate. Yet most people underestimate how many others care. Talking about it is a climate action in its own right.',
        },
        {
          kind: 'fact',
          stat: '89%',
          text: 'Share of people surveyed in 125 countries who wanted more government action on climate.',
          source: 'andre2024',
        },
        {
          kind: 'action',
          actionId: 'climate-conversation',
          text: 'Do this today: have one calm conversation about climate with someone.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'climate-conversation', label: 'Have a climate conversation' },
    { actionId: 'civic-action', label: 'Take a civic action' },
  ],
  quiz: [
    {
      id: 'good-news-q1',
      prompt: 'Since 2010, the cost of solar electricity has fallen by about…',
      options: ['10%', '90%', '50%'],
      correct: 1,
      explanation: 'IRENA. Most new renewable projects now undercut the fossil alternative.',
    },
    {
      id: 'good-news-q2',
      prompt:
        'In a 125-country survey, what share of people wanted their government to do more on climate?',
      options: ['29%', '59%', '89%'],
      correct: 2,
      explanation: 'Andre et al., 2024. People consistently underestimate how many others agree.',
    },
    {
      id: 'good-news-q3',
      prompt: 'Is there a point after which cutting emissions stops being worthwhile?',
      options: [
        'Yes, after 1.5 °C',
        'No, every fraction of a degree avoided reduces harm',
        'Yes, after 2030',
      ],
      correct: 1,
      explanation: 'There is no cliff. Less warming is always better.',
    },
  ],
  sources: sourcesFor(
    'irenaCosts2024',
    'ember2026',
    'ieaOwidEv',
    'unepEgr2025',
    'ipccAR6wg1',
    'wmoOzone2022',
    'andre2024',
  ),
  claims: [
    {
      id: 'good-solar',
      figure: '90%',
      statement:
        'The global weighted-average cost of electricity from newly commissioned solar PV has fallen by about 90% since 2010 (USD 0.460 to about 0.043 per kWh).',
      source: 'irenaCosts2024',
      basis: 'web',
    },
    {
      id: 'good-renewables',
      figure: '34%',
      statement: 'Renewables produced 33.78% of world electricity in 2025.',
      source: 'ember2026',
      basis: 'dataset',
      note: 'electricity_mix_world, 2025.',
    },
    {
      id: 'good-coal',
      figure: '33%',
      statement: 'Coal produced 33.06% of world electricity in 2025.',
      source: 'ember2026',
      basis: 'dataset',
    },
    {
      id: 'good-ev',
      figure: '25%',
      statement:
        'Electric cars (battery and plug-in hybrid) were 25% of new car sales worldwide in 2025.',
      source: 'ieaOwidEv',
      basis: 'dataset',
      note: 'ev_sales_share, 2025.',
    },
    {
      id: 'good-egr-now',
      figure: '2.8 °C',
      statement:
        'Projected warming under current policies is 2.8 °C in the Emissions Gap Report 2025.',
      source: 'unepEgr2025',
      basis: 'web',
    },
    {
      id: 'good-egr-before',
      figure: '3.1 °C',
      statement:
        'The 2024 edition projected 3.1 °C under current policies. UNEP notes that about 0.1 °C of the change is methodological.',
      source: 'unepEgr2025',
      basis: 'web',
    },
    {
      id: 'good-125',
      figure: '125 countries',
      statement: 'A representative survey in 125 countries.',
      source: 'andre2024',
      basis: 'web',
    },
    {
      id: 'good-130k',
      figure: '130,000',
      statement: 'Nearly 130,000 people were interviewed.',
      source: 'andre2024',
      basis: 'web',
    },
    {
      id: 'good-89',
      figure: '89%',
      statement:
        "89% demanded intensified political action; people systematically underestimate others' willingness to act.",
      source: 'andre2024',
      basis: 'web',
    },
    {
      id: 'good-wind-solar',
      figure: '17.3%',
      statement: 'Wind and solar produced 17.31% of world electricity in 2025.',
      source: 'ember2026',
      basis: 'dataset',
      note: 'electricity_mix_world, 2025.',
    },
    {
      id: 'good-wind-solar-2015',
      figure: '4.5%',
      statement: 'Wind and solar produced 4.53% of world electricity in 2015.',
      source: 'ember2026',
      basis: 'dataset',
    },
    {
      id: 'good-ozone-2040',
      figure: '1980 levels around 2040',
      statement:
        'The ozone layer is projected to return to 1980 levels around 2040 outside the polar regions.',
      source: 'wmoOzone2022',
      basis: 'web',
    },
    {
      id: 'good-ozone-2045',
      figure: 'around 2045',
      statement: 'Projected return to 1980 levels over the Arctic.',
      source: 'wmoOzone2022',
      basis: 'web',
    },
    {
      id: 'good-ozone-2066',
      figure: 'around 2066',
      statement: 'Projected return to 1980 levels over Antarctica.',
      source: 'wmoOzone2022',
      basis: 'web',
    },
  ],
  reviewBy: '2027-10-06',
};
