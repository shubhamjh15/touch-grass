/**
 * Editorial starter posts for the community journal. They are written by the team, labelled
 * "Editorial · Starter pack" with the content version instead of a time, and offer "Save" and
 * "Try it", never likes. Nothing here imitates a crowd. Each post is 80 words or fewer, and its
 * facts are sourced as in Learn.
 */
import type { CatalogueActionId } from './catalogue/actions';
import { sourcesFor } from './lessons/sources';
import type { Claim, SourceRef } from './lessons/types';

/** Printed under every team post in place of a timestamp. */
export const CONTENT_VERSION = '2026.10';

export const EDITORIAL_AUTHOR = 'Touch Grass team';

export const EDITORIAL_LABEL = 'Editorial · Starter pack';

export type EditorialTag = 'Win' | 'Idea' | 'Wobble' | 'Question';

export interface EditorialPost {
  id: string;
  title: string;
  /** Plain text, 80 words or fewer. */
  body: string;
  authoredBy: typeof EDITORIAL_AUTHOR;
  label: typeof EDITORIAL_LABEL;
  contentVersion: string;
  tag: EditorialTag;
  /** The "Try it" log chip, when the post is about an action. */
  tryActionId: CatalogueActionId | null;
  /** An in-app route for posts that are not about an action. */
  tryRoute: '/today' | null;
  sources: readonly SourceRef[];
  claims: readonly Claim[];
  reviewBy: string;
}

const REVIEW_BY = '2027-10-06';

