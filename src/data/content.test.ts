/**
 * Schema validation of all learning content: unique ids, valid quiz indices, every source has
 * a URL, every action link exists in the catalogue, dataset years strictly increase, and no
 * string is empty. The companion `claims.test.ts` checks the figures.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_IDS, ACTIONS, CATEGORIES, SOURCES } from './catalogue';
import {
  ACTION_SOURCE_ROWS,
  CONTENT_SOURCES,
  CONTENT_VERSION,
  DATASETS,
  EDITORIAL_AUTHOR,
  EDITORIAL_POSTS,
  FACTS,
  LESSON_CATEGORIES,
  LESSONS,
  METHODOLOGY_SECTIONS,
  MYTHS,
  PRIVACY_SECTIONS,
  PRIVACY_STORED,
  SOURCE_ROWS,
  WORDING_RULES,
  contentSourceRows,
  factForDay,
  type Dataset,
  type Lesson,
  type SourceRef,
} from './content';
import { allContentItems } from './contentItems';

const ACTION_ID_SET: ReadonlySet<string> = new Set(ACTION_IDS);
const LESSON_ID_SET: ReadonlySet<string> = new Set(LESSONS.map((lesson) => lesson.id));
const CATEGORY_ID_SET: ReadonlySet<string> = new Set(CATEGORIES.map((category) => category.id));
const SPEC_LESSON_IDS = [
  'the-blanket',
  'where-it-comes-from',
  'big-levers',
  'on-your-plate',
  'food-we-never-eat',
  'getting-around',
  'power-at-home',
  'stuff',
  'recycling-honestly',
  'good-news',
];

/** Every string reachable from a value, with its path, for the "no empty strings" check. */
function* strings(value: unknown, path = ''): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) yield* strings(entry, `${path}[${index}]`);
  } else if (value instanceof Map) {
    // Lookup maps repeat what the arrays already hold.
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) yield* strings(entry, `${path}.${key}`);
  }
}

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

function lessonProse(lesson: Lesson): string {
  const parts: string[] = [];
  for (const section of lesson.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'p' || block.kind === 'action') parts.push(block.text);
      if (block.kind === 'fact') parts.push(block.text);
      if (block.kind === 'list') parts.push(...block.items);
    }
  }
  return parts.join(' ');
}

function expectSource(source: SourceRef, where: string) {
  expect(source.title.trim(), `${where}: title`).not.toBe('');
  expect(source.publisher.trim(), `${where}: publisher`).not.toBe('');
  expect(source.url, `${where}: url`).toMatch(/^https:\/\/[^\s]+\.[^\s]+$/);
  expect(source.year, `${where}: year`).toBeGreaterThanOrEqual(1990);
  expect(source.year, `${where}: year`).toBeLessThanOrEqual(2027);
}

describe('no empty strings', () => {
  const groups: [string, unknown][] = [
    ['lessons', LESSONS],
    ['myths', MYTHS],
    ['facts', FACTS],
    ['editorial', EDITORIAL_POSTS],
    ['datasets', DATASETS],
    ['methodology', METHODOLOGY_SECTIONS],
    ['wording rules', WORDING_RULES],
    ['privacy sections', PRIVACY_SECTIONS],
    ['privacy stored', PRIVACY_STORED],
    ['content sources', Object.values(CONTENT_SOURCES)],
  ];
  it.each(groups)('%s', (_name, value) => {
    for (const [path, text] of strings(value)) {
      expect(text.trim(), `${path} is empty`).not.toBe('');
      expect(text, `${path} has leading or trailing space`).toBe(text.trim());
      expect(text, `${path} has a double space`).not.toMatch(/ {2}/);
    }
  });
});

describe('content sources', () => {
  it('every source has a title, a publisher, an https URL and a plausible year', () => {
    for (const source of Object.values(CONTENT_SOURCES)) expectSource(source, source.key);
  });

  it('keys match their entries', () => {
    for (const [key, source] of Object.entries(CONTENT_SOURCES)) expect(source.key).toBe(key);
  });

  it('shares URL and year with the catalogue wherever a key is used by both', () => {
    for (const [key, source] of Object.entries(CONTENT_SOURCES)) {
      const shared = SOURCES[key];
      if (!shared) continue;
      expect(source.url, `${key} url`).toBe(shared.url);
      expect(source.year, `${key} year`).toBe(shared.year);
    }
  });

  it('has no source nobody cites', () => {
    const cited = new Set<string>();
    for (const item of allContentItems()) {
      for (const key of item.sourceKeys) cited.add(key);
      for (const claim of item.claims) cited.add(claim.source);
    }
    for (const dataset of DATASETS) cited.add(dataset.sourceKey);
    const unused = Object.keys(CONTENT_SOURCES).filter((key) => !cited.has(key));
    expect(unused).toEqual([]);
  });
});

