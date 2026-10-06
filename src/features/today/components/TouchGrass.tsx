'use client';

import { Check, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageSection } from '@/app/shell';
import {
  BREAK_DURATIONS_MIN,
  JOURNAL_MAX_CHARS,
  gameActions,
  useGameNow,
  useToday,
  useTreeStatus,
  type TouchGrassStatus,
} from '@/game';
import { formatNumber, formatTime } from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Button,
  Card,
  Field,
  Modal,
  Panel,
  Segmented,
  Stamp,
  Textarea,
  type SegmentedOption,
} from '@/ui';
import { BREAK_COPY } from '../copy';
import { breakRewardPreview, partOfDay, stampDate } from '../model';
import type { BreakFlow } from '../useBreakFlow';

const DURATION_OPTIONS: readonly SegmentedOption[] = BREAK_DURATIONS_MIN.map((minutes) => ({
  value: String(minutes),
  label: `${formatNumber(minutes)} min`,
}));

function minutesOutside(stats: TouchGrassStatus['stats']): string | null {
  if (stats.breaksKept === 0) return null;
  return `${formatNumber(stats.minutesThisWeek)} min outside this week · ${formatNumber(stats.minutesTotal)} min in all`;
}

/**
 * The group that offers a break: one sentence, one reward-coloured button. The rules, the
 * safety note and the length all wait in the start sheet.
 */
export function TouchGrassCard({ flow }: { flow: BreakFlow }) {
  const tree = useTreeStatus();
  const { status } = flow;
  const outside = minutesOutside(status.stats);
  const waiting = status.cooldownMin > 0;

  return (
    <PageSection id="touch-grass" title={BREAK_COPY.slug}>
      <Card tone="yellow" className="grid gap-3">
        <p className="text-h4 text-ink">{BREAK_COPY.cardTitle}</p>
        <p className="text-body-sm text-ink-2">{BREAK_COPY.line(tree.name)}</p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button
            variant="reward"
            icon={Timer}
            disabledReason={
              waiting ? `${BREAK_COPY.cooldown(status.cooldownMin)}. ${BREAK_COPY.gap}` : undefined
            }
            onClick={() => flow.openSheet()}
          >
            {BREAK_COPY.start}
          </Button>
          <p className="type-tick text-ink-3">
            {waiting
              ? BREAK_COPY.cooldown(status.cooldownMin)
              : (outside ?? BREAK_COPY.noPermissions)}
          </p>
        </div>
        {status.rewardedToday ? (
          <p className="text-caption text-ink-2">{BREAK_COPY.alreadyRewarded}</p>
        ) : null}
      </Card>
    </PageSection>
  );
}

/** Choosing a length and starting. The rules printed here are read from the engine. */
export function BreakStartSheet({ flow }: { flow: BreakFlow }) {
  const tree = useTreeStatus();
  const { status, sheet } = flow;
  const [picked, setPicked] = useState<{ minutes: number; from: number } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // A choice belongs to the suggestion it replaced: reopening with another length starts fresh.
  const minutes = picked && picked.from === sheet.minutes ? picked.minutes : sheet.minutes;
  const waiting = status.cooldownMin > 0;

  const start = () => {
    const result = flow.start(minutes);
    if (result.ok) {
      play('toggle');
      setPicked(null);
      setRefusal(null);
      return;
    }
    setRefusal(
      result.reason === 'cooldown'
        ? `${BREAK_COPY.cooldown(result.waitMin ?? status.cooldownMin)}. ${BREAK_COPY.gap}`
        : result.reason === 'already-running'
          ? 'A break is already running.'
          : "That break couldn't start. Try another length.",
    );
  };

  return (
    <Modal
      open={sheet.open}
      onOpenChange={(open) => {
        if (!open) {
          flow.closeSheet();
          setRefusal(null);
        }
      }}
      title={BREAK_COPY.slug}
      description={BREAK_COPY.line(tree.name)}
      size="sm"
      footer={
        <Button
          variant="reward"
          size="lg"
          icon={Timer}
          fullWidth
          disabledReason={waiting ? BREAK_COPY.cooldown(status.cooldownMin) : undefined}
          onClick={start}
        >
          {BREAK_COPY.startNow}
        </Button>
      }
    >
      <div className="grid gap-4">
        <Segmented
          aria-label="Break length"
          value={String(minutes)}
          onValueChange={(value) => {
            play('tick');
            setPicked({ minutes: Number(value), from: sheet.minutes });
          }}
          options={DURATION_OPTIONS}
          fullWidth
        />
        <p className="font-mono text-data-sm text-ink" data-testid="break-reward">
          {breakRewardPreview(minutes, status.rewardedToday)}
        </p>
        <Panel variant="well" className="grid gap-1.5 text-caption text-ink-2">
          <p>{BREAK_COPY.rules}</p>
          <p>{BREAK_COPY.endingEarly}</p>
          <p>{BREAK_COPY.noSensors}</p>
        </Panel>
        <p className="text-caption text-ink-2">{BREAK_COPY.safety}</p>
        <p role="alert" className="text-caption font-bold text-ink empty:hidden">
          {refusal}
        </p>
      </div>
    </Modal>
  );
}

