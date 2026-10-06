'use client';

import { ArrowRight, Lightbulb, Timer } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { OFFLINE_LABEL, chipHref, offlineTip, parseCoachText, type ChipSegment } from '@/ai';
import { PageSection, ROUTES, openCoach } from '@/app/shell';
import { ACTION_BY_ID, ACTION_IDS } from '@/data/catalogue';
import { FACTS, LESSONS, LESSON_IDS } from '@/data/content';
import {
  DAILY_FACT_COUNT,
  getCoachContext,
  useGameNow,
  useGameState,
  useToday,
  useTreeStatus,
} from '@/game';
import { formatNumber } from '@/lib/format';
import { play } from '@/lib/sfx';
import { Button, Card, MossFace, TabPanel, Tabs, Tag, TapeNote } from '@/ui';
import { BREAK_COPY, COPY } from '../copy';
import { stickerLabel } from '../stickerLabels';

const LESSON_TITLES: Readonly<Record<string, string>> = Object.fromEntries(
  LESSONS.map((lesson) => [lesson.id, lesson.title]),
);

type View = 'tip' | 'fact';

function chipLabel(chip: ChipSegment): string {
  switch (chip.kind) {
    case 'log': {
      const action = ACTION_BY_ID.get(chip.actionId);
      return action ? `Log: ${stickerLabel(action)}` : COPY.logAction;
    }
    case 'learn': {
      const title = LESSON_TITLES[chip.slug];
      return title ? `Read: ${title}` : 'Read the lesson';
    }
    case 'quest':
      return 'Open quests';
    case 'break':
      return `Take a ${formatNumber(chip.minutes)}-minute break`;
  }
}

/**
 * Moss's note for today. It always comes from the built-in rules (product spec 8.6), so it
 * works without a key and offline, and it says so. Its chip only opens the next step
 * prefilled: nothing is ever logged from here.
 */
function Tip({ onBreak }: { onBreak: (minutes: number) => void }) {
  const tree = useTreeStatus();
  const now = useGameNow();
  // The saved state is the trigger: any log, claim or new day may change which rule fires.
  const saved = useGameState((game) => game);

  const tip = useMemo(() => {
    const reply = offlineTip(getCoachContext({ lessonTitles: LESSON_TITLES }), tree.dayNumber);
    const segments = parseCoachText(reply.text, {
      actions: ACTION_IDS,
      lessonSlugs: LESSON_IDS,
      maxChips: 1,
    });
    return {
      text: segments
        .map((segment) => (segment.type === 'text' ? segment.text : ''))
        .join('')
        .trim(),
      chip: segments.find((segment): segment is ChipSegment => segment.type === 'chip') ?? null,
    };
    // The context is read from the live store, so `saved` and `now` are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, now, tree.dayNumber]);

  const { chip } = tip;

  return (
    <div className="px-1 pt-2">
      <TapeNote author="Moss says:" rotate={0}>
        {tip.text}
        <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {chip?.kind === 'break' ? (
            <Button size="sm" variant="neutral" icon={Timer} onClick={() => onBreak(chip.minutes)}>
              {chipLabel(chip)}
            </Button>
          ) : chip ? (
            <Button asChild size="sm" variant="neutral" iconRight={ArrowRight}>
              <Link href={chipHref(chip)}>{chipLabel(chip)}</Link>
            </Button>
          ) : null}
          <span className="ml-auto type-tick text-ink-3">{OFFLINE_LABEL}</span>
        </span>
      </TapeNote>
    </div>
  );
}

/**
 * The daily fact turns over with the day's check-in. Before it, the panel is a die-line: a
 * small reason to water the tree, never a locked reward.
 */
function Fact({ onBreak }: { onBreak: () => void }) {
  const today = useToday();
  const tree = useTreeStatus();
  const ref = today.fact;
  const fact = ref ? FACTS[ref.number - 1] : undefined;

  if (!ref || !fact) {
    return (
      <div className="flex items-center gap-3 rounded-lg dieline px-4 py-3 text-ink-2">
        <Lightbulb size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
        <p className="text-body-sm">
          {today.checkedIn
            ? 'The fact for today is on its way.'
            : `The fact for today turns over when ${tree.name} is watered.`}
        </p>
      </div>
    );
  }

  return (
    <Card tone="paper" className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="type-slug text-ink-3">
          {COPY.factSlug} · Nº {String(ref.number).padStart(2, '0')} of{' '}
          {formatNumber(DAILY_FACT_COUNT)}
        </p>
        {fact.hopeful ? <Tag hue="green">Progress</Tag> : null}
      </div>
      <p className="text-body text-ink">{fact.text}</p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="type-tick text-ink-3">Source: {fact.sourceLabel}</p>
        {fact.link.kind === 'lesson' ? (
          <Button asChild size="sm" variant="neutral" iconRight={ArrowRight}>
            <Link href={ROUTES.lesson(fact.link.lessonId)}>{COPY.factMore}</Link>
          </Button>
        ) : (
          <Button size="sm" variant="neutral" icon={Timer} onClick={onBreak}>
            {BREAK_COPY.start}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * One suggested next step, and the day's fact behind a second tab. Two small things that
 * used to be two cards; here they share a heading and only one shows at a time.
 */
export function NextUp({ onBreak }: { onBreak: (minutes?: number) => void }) {
  const [view, setView] = useState<View>('tip');

  return (
    <PageSection
      id="next"
      title={COPY.nextHeading}
      aside={
        <button
          type="button"
          className="hit-3 inline-flex shrink-0 cursor-pointer items-center gap-1.5 link rounded-xs text-body-sm font-semibold"
          onClick={() => {
            play('tap');
            openCoach();
          }}
        >
          <MossFace size={18} />
          {COPY.askMoss}
        </button>
      }
    >
      <Tabs
        aria-label={COPY.nextHeading}
        value={view}
        onValueChange={setView}
        tabs={[
          { value: 'tip', label: COPY.nextTip },
          { value: 'fact', label: COPY.nextFact },
        ]}
      >
        <TabPanel value="tip" bare>
          <Tip onBreak={onBreak} />
        </TabPanel>
        <TabPanel value="fact" bare>
          <Fact onBreak={() => onBreak()} />
        </TabPanel>
      </Tabs>
    </PageSection>
  );
}