describe('lessons', () => {
  it('are the ten in the spec, in order, with unique ids', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual(SPEC_LESSON_IDS);
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(10);
  });

  it('use categories that exist', () => {
    const ids = new Set(LESSON_CATEGORIES.map((category) => category.id));
    for (const lesson of LESSONS) expect(ids.has(lesson.category), lesson.id).toBe(true);
  });

  describe.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('%s', (_id, lesson) => {
    it('has four to seven sections with unique ids, headings and content', () => {
      expect(lesson.sections.length).toBeGreaterThanOrEqual(4);
      expect(lesson.sections.length).toBeLessThanOrEqual(7);
      expect(new Set(lesson.sections.map((section) => section.id)).size).toBe(
        lesson.sections.length,
      );
      for (const section of lesson.sections) {
        expect(section.heading.trim()).not.toBe('');
        expect(section.blocks.length).toBeGreaterThan(0);
      }
    });

    it('has one pull-stat, written in short sentences, with a reading time that fits', () => {
      const facts = lesson.sections.flatMap((section) =>
        section.blocks.filter((block) => block.kind === 'fact'),
      );
      expect(facts.length).toBeGreaterThanOrEqual(1);
      const prose = lessonProse(lesson);
      const words = wordsIn(prose);
      expect(words, 'words').toBeGreaterThanOrEqual(250);
      expect(words, 'words').toBeLessThanOrEqual(420);
      expect(lesson.readingMinutes, 'reading time at 150 words a minute').toBe(
        Math.max(2, Math.ceil(words / 150)),
      );
      const sentences = prose.split(/(?<=[.!?])\s+/).filter(Boolean);
      const longest = Math.max(...sentences.map(wordsIn));
      expect(longest, 'longest sentence').toBeLessThanOrEqual(42);
      expect(words / sentences.length, 'average sentence length').toBeLessThanOrEqual(22);
    });

    it('links to catalogue actions that exist', () => {
      const blocks = lesson.sections.flatMap((section) => section.blocks);
      const actionBlocks = blocks.filter((block) => block.kind === 'action');
      expect(actionBlocks.length, 'a do-this-today link').toBeGreaterThanOrEqual(1);
      for (const block of actionBlocks) {
        expect(ACTION_ID_SET.has(block.actionId), `unknown action ${block.actionId}`).toBe(true);
      }
      expect(lesson.doNext).toHaveLength(2);
      expect(new Set(lesson.doNext.map((chip) => chip.actionId)).size).toBe(2);
      for (const chip of lesson.doNext) {
        expect(ACTION_ID_SET.has(chip.actionId), `unknown action ${chip.actionId}`).toBe(true);
        expect(chip.label.trim()).not.toBe('');
      }
    });

    it('has a three-question quiz with valid indices and distinct options', () => {
      expect(lesson.quiz).toHaveLength(3);
      expect(new Set(lesson.quiz.map((question) => question.id)).size).toBe(3);
      for (const question of lesson.quiz) {
        expect(question.options).toHaveLength(3);
        expect(new Set(question.options).size, `${question.id} options`).toBe(3);
        expect([0, 1, 2]).toContain(question.correct);
        expect(question.options[question.correct]).toBeDefined();
        expect(question.prompt.trim()).not.toBe('');
        expect(question.explanation.trim().length).toBeGreaterThan(10);
      }
    });

    it('lists sources with URLs, and every callout source is in the list', () => {
      expect(lesson.sources.length).toBeGreaterThanOrEqual(2);
      const keys = new Set(lesson.sources.map((source) => source.key));
      expect(keys.size).toBe(lesson.sources.length);
      for (const source of lesson.sources) {
        expectSource(source, `${lesson.id}/${source.key}`);
        expect(CONTENT_SOURCES[source.key as keyof typeof CONTENT_SOURCES]).toEqual(source);
      }
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          if (block.kind === 'fact') {
            expect(keys.has(block.source), `callout cites ${block.source}`).toBe(true);
          }
        }
      }
    });

    it('serves product categories that exist', () => {
      expect(lesson.focus.length).toBeGreaterThan(0);
      for (const category of lesson.focus) expect(CATEGORY_ID_SET.has(category)).toBe(true);
    });
  });

  it('does not always put the right answer in the same place', () => {
    const positions = new Set(LESSONS.flatMap((lesson) => lesson.quiz.map((q) => q.correct)));
    expect(positions.size).toBe(3);
  });

  it('covers every product category with at least one lesson', () => {
    const covered = new Set(LESSONS.flatMap((lesson) => lesson.focus));
    for (const category of CATEGORIES) expect(covered.has(category.id), category.id).toBe(true);
  });
});

