import { describe, expect, it } from 'vitest';
import { ACTION_BY_ID } from '@/data/catalogue';
import { FACTS, LESSONS, MYTHS, type LessonBlock } from '@/data/content';
import { MYTH_COUNT } from '@/game';
import {
  claimEstimate,
  claimForFact,
  sourceByKey,
  sourceHref,
  sourceShortLabel,
  statWithoutApprox,
} from './claims';
import { factLesson } from './library';
import { VERDICT_STAMP, buildMythDeck, mythAnnouncement, mythNumber } from './myths';
import { plainText } from './richText';

type FactBlock = Extract<LessonBlock, { kind: 'fact' }>;

const factBlocks = LESSONS.flatMap((lesson) =>
  lesson.sections.flatMap((section) =>
    section.blocks
      .filter((block): block is FactBlock => block.kind === 'fact')
      .map((block) => ({ lesson, block })),
  ),
);

describe('the paper trail behind a pull-stat', () => {
  it('finds a claim and a registered source for every pull-stat in every lesson', () => {
    expect(factBlocks.length).toBeGreaterThanOrEqual(LESSONS.length);
    for (const { lesson, block } of factBlocks) {
      const claim = claimForFact(lesson.claims, block);
      expect(claim, `${lesson.id}: "${block.stat}"`).not.toBeNull();
      expect(claim?.source).toBe(block.source);
      expect(sourceByKey(block.source), `${lesson.id}: ${block.source}`).not.toBeNull();
    }
  });

  it('prefers the claim whose figure is printed in the stat', () => {
    const blanket = LESSONS.find((lesson) => lesson.id === 'the-blanket');
    const ppm = blanket?.sections
      .flatMap((section) => section.blocks)
      .find((block): block is FactBlock => block.kind === 'fact' && block.stat === '427 ppm');
    expect(blanket && ppm && claimForFact(blanket.claims, ppm)?.figure).toBe('427 ppm');
  });

  it('returns nothing for a source the lesson makes no claim about', () => {
    const lesson = LESSONS[0];
    if (!lesson) throw new Error('no lessons');
    expect(
      claimForFact(lesson.claims, { kind: 'fact', stat: '1', text: 'x', source: 'nobody' }),
    ).toBeNull();
  });

  it('explains a claim: the statement, how it was checked, and where to read more', () => {
    for (const { lesson, block } of factBlocks) {
      const claim = claimForFact(lesson.claims, block);
      if (!claim) throw new Error('missing claim');
      const estimate = claimEstimate(claim, lesson.reviewBy);
      expect(estimate).not.toBeNull();
      expect(estimate?.formula).toBe(claim.statement);
      expect(estimate?.comparedWith).toMatch(/Next review by \w+ \d{1,2}, \d{4}\.$/);
      expect(estimate?.href).toBe(sourceHref(claim.source));
      expect(estimate?.kind).toBe('factor');
    }
    expect(
      claimEstimate(
        { id: 'x', figure: '1', statement: 's', source: 'nobody', basis: 'web' },
        '2027-10-06',
      ),
    ).toBeNull();
  });

  it('links a source to its entry on the methodology page', () => {
    expect(sourceHref('noaaMaunaLoa')).toBe('/methodology#source-noaaMaunaLoa');
    expect(sourceShortLabel({ publisher: 'IPCC', year: 2022 })).toBe('IPCC, 2022');
  });

  it('drops a typed "≈" the honesty mark already draws', () => {
    expect(statWithoutApprox('≈ 33 °C')).toBe('33 °C');
    expect(statWithoutApprox('≈40 g vs 210 g')).toBe('40 g vs 210 g');
    expect(statWithoutApprox('427 ppm')).toBe('427 ppm');
  });
});

describe('what the reader links to', () => {
  it('every "do this" action exists in the catalogue', () => {
    for (const lesson of LESSONS) {
      for (const next of lesson.doNext) {
        expect(ACTION_BY_ID.has(next.actionId), `${lesson.id}: ${next.actionId}`).toBe(true);
      }
      for (const block of lesson.sections.flatMap((section) => section.blocks)) {
        if (block.kind === 'action') {
          expect(ACTION_BY_ID.has(block.actionId), `${lesson.id}: ${block.actionId}`).toBe(true);
        }
      }
    }
  });

  it('every fact that points at a lesson points at a real one', () => {
    for (const fact of FACTS) {
      if (fact.link.kind === 'lesson') expect(factLesson(fact), fact.id).not.toBeNull();
    }
  });
});

describe('the myth deck', () => {
  it('has the ten myths the engine counts, numbered from 1', () => {
    const deck = buildMythDeck([]);
    expect(deck).toHaveLength(MYTH_COUNT);
    expect(deck.map((card) => card.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(deck.every((card) => !card.checked)).toBe(true);
    expect(deck.every((card) => card.lesson !== null)).toBe(true);
  });

  it('marks the cards this device has flipped', () => {
    const deck = buildMythDeck([2, 10]);
    expect(deck.filter((card) => card.checked).map((card) => card.number)).toEqual([2, 10]);
  });

  it('has a stamp for every verdict in the content', () => {
    for (const myth of MYTHS) {
      expect(VERDICT_STAMP[myth.verdict].label.length).toBeGreaterThan(0);
      expect(myth.sources.length).toBeGreaterThan(0);
    }
  });

  it('numbers a card like an album slot', () => {
    expect(mythNumber(3)).toBe('Nº 03');
    expect(mythNumber(10)).toBe('Nº 10');
  });

  it('announces the verdict, the reason and any XP in plain words', () => {
    const myth = { verdictLabel: 'False.', explanation: 'It saves ≈ 0.2 t. A → B.' };
    expect(mythAnnouncement(myth, 5)).toBe('False. It saves about 0.2 t. A to B. Plus 5 XP.');
    expect(mythAnnouncement(myth, 0)).toBe('False. It saves about 0.2 t. A to B.');
  });
});

describe('plain text for announcements', () => {
  it('spells out the drawn glyphs', () => {
    expect(plainText('≈ 280 → 427 ppm')).toBe('about 280 to 427 ppm');
    expect(plainText('  two   spaces ')).toBe('two spaces');
  });
});
