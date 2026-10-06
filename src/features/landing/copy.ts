/**
 * Every word of the landing page, in one place.
 * Rules this file follows: headlines of six words or fewer, body copy of two lines or fewer,
 * sentence case; estimates are "estimates" and carry the drawn mark at the call site; we say
 * "avoided", never "saved"; nothing here is a number about other people, because there are
 * none to count.
 */
import { BRAND } from '@/lib/brand';

export const HERO = {
  title: 'Grow a tree with small actions.',
  sub: 'Log what you did. See an honest estimate.',
  action: 'Plant your tree',
  treeLabel: 'An illustrated oak tree, fully grown, on a small island.',
} as const;

export const HOW = {
  title: 'How it works',
  steps: [
    {
      id: 'log',
      title: 'Log an action',
      line: 'Pick what you did. It takes a few seconds.',
    },
    {
      id: 'see',
      title: 'See the estimate',
      line: 'Get an honest figure for the carbon you avoided.',
    },
    {
      id: 'grow',
      title: 'Watch it grow',
      line: 'Every action adds leaves. Your tree never dies.',
    },
  ],
} as const;

export const TRY = {
  title: 'Try it. Tap a sticker.',
  treeName: 'Demo tree',
  hint: 'Each sticker shows its real estimate.',
  avoided: 'avoided',
  /** Shown instead of a figure if a sticker ever loses its factor: no number is made up. */
  noEstimate: 'stuck on',
  note: 'A sped-up demo. Nothing is saved.',
} as const;

export const HONEST = {
  title: 'An estimate, and it says so',
  /** The drawn mark sits between these two halves; screen readers hear `markSpoken` in its place. */
  bodyLead: 'Every carbon figure carries this',
  markSpoken: '"approximately"',
  bodyTail:
    'mark, because it is an estimate, not a measurement. Tap it to see the comparison, the likely range and the source.',
  link: 'See how we count',
} as const;

export const FAQ = {
  title: 'Questions',
  items: [
    {
      id: 'free',
      question: 'Is it free?',
      answer: `Yes. ${BRAND.name} has no price, no ads and nothing to buy.`,
    },
    {
      id: 'data',
      question: 'Where is my data?',
      answer:
        'On this device, in your browser. There is no account, and you can export or delete everything.',
    },
    {
      id: 'accuracy',
      question: 'How accurate are the numbers?',
      answer:
        'They are careful estimates. Each one comes from a published source and shows its likely range.',
    },
    {
      id: 'missed-day',
      question: 'What if I miss a day?',
      answer: 'Your tree waits for you. It may look thirsty, but it never dies and never shrinks.',
    },
  ],
} as const;

export const FINAL = {
  title: 'Ready to plant yours?',
  body: 'It takes about two minutes. No account, no email.',
  action: 'Plant your tree',
} as const;

/** Text alternative of the demo stage: what the picture shows, in words. */
export function demoTreeLabel(stage: string): string {
  return `The demo tree, an illustrated oak on a small island. Stage: ${stage}.`;
}