describe('myth-busters', () => {
  it('are ten with unique ids', () => {
    expect(MYTHS).toHaveLength(10);
    expect(new Set(MYTHS.map((myth) => myth.id)).size).toBe(10);
  });

  it.each(MYTHS.map((myth) => [myth.id, myth] as const))('%s is complete', (_id, myth) => {
    expect(myth.myth).toMatch(/^".+"$/);
    expect(LESSON_ID_SET.has(myth.lessonId), `lesson ${myth.lessonId}`).toBe(true);
    expect(wordsIn(myth.explanation)).toBeLessThanOrEqual(75);
    expect(myth.sources.length).toBeGreaterThanOrEqual(1);
    for (const source of myth.sources) expectSource(source, `${myth.id}/${source.key}`);
    expect(myth.claims.length).toBeGreaterThanOrEqual(1);
  });
});

describe('daily facts', () => {
  it('are thirty with unique ids, and hopeful ones are included', () => {
    expect(FACTS).toHaveLength(30);
    expect(new Set(FACTS.map((fact) => fact.id)).size).toBe(30);
    expect(FACTS.filter((fact) => fact.hopeful).length).toBeGreaterThanOrEqual(8);
  });

  it.each(FACTS.map((fact) => [fact.id, fact] as const))('%s is complete', (_id, fact) => {
    expect(fact.text.length).toBeLessThanOrEqual(220);
    expect(fact.sourceLabel.trim()).not.toBe('');
    expect(CONTENT_SOURCES).toHaveProperty(fact.source);
    expectSource(CONTENT_SOURCES[fact.source as keyof typeof CONTENT_SOURCES], fact.id);
    if (fact.link.kind === 'lesson') {
      expect(LESSON_ID_SET.has(fact.link.lessonId), `lesson ${fact.link.lessonId}`).toBe(true);
    }
  });

  it('link to the lessons the spec names', () => {
    const lessonOf = (n: number) => {
      const link = FACTS[n - 1]?.link;
      return link?.kind === 'lesson' ? link.lessonId : link?.kind;
    };
    expect([1, 2, 13, 14, 22].map(lessonOf)).toEqual(Array(5).fill('power-at-home'));
    expect([3, 4, 21, 29, 30].map(lessonOf)).toEqual(Array(5).fill('good-news'));
    expect([5, 15, 18].map(lessonOf)).toEqual(Array(3).fill('recycling-honestly'));
    expect([6, 7, 25, 26].map(lessonOf)).toEqual(Array(4).fill('food-we-never-eat'));
    expect([8, 9, 23].map(lessonOf)).toEqual(Array(3).fill('on-your-plate'));
    expect([10, 11, 12].map(lessonOf)).toEqual(Array(3).fill('getting-around'));
    expect([16, 17].map(lessonOf)).toEqual(Array(2).fill('stuff'));
    expect([19, 20].map(lessonOf)).toEqual(Array(2).fill('the-blanket'));
    expect(lessonOf(24)).toBe('big-levers');
    expect(lessonOf(27)).toBe('where-it-comes-from');
    expect(lessonOf(28)).toBe('touch-grass');
  });

  it('picks a fact by day and seed, wrapping around', () => {
    expect(factForDay(0, 0)).toBe(FACTS[0]);
    expect(factForDay(29, 0)).toBe(FACTS[29]);
    expect(factForDay(30, 0)).toBe(FACTS[0]);
    expect(factForDay(10, 25)).toBe(FACTS[5]);
    expect(factForDay(-1, 0)).toBe(FACTS[29]);
  });
});