/**
 * The desk while a break runs. It shows when to come back, not a countdown: the point is
 * to stop looking. Focus lands on the heading so a screen reader hears the return time.
 */
export function BreakAway({ flow }: { flow: BreakFlow }) {
  const tree = useTreeStatus();
  const now = useGameNow();
  const heading = useRef<HTMLHeadingElement>(null);
  const active = flow.status.active;
  const returning = flow.phase === 'returning';

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [returning]);

  if (!active) return null;

  const night = partOfDay(now) === 'night';
  const aside = night
    ? BREAK_COPY.night
    : active.plannedMin >= 20
      ? BREAK_COPY.away[1](tree.name)
      : BREAK_COPY.away[0];

  if (returning) {
    return (
      <section aria-label={BREAK_COPY.slug} className="grid gap-5">
        <p className="type-slug text-ink-3">{BREAK_COPY.slug}</p>
        <h1 ref={heading} tabIndex={-1} className="text-h1 text-ink outline-hidden">
          {BREAK_COPY.returnTitle}
        </h1>
        <div className="grid gap-3">
          <Button variant="primary" size="lg" fullWidth onClick={() => flow.answer('outside')}>
            {BREAK_COPY.outside}
          </Button>
          <Button variant="neutral" size="lg" fullWidth onClick={() => flow.answer('rested')}>
            {BREAK_COPY.rested}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => flow.answer('none')}>
            {BREAK_COPY.none}
          </Button>
        </div>
        <p className="text-caption text-ink-2">
          The first two count the same. Weather, health and safety are real.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={BREAK_COPY.slug} className="grid gap-5">
      <p className="type-slug text-ink-3">
        {BREAK_COPY.slug} · {formatNumber(active.plannedMin)} min
      </p>
      <h1 ref={heading} tabIndex={-1} className="text-h1 text-ink outline-hidden">
        {flow.timeUp ? "Time's up." : `Back at ${formatTime(active.endsAt)}`}
      </h1>
      <p className="text-lead text-ink" role="status">
        {flow.timeUp ? BREAK_COPY.timeUp : BREAK_COPY.line(tree.name)}
      </p>
      {flow.timeUp ? null : <p className="text-body text-ink-2">{aside}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" icon={Check} onClick={flow.comeBack}>
          {BREAK_COPY.back}
        </Button>
        {flow.timeUp ? null : (
          <Button variant="ghost" size="lg" onClick={flow.endEarly}>
            {BREAK_COPY.endEarly}
          </Button>
        )}
      </div>
      <Panel variant="well" className="grid gap-1.5 text-caption text-ink-2">
        <p>{BREAK_COPY.rules}</p>
        <p>{BREAK_COPY.endingEarly}</p>
      </Panel>
    </section>
  );
}

/** What the break came to, in the engine's own verdict, and the optional one-line note. */
export function BreakResult({ flow }: { flow: BreakFlow }) {
  const today = useToday();
  const heading = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const summary = flow.summary;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  if (!summary) return null;
  const kept = summary.tone !== 'kind';

  const save = () => {
    const result = gameActions.addPost({ text: note, tag: 'touch-grass' });
    if (result.ok) {
      play('toggle');
      setSaved(true);
    }
  };

  return (
    <section aria-label={BREAK_COPY.slug} className="grid gap-5">
      <p className="type-slug text-ink-3">{BREAK_COPY.slug}</p>
      <h1 ref={heading} tabIndex={-1} className="text-h1 text-ink outline-hidden">
        {kept ? `${formatNumber(summary.minutes)} minutes, kept.` : 'Back already.'}
      </h1>
      {kept ? (
        <div className="py-1">
          <Stamp label={BREAK_COPY.stamp} date={stampDate(today.day)} hue="green" animate />
        </div>
      ) : null}
      <p className="text-lead text-ink" role="status">
        {summary.line}
      </p>
      {kept ? (
        saved ? (
          <p className="text-body-sm font-bold text-ink" role="status">
            {BREAK_COPY.noticeSaved}
          </p>
        ) : (
          <div className="grid gap-3">
            <Field label={BREAK_COPY.noticeLabel} hint={BREAK_COPY.noticeHint}>
              <Textarea
                rows={2}
                maxLength={JOURNAL_MAX_CHARS}
                value={note}
                placeholder={BREAK_COPY.noticePlaceholder}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <div>
              <Button
                variant="neutral"
                disabledReason={note.trim() ? undefined : 'Write a line first'}
                onClick={save}
              >
                {BREAK_COPY.noticeSave}
              </Button>
            </div>
          </div>
        )
      ) : null}
      <div>
        <Button variant="primary" size="lg" onClick={flow.closeResult}>
          {BREAK_COPY.done}
        </Button>
      </div>
    </section>
  );
}
