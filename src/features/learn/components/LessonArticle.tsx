'use client';

import { ExternalLink, Plus } from 'lucide-react';
import type { Ref } from 'react';
import { logLink } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import type { Lesson, LessonBlock, LessonSection } from '@/data/content';
import { formatLongDate } from '@/lib/format';
import { Button, Card, HonestyMark, Sticker, UiLink } from '@/ui';
import { LEARN_COPY } from '../copy';
import {
  claimEstimate,
  claimForFact,
  sourceByKey,
  sourceHref,
  sourceShortLabel,
  statWithoutApprox,
} from '../model/claims';
import { richText } from '../model/richText';

type FactBlock = Extract<LessonBlock, { kind: 'fact' }>;
type ActionBlock = Extract<LessonBlock, { kind: 'action' }>;

const MONO_LINK =
  'rounded-xs text-ink underline decoration-2 underline-offset-4 fine:hover:bg-yellow-tint';

/**
 * A pull-stat: one figure on a highlighter slab, one line, one source. The honesty mark in front
 * of the figure opens the claim behind it: what exactly it states, how it was checked and where.
 */
function PullStat({ lesson, block }: { lesson: Lesson; block: FactBlock }) {
  const claim = claimForFact(lesson.claims, block);
  const estimate = claim ? claimEstimate(claim, lesson.reviewBy) : null;
  const source = sourceByKey(block.source);

  return (
    <figure className="rounded-md border-3 border-ink bg-paper p-4 shadow-3 md:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {estimate ? <HonestyMark source={estimate} /> : null}
        <span className="highlighter px-2 py-1.5 type-figure text-display-sm [--slab:var(--color-yellow)] md:text-display-md">
          {richText(estimate ? statWithoutApprox(block.stat) : block.stat)}
        </span>
      </div>
      <figcaption className="mt-3.5">
        <span className="block text-body">{richText(block.text)}</span>
        {source ? (
          <span className="mt-2 block type-slug leading-[1.6] text-ink-3">
            {LEARN_COPY.factSource} ·{' '}
            <UiLink href={sourceHref(block.source)} className={MONO_LINK}>
              {sourceShortLabel(source)}
            </UiLink>
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** The "do this today" line: the lesson's one concrete step, with a button that opens the log on it. */
function DoToday({ block }: { block: ActionBlock }) {
  const action = ACTION_BY_ID.get(block.actionId);
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-md border-3 border-ink bg-green-tint p-3.5 md:p-4">
      {action ? (
        <span aria-hidden="true" className="shrink-0">
          <Sticker category={action.category} size={44} rotate={-3} />
        </span>
      ) : null}
      <p className="min-w-0 flex-1 basis-56 text-body font-semibold">{richText(block.text)}</p>
      <Button asChild variant="primary" size="sm" icon={Plus}>
        <UiLink href={logLink(block.actionId, undefined, 'lesson')}>
          {LEARN_COPY.doTodayAction}
        </UiLink>
      </Button>
    </div>
  );
}

function Block({ lesson, block }: { lesson: Lesson; block: LessonBlock }) {
  switch (block.kind) {
    case 'p':
      return <p>{richText(block.text)}</p>;
    case 'list':
      return (
        <ul className="grid gap-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-[0.68em] size-2 shrink-0 rotate-45 rounded-[2px] bg-ink"
              />
              <span className="min-w-0">{richText(item)}</span>
            </li>
          ))}
        </ul>
      );
    case 'fact':
      return <PullStat lesson={lesson} block={block} />;
    case 'action':
      return <DoToday block={block} />;
    default: {
      const unknown: never = block;
      return unknown;
    }
  }
}

function Section({ lesson, section }: { lesson: Lesson; section: LessonSection }) {
  const headingId = `lesson-${section.id}`;
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2 id={headingId} className="scroll-mt-32 text-h2">
        {richText(section.heading)}
      </h2>
      {section.blocks.map((block, index) => (
        <Block key={`${section.id}-${index}`} lesson={lesson} block={block} />
      ))}
    </section>
  );
}

function Sources({ lesson }: { lesson: Lesson }) {
  return (
    <section aria-labelledby="lesson-sources" className="border-t-[1.5px] border-ink pt-5">
      <h2 id="lesson-sources" className="text-h3">
        {LEARN_COPY.sourcesHeading}
      </h2>
      <ol className="mt-3 grid gap-3">
        {lesson.sources.map((source, index) => (
          <li key={source.key} className="flex gap-3">
            <span aria-hidden="true" className="w-5 shrink-0 pt-0.5 font-mono text-data text-ink-3">
              {index + 1}.
            </span>
            <div className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link text-body-sm"
              >
                {source.title}
                <ExternalLink
                  size={14}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="ml-1 inline-block align-[-0.12em]"
                />
                <span className="sr-only"> {LEARN_COPY.newTab}</span>
              </a>
              <p className="mt-1 type-slug leading-[1.6] text-ink-3">
                {source.publisher} · {source.year} ·{' '}
                <UiLink
                  href={sourceHref(source.key)}
                  aria-label={`${LEARN_COPY.sourceNotes}: ${source.title}`}
                  className={MONO_LINK}
                >
                  {LEARN_COPY.sourceNotes}
                </UiLink>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-caption text-ink-3">
        {LEARN_COPY.sourcesReview(formatLongDate(lesson.reviewBy))}
      </p>
    </section>
  );
}

/**
 * The lesson itself, always on a white card: sections of reading text, pull-stats, the one
 * "do this today" step, and the numbered sources. `ref` is what reading progress measures.
 */
export function LessonArticle({ lesson, ref }: { lesson: Lesson; ref: Ref<HTMLElement> }) {
  return (
    <Card as="article" ref={ref} aria-label={lesson.title}>
      <div className="grid gap-8 text-reading md:gap-10">
        {lesson.sections.map((section) => (
          <Section key={section.id} lesson={lesson} section={section} />
        ))}
        <Sources lesson={lesson} />
      </div>
    </Card>
  );
}