describe('editorial posts', () => {
  it('are the eight in the spec, written by the team', () => {
    expect(EDITORIAL_POSTS).toHaveLength(8);
    expect(new Set(EDITORIAL_POSTS.map((post) => post.id)).size).toBe(8);
    expect(EDITORIAL_POSTS.map((post) => post.title)).toEqual([
      'Start with the meal you already half-like',
      'The 30 °C habit',
      'Short trips are the low-hanging fruit',
      'One use-it-up night a week',
      'Find your three vampires',
      'Four questions before you buy it new',
      'How to talk about climate without a fight',
      'Missed a week? Read this',
    ]);
  });

  it.each(EDITORIAL_POSTS.map((post) => [post.id, post] as const))('%s is honest', (_id, post) => {
    expect(post.authoredBy).toBe(EDITORIAL_AUTHOR);
    expect(post.authoredBy).toBe('Touch Grass team');
    expect(post.label).toBe('Editorial · Starter pack');
    expect(post.contentVersion).toBe(CONTENT_VERSION);
    expect(wordsIn(post.body)).toBeLessThanOrEqual(80);
    expect(post.body).not.toMatch(/\b(likes?|trending|followers?)\b/i);
    if (post.tryActionId) {
      expect(ACTION_ID_SET.has(post.tryActionId), `action ${post.tryActionId}`).toBe(true);
      expect(post.tryRoute).toBeNull();
    } else {
      expect(post.tryRoute).toBe('/today');
    }
    for (const source of post.sources) expectSource(source, `${post.id}/${source.key}`);
  });
});

