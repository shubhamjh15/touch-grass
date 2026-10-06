'use client';

import { ArrowRight, Droplet } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { ROUTES, TOUCH_GRASS_LINK } from '@/app/routes';
import { useProfile, useToday } from '@/game';
import { TextLink, UiLink } from '@/ui';
import { LEARN_COPY } from '../copy';
import { sourceHref } from '../model/claims';
import { factByNumber, factLesson } from '../model/library';
import { mythNumber } from '../model/myths';
import { richText } from '../model/richText';

const TAPE = { '--tape-color': 'var(--color-pink)' } as CSSProperties;

/**
 * Today's fact, taped to the page. The engine prints one a day after the user has shown up, so
 * before that the slot is an empty die line that says how to fill it. Never a blank.
 */
export function DailyFact({ className }: { className?: string }) {
  const headingId = useId();
  const today = useToday();
  const profile = useProfile();
  const fact = today.fact ? factByNumber(today.fact.number) : null;

  if (!today.fact || !fact) {
    return (
      <aside aria-labelledby={headingId} className={className}>
        <div className="flex h-full flex-col justify-center rounded-lg dieline px-4 py-5">
          <h2 id={headingId} className="type-slug text-ink-3">
            {LEARN_COPY.factSlug}
          </h2>
          <p className="mt-2 text-body font-bold">
            {LEARN_COPY.factWaitingTitle(profile.treeName)}
          </p>
          <p className="mt-1 text-body-sm text-ink-2">{LEARN_COPY.factWaitingBody}</p>
          <UiLink
            href={ROUTES.today}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 self-start link text-body-sm"
          >
            <Droplet size={16} strokeWidth={2.25} aria-hidden="true" />
            {LEARN_COPY.factWaitingAction(profile.treeName)}
          </UiLink>
        </div>
      </aside>
    );
  }

  const lesson = factLesson(fact);
  const more =
    fact.link.kind === 'touch-grass'
      ? { href: TOUCH_GRASS_LINK, label: LEARN_COPY.factBreak }
      : lesson
        ? { href: ROUTES.lesson(lesson.id), label: LEARN_COPY.factMore }
        : null;

  return (
    <aside aria-labelledby={headingId} className={className}>
      <div className="relative flex h-full flex-col rounded-paper border-3 border-ink bg-yellow-tint px-4 pt-6 pb-2 shadow-3">
        <i className="tape" aria-hidden="true" style={TAPE} />
        <h2 id={headingId} className="type-slug text-ink-3">
          {LEARN_COPY.factSlug} · {mythNumber(today.fact.number)}
        </h2>
        <p className="mt-2.5 text-body font-semibold">{richText(fact.text)}</p>
        <p className="mt-2.5 type-slug leading-[1.5] text-ink-2">
          {LEARN_COPY.factSource} ·{' '}
          <UiLink
            href={sourceHref(fact.source)}
            className="hit-2 rounded-xs underline decoration-2 underline-offset-4 fine:hover:bg-yellow"
          >
            {fact.sourceLabel}
          </UiLink>
        </p>
        {more ? (
          <TextLink
            href={more.href}
            className="mt-auto inline-flex min-h-11 items-center gap-1 self-start pt-1 text-body-sm"
          >
            {more.label}
            <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
          </TextLink>
        ) : (
          <span className="pb-2" />
        )}
      </div>
    </aside>
  );
}
