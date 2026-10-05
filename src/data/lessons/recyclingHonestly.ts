import { sourcesFor } from './sources';
import type { Lesson } from './types';

export const RECYCLING_HONESTLY: Lesson = {
  id: 'recycling-honestly',
  title: 'Recycling, honestly',
  summary: 'Recycle well, know its limits, and put it in the right place in the hierarchy.',
  category: 'waste',
  focus: ['waste'],
  readingMinutes: 2,
  sections: [
    {
      id: 'worth-doing',
      heading: 'Worth doing, and oversold',
      blocks: [
        {
          kind: 'p',
          text: 'Recycling is worth doing. It is also widely oversold. Globally, only about 9% of plastic waste is recycled. The rest is landfilled, burned or leaks into the environment.',
        },
        {
          kind: 'fact',
          stat: '9%',
          text: "Share of the world's plastic waste that is ultimately recycled.",
          source: 'oecdPlastics2022',
        },
      ],
    },
    {
      id: 'materials',
      heading: 'Materials are very different',
      blocks: [
        {
          kind: 'p',
          text: 'Aluminium can be recycled again and again, and it saves about 95% of the energy needed to make it from ore. Glass, steel, paper and cardboard also recycle well. Per kilo, using recycled rather than virgin material cuts CO2e by about 89% for aluminium, about 41% for glass and about 22% for paper.',
        },
        {
          kind: 'p',
          text: 'Plastics are harder. There are many types, they are easy to contaminate, and the recycled material is often low in value.',
        },
      ],
    },
    {
      id: 'wish-cycling',
      heading: 'Why "wish-cycling" backfires',
      blocks: [
        {
          kind: 'p',
          text: 'Tossing something in and hoping is called wish-cycling. It can spoil a whole batch or jam sorting machines. Rules differ by city, so check your local list once and keep it somewhere handy.',
        },
        {
          kind: 'list',
          items: [
            'Keep it clean, dry and loose, not in a bag.',
            'When in doubt, find out.',
            'Batteries and electronics never go in a household bin. They start fires in trucks and plants, so take them to a collection point.',
            'Food scraps belong in compost or a food-waste bin, because in landfill they rot without oxygen and release methane.',
          ],
        },
      ],
    },
    {
      id: 'proportion',
      heading: 'Keep it in proportion',
      blocks: [
        {
          kind: 'p',
          text: 'Recycling everything perfectly saves roughly 0.2 tonnes of CO2e a year for a person in a rich country. That is worth having. It is not the biggest lever, and it does not need to cost you sleep.',
        },
      ],
    },
    {
      id: 'upstream',
      heading: 'Then look upstream',
      blocks: [
        {
          kind: 'p',
          text: 'The order is refuse, reduce, reuse, repair, and only then recycle. The cheapest, cleanest waste is the item you never needed.',
        },
        {
          kind: 'action',
          actionId: 'refuse-single-use-cup',
          text: 'Do this today: skip one single-use cup, bag or bottle.',
        },
      ],
    },
  ],
  doNext: [
    { actionId: 'recycle-aluminium-can', label: 'Recycle an aluminium can' },
    { actionId: 'refuse-single-use-cup', label: 'Refuse a single-use cup' },
  ],
  quiz: [
    {
      id: 'recycling-honestly-q1',
      prompt: "About what share of the world's plastic waste is recycled?",
      options: ['45%', '80%', '9%'],
      correct: 2,
      explanation: 'OECD Global Plastics Outlook, 2022 figures.',
    },
    {
      id: 'recycling-honestly-q2',
      prompt: 'Recycling aluminium saves about ___ of the energy needed to make it new.',
      options: ['95%', '50%', '5%'],
      correct: 0,
      explanation: 'Metals recycle far better than plastics.',
    },
    {
      id: 'recycling-honestly-q3',
      prompt: '"Wish-cycling" is…',
      options: [
        'Recycling an item twice',
        'Putting doubtful items in the recycling and hoping',
        'Composting paper',
      ],
      correct: 1,
      explanation: 'It contaminates loads. Check your local list instead.',
    },
  ],
  sources: sourcesFor(
    'oecdPlastics2022',
    'iaiRecycling',
    'desnz2026',
    'wynes2017',
    'epaBatteries',
    'warmOrganics',
  ),
  claims: [
    {
      id: 'recycle-plastic',
      figure: '9%',
      statement:
        'Only 9% of plastic waste was ultimately recycled (19% incinerated, almost 50% landfilled, 22% uncontrolled).',
      source: 'oecdPlastics2022',
      basis: 'web',
      note: 'OECD Global Plastics Outlook, published February 2022 (2019 data).',
    },
    {
      id: 'recycle-aluminium',
      figure: '95%',
      statement:
        'Recycled aluminium needs 8.3 GJ per tonne against 186 GJ for primary, a 95.5% energy saving (2019 data).',
      source: 'iaiRecycling',
      basis: 'web',
    },
    {
      id: 'recycle-everything',
      figure: '0.2 tonnes',
      statement:
        'Thorough recycling saves about 0.2 tCO2e per year in a high-income country (0.21 in the paper).',
      source: 'wynes2017',
      basis: 'evidence-base',
    },
    {
      id: 'recycle-plastic-quiz',
      figure: '9%',
      statement: 'Quiz wording for the same figure.',
      source: 'oecdPlastics2022',
      basis: 'web',
    },
    {
      id: 'recycle-al-co2e',
      figure: '89%',
      statement:
        'UK 2026 material-use factors: aluminium cans and foil 9.114 kg CO2e per kg from primary material against 0.994 from recycled (closed loop), 89% less.',
      source: 'desnz2026',
      basis: 'evidence-base',
      note: 'Cradle-to-gate factors per kilogram of material. Derived by us from two published factors.',
    },
    {
      id: 'recycle-glass-co2e',
      figure: '41%',
      statement: 'Glass: 1.403 kg CO2e per kg primary against 0.823 recycled, 41% less.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
    {
      id: 'recycle-paper-co2e',
      figure: '22%',
      statement: 'Paper: 1.344 kg CO2e per kg primary against 1.049 recycled, 22% less.',
      source: 'desnz2026',
      basis: 'evidence-base',
    },
  ],
  reviewBy: '2027-10-06',
};