describe('datasets', () => {
  const EXPECTED_IDS = [
    'atmospheric_co2_mauna_loa',
    'global_temperature_anomaly',
    'fossil_co2_emissions_world',
    'electricity_mix_world',
    'solar_module_price',
    'solar_capacity_world',
    'ev_sales_share',
    'per_capita_emissions',
  ];

  it('are the eight from the spec, with unique ids', () => {
    expect(DATASETS.map((dataset) => dataset.id)).toEqual(EXPECTED_IDS);
  });

  it.each(DATASETS.map((dataset) => [dataset.id, dataset] as const))(
    '%s has full provenance',
    (_id, dataset: Dataset) => {
      expect(dataset.title.trim()).not.toBe('');
      expect(dataset.unit.trim()).not.toBe('');
      expect(dataset.source.trim()).not.toBe('');
      expect(dataset.citation.trim()).not.toBe('');
      expect(dataset.url).toMatch(/^https:\/\//);
      if (dataset.landingPage !== null) expect(dataset.landingPage).toMatch(/^https:\/\//);
      expect(dataset.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dataset.takeaway.length).toBeGreaterThan(40);
      expect(dataset.takeaway).not.toMatch(/NaN|undefined|null/);
      expect(dataset.notes.length).toBeGreaterThan(0);
      expect(CONTENT_SOURCES).toHaveProperty(dataset.sourceKey);
    },
  );

  it('have years that strictly increase and finite values', () => {
    for (const dataset of DATASETS) {
      if (dataset.kind === 'snapshot') continue;
      const lists =
        dataset.kind === 'series'
          ? [dataset.series, ...dataset.comparisons.map((entry) => entry.series)]
          : [dataset.series];
      for (const series of lists) {
        expect(series.length, dataset.id).toBeGreaterThan(5);
        for (const [index, point] of series.entries()) {
          expect(Number.isInteger(point.year), `${dataset.id} year`).toBe(true);
          if (index > 0) {
            expect(point.year, `${dataset.id} ${point.year}`).toBeGreaterThan(
              (series[index - 1] ?? point).year,
            );
          }
          if ('value' in point) expect(Number.isFinite(point.value)).toBe(true);
        }
      }
    }
  });

  it('keep each multi-series field on every point', () => {
    for (const dataset of DATASETS) {
      if (dataset.kind !== 'multi') continue;
      for (const point of dataset.series) {
        for (const field of dataset.fields) {
          expect(Number.isFinite(point[field.key]), `${field.key} ${point.year}`).toBe(true);
        }
      }
    }
  });

  it('keeps snapshot rows unique, with the world row first', () => {
    for (const dataset of DATASETS) {
      if (dataset.kind !== 'snapshot') continue;
      expect(new Set(dataset.rows.map((row) => row.id)).size).toBe(dataset.rows.length);
      expect(dataset.rows[0]?.id).toBe('WORLD');
      for (const row of dataset.rows) expect(row.best).toBeGreaterThan(0);
    }
  });

  it('state the latest year in the takeaway, so it cannot drift from the series', () => {
    for (const dataset of DATASETS) {
      if (dataset.kind === 'snapshot') continue;
      const latest = dataset.series[dataset.series.length - 1];
      expect(dataset.takeaway, dataset.id).toContain(String(latest?.year));
    }
  });

  it('labels the temperature anomaly with its baseline, never "pre-industrial"', () => {
    const temperature = DATASETS.find((dataset) => dataset.id === 'global_temperature_anomaly');
    expect(temperature?.unit).toContain('1951-1980');
    expect(temperature?.takeaway).toContain('1951–1980');
  });
});

describe('methodology', () => {
  it('has unique section ids with content', () => {
    expect(new Set(METHODOLOGY_SECTIONS.map((section) => section.id)).size).toBe(
      METHODOLOGY_SECTIONS.length,
    );
    for (const section of METHODOLOGY_SECTIONS) expect(section.blocks.length).toBeGreaterThan(0);
  });

  it('covers every topic the page must contain', () => {
    const ids = METHODOLOGY_SECTIONS.map((section) => section.id);
    for (const required of [
      'what-it-is',
      'counterfactuals',
      'ranges',
      'regional',
      'double-counting',
      'baseline',
      'not-claimed',
      'wording',
      'versions',
    ]) {
      expect(ids, required).toContain(required);
    }
  });

  it('has one factor-table row per catalogue action, with sources joined by key', () => {
    expect(ACTION_SOURCE_ROWS).toHaveLength(ACTIONS.length);
    for (const row of ACTION_SOURCE_ROWS) {
      expect(row.anchor).toBe(`action-${row.id}`);
      expect(row.sources.map((source) => source.key)).toEqual([...row.sourceKeys]);
      for (const source of row.sources) {
        expect(source.url, `${row.id}/${source.key}`).toMatch(/^https:\/\//);
        expect(SOURCES[source.key]).toBeDefined();
      }
      if (row.confidence === 'not_quantified') {
        expect(row.kgPerUnit, `${row.id} must not show a number`).toBeNull();
      }
      if (row.kgPerUnit !== null) {
        expect(row.sources.length, `${row.id} needs a source`).toBeGreaterThan(0);
        expect(row.comparedWith.trim(), `${row.id} needs a comparison`).not.toBe('');
      }
    }
  });

  it('lists every catalogue source once, with its users', () => {
    expect(SOURCE_ROWS).toHaveLength(Object.keys(SOURCES).length);
    expect(new Set(SOURCE_ROWS.map((row) => row.key)).size).toBe(SOURCE_ROWS.length);
    for (const row of ACTION_SOURCE_ROWS) {
      for (const key of row.sourceKeys) {
        const source = SOURCE_ROWS.find((entry) => entry.key === key);
        expect(source?.actions, key).toContain(row.id);
      }
    }
  });

  it('lists the content sources with whoever cites them', () => {
    const rows = contentSourceRows();
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expectSource(row, row.key);
      expect(row.usedBy.length + row.datasets.length).toBeGreaterThan(0);
    }
  });

  it('prints the numbers from the catalogue, not typed copies', () => {
    const text = METHODOLOGY_SECTIONS.flatMap((section) =>
      section.blocks.map((block) => ('text' in block ? block.text : block.items.join(' '))),
    ).join(' ');
    expect(text).toContain('45 countries and regions');
    expect(text).toMatch(/Factor version 2026\.10/);
  });

  it('never uses the words the wording rules forbid, outside the rule that lists them', () => {
    const forbidden = /\b(carbon neutral|net zero|you saved|cancelled out)\b/i;
    const text = METHODOLOGY_SECTIONS.filter((section) => section.id !== 'wording').flatMap(
      (section) =>
        section.blocks.flatMap((block) => ('text' in block ? [block.text] : [...block.items])),
    );
    for (const entry of text) expect(entry, entry).not.toMatch(forbidden);
  });
});

describe('privacy', () => {
  it('lists the storage keys of the spec glossary', () => {
    const keys = PRIVACY_STORED.map((item) => item.key);
    for (const key of [
      'touchgrass:game',
      'touchgrass:coach',
      'touchgrass:ui',
      'touchgrass:legacy-backup',
    ]) {
      expect(keys).toContain(key);
    }
    expect(new Set(PRIVACY_STORED.map((item) => item.id)).size).toBe(PRIVACY_STORED.length);
  });

  it('has the sections the page must contain', () => {
    const ids = PRIVACY_SECTIONS.map((section) => section.id);
    for (const required of ['short-version', 'stored', 'leaves', 'never-sent', 'not-used']) {
      expect(ids, required).toContain(required);
    }
  });
});

describe('voice', () => {
  it('has no guilt, hype or fabricated crowd in the display text', () => {
    const banned =
      /\b(you must|you should feel|shame on|save the planet|saved the planet|millions of (users|people) (use|are)|join thousands|trending)\b/i;
    for (const item of allContentItems()) {
      expect(item.text, item.label).not.toMatch(banned);
    }
  });
});