export const EDITORIAL_POSTS: readonly EditorialPost[] = [
  {
    id: 'meal-you-half-like',
    title: 'Start with the meal you already half-like',
    body: 'Skip the big announcement. Look at a dish you already enjoy that is nearly plant-based: bean chili, lentil curry, pasta with tomato and vegetables. Beans and lentils come in at about 1 to 2 kg CO2e per kg of food. Beef from a beef herd is about 100. One easy meal, repeated, beats a perfect week you never do.',
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Idea',
    tryActionId: 'plant-based-meal',
    tryRoute: null,
    sources: sourcesFor('pnFoodKg'),
    claims: [
      {
        id: 'edit-meal-pulses',
        figure: '1 to 2 kg',
        statement: 'Peas average 0.98 and other pulses 1.79 kg CO2e per kg of food.',
        source: 'pnFoodKg',
        basis: 'evidence-base',
      },
      {
        id: 'edit-meal-beef',
        figure: 'about 100',
        statement: 'Beef from beef herds averages 99.48 kg CO2e per kg.',
        source: 'pnFoodKg',
        basis: 'evidence-base',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'thirty-degree-habit',
    title: 'The 30 °C habit',
    body: "About 90% of a washing machine's energy goes to heating the water. So the cheapest saving in the house is a dial: move a normal load from 40 °C to 30 °C, or to cold. Keep a hot wash for towels, bedding and the occasional muddy day.",
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Idea',
    tryActionId: 'wash-cold-instead-of-40',
    tryRoute: null,
    sources: sourcesFor('energyStarWashers'),
    claims: [
      {
        id: 'edit-wash-90',
        figure: '90%',
        statement:
          'Water heating consumes about 90% of the energy it takes to operate a clothes washer.',
        source: 'energyStarWashers',
        basis: 'web',
      },
      {
        id: 'edit-wash-40',
        figure: '40 °C to 30 °C',
        statement: 'The comparison the catalogue uses for the wash actions.',
        source: 'energyStarWashers',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'short-trips',
    title: 'Short trips are the low-hanging fruit',
    body: 'In the United States, about half of all trips are shorter than 3 miles (5 km). Many of those are a walk or a short ride away. Pick the one trip you make every week, such as the shop, the school run or the gym, and try it without the car. See how it feels for a week.',
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Idea',
    tryActionId: 'walk-cycle-instead-of-car',
    tryRoute: null,
    sources: sourcesFor('doeTrips'),
    claims: [
      {
        id: 'edit-trips-half',
        figure: '3 miles (5 km)',
        statement: 'About half of US trips are under three miles (50% in the NHTS; 52% in 2021).',
        source: 'doeTrips',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'use-it-up-night',
    title: 'One use-it-up night a week',
    body: 'About 60% of the food wasted in shops, restaurants and homes is wasted in homes, so the fridge is where this is won. Pick one evening a week to cook whatever needs eating: wilting greens into a soup, bread ends into croutons, the last of the rice into fried rice. It is dinner and a small act of rescue in one.',
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Idea',
    tryActionId: 'meal-saved-from-waste',
    tryRoute: null,
    sources: sourcesFor('unepFwi2024'),
    claims: [
      {
        id: 'edit-useitup-60',
        figure: '60%',
        statement: '60% of the food wasted in 2022 was wasted in households.',
        source: 'unepFwi2024',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'three-vampires',
    title: 'Find your three vampires',
    body: "Standby power is an estimated 5 to 10% of a home's electricity. Walk around once and find the three biggest sleepers: usually a TV with a box and a console, a desk with a monitor and a printer, and a kitchen full of clocks. Put each on a switched strip. You do it once, and it keeps working while you forget about it.",
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Idea',
    tryActionId: 'standby-off',
    tryRoute: null,
    sources: sourcesFor('lblStandby'),
    claims: [
      {
        id: 'edit-vampires-standby',
        figure: '5 to 10%',
        statement: 'Standby power is 5-10% of residential electricity use.',
        source: 'lblStandby',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'four-questions',
    title: 'Four questions before you buy it new',
    body: "Most of a thing's footprint is made before it reaches you: about 80% for an iPhone 17, by Apple's own figures. So ask four things. Do I need it? Can I borrow it? Could I find it second-hand? Could I fix what I already have? Only then buy new, and choose something built to last. Most of the time one of the first three wins.",
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Question',
    tryActionId: 'borrow-instead-of-buy',
    tryRoute: null,
    sources: sourcesFor('appleIphone17'),
    claims: [
      {
        id: 'edit-four-80',
        figure: '80%',
        statement:
          'Production (53% + 23%) and transportation (4%) are 80% of the 55 kg CO2e life-cycle total of an iPhone 17.',
        source: 'appleIphone17',
        basis: 'evidence-base',
      },
      {
        id: 'edit-four-model',
        figure: 'iPhone 17',
        statement: 'The product the Product Environmental Report covers.',
        source: 'appleIphone17',
        basis: 'evidence-base',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'talk-without-a-fight',
    title: 'How to talk about climate without a fight',
    body: 'In a survey of nearly 130,000 people in 125 countries, 89% wanted their government to do more on climate, yet most people think others care less than they do. So start from what you share. Ask a question before you give an answer. Share one thing that worked for you, not a lecture. A calm conversation is a real action.',
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Question',
    tryActionId: 'climate-conversation',
    tryRoute: null,
    sources: sourcesFor('andre2024'),
    claims: [
      {
        id: 'edit-talk-130k',
        figure: '130,000',
        statement: 'Nearly 130,000 people were interviewed.',
        source: 'andre2024',
        basis: 'web',
      },
      {
        id: 'edit-talk-125',
        figure: '125 countries',
        statement: 'A representative survey in 125 countries.',
        source: 'andre2024',
        basis: 'web',
      },
      {
        id: 'edit-talk-89',
        figure: '89%',
        statement:
          "89% demanded intensified political action, and people systematically underestimate others' willingness to act.",
        source: 'andre2024',
        basis: 'web',
      },
    ],
    reviewBy: REVIEW_BY,
  },
  {
    id: 'missed-a-week',
    title: 'Missed a week? Read this',
    body: 'Your tree is fine. In Touch Grass a missed day never kills it. It gets thirsty, and it waits. There is no penalty and no lecture. Life gets busy, and the habit is the thing worth keeping, not a perfect record. Open Today, water your tree, and log one small thing. That is a full restart.',
    authoredBy: EDITORIAL_AUTHOR,
    label: EDITORIAL_LABEL,
    contentVersion: CONTENT_VERSION,
    tag: 'Wobble',
    tryActionId: null,
    tryRoute: '/today',
    sources: [],
    claims: [],
    reviewBy: REVIEW_BY,
  },
];

export const EDITORIAL_BY_ID: ReadonlyMap<string, EditorialPost> = new Map(
  EDITORIAL_POSTS.map((post) => [post.id, post]),
);
