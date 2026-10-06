'use client';

import { ChevronDown, Hourglass, Pin, PinOff } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { gameActions, type EpicStatus } from '@/game';
import { cn } from '@/lib/cn';
import { formatLongDate, formatNumber } from '@/lib/format';
import { dayKey } from '@/lib/dates';
import { play } from '@/lib/sfx';
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Meter,
  Stamp,
  Tag,
  TextLink,
  Textarea,
} from '@/ui';
import { COPY, xpReward } from './copy';
import { HoldButton } from './HoldButton';
import {
  epicActionLinks,
  epicAnchor,
  epicGap,
  epicSteps,
  formLines,
  isXpOnlyEpic,
  withFormLine,
  type EpicGap,
} from './model';
import { ActionChip } from './QuestTicket';

/** Typing saves after this pause, and at once on blur: a save rewrites the whole stored game. */
const NOTE_SAVE_MS = 600;
const NOTE_MAX = 600;

/**
 * The note (or form) of an epic as a local draft, so typing never waits for storage. It is
 * committed after a pause, on blur, before a claim and when the card goes away.
 */
function useNoteDraft(epicId: string, saved: string) {
  const [draft, setDraft] = useState(saved);
  const latest = useRef({ draft, saved });
  useEffect(() => {
    latest.current = { draft, saved };
  });

  const commit = useCallback(() => {
    const { draft: text, saved: stored } = latest.current;
    if (text !== stored) gameActions.updateEpic(epicId, { note: text });
  }, [epicId]);

  useEffect(() => {
    if (draft === saved) return undefined;
    const timer = window.setTimeout(commit, NOTE_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, saved, commit]);

  useEffect(() => commit, [commit]);

  return { draft, setDraft, commit };
}

const GAP_REASON: Record<Exclude<EpicGap, 'cooldown'>, string> = COPY.epics.fillFirst;

export interface EpicCardProps {
  status: EpicStatus;
  /** Actions the user hid: never suggested. */
  hidden: ReadonlySet<string>;
  /** Start unfolded (pinned, begun, or linked to from elsewhere). */
  defaultOpen: boolean;
  /** Claimed during this visit: it stays here, stamped. */
  claimedHere: boolean;
  onClaimed: (epicId: string) => void;
  onAnnounce: (text: string) => void;
}

/**
 * A self-attested epic: a real-world project nobody can verify. The card holds its jobs
 * (a checklist, a short form or one line), an optional note, and the hold-to-confirm that
 * claims it on the user's word, with a plain confirmation beside it for anyone who cannot hold.
 */
export function EpicCard({
  status,
  hidden,
  defaultOpen,
  claimedHere,
  onClaimed,
  onAnnounce,
}: EpicCardProps) {
  const { epic, saved, claimed, pinned } = status;
  const bodyId = useId();
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const { draft, setDraft, commit } = useNoteDraft(epic.id, saved.note);

  const attestation = epic.attestation;
  const steps = epicSteps(status, draft);
  const gap = epicGap(status, draft);
  const actions = epicActionLinks(epic, hidden);

  // The hold button is gone once the epic is claimed: keep keyboard focus on the card.
  useEffect(() => {
    if (claimedHere) root.current?.focus({ preventScroll: true });
  }, [claimedHere]);

  const claim = () => {
    commit();
    const result = gameActions.completeEpic(epic.id, true);
    if (result.ok) onClaimed(epic.id);
  };

  const togglePin = () => {
    play('toggle', { on: !pinned });
    gameActions.pinEpic(pinned ? null : epic.id);
    onAnnounce(pinned ? COPY.epics.unpinnedSaid(epic.title) : COPY.epics.pinnedSaid(epic.title));
  };

  const setChecked = (index: number, checked: boolean) => {
    if (attestation?.kind !== 'checklist') return;
    play('toggle', { on: checked });
    gameActions.updateEpic(epic.id, {
      checklist: attestation.items.map((_, item) =>
        item === index ? checked : saved.checklist[item] === true,
      ),
    });
  };

  return (
    <Card
      as="article"
      ref={root}
      id={epicAnchor(epic.id)}
      tabIndex={-1}
      aria-labelledby={titleId}
      tone={claimed ? 'green' : 'card'}
      data-epic={epic.id}
      data-state={claimed ? 'claimed' : gap === null ? 'ready' : 'open'}
      className="scroll-mt-28 outline-hidden lg:scroll-mt-40"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag hue="pink">Epic</Tag>
            <Tag>{xpReward(epic.xp)}</Tag>
            {pinned ? <Tag hue="yellow">{COPY.epics.pinned}</Tag> : null}
            {!claimed && status.cooldownDays > 0 ? (
              <Tag icon={Hourglass} hue="paper">
                {`Ready in ${formatNumber(status.cooldownDays)} d`}
              </Tag>
            ) : null}
          </div>
          <h4 id={titleId} className="mt-2 text-h4">
            {epic.title}
          </h4>
          <p className={cn('mt-0.5 text-body-sm', claimed ? 'text-ink' : 'text-ink-2')}>
            {epic.copy}
          </p>
        </div>
        {claimed ? (
          <Stamp
            label={COPY.epics.stamp}
            date={saved.claimedTs === null ? undefined : formatLongDate(dayKey(saved.claimedTs))}
            hue="green"
            rotate={6}
            animate={claimedHere}
            className="mt-1 mr-1 shrink-0"
          />
        ) : (
          <IconButton
            label={pinned ? COPY.epics.unpin : COPY.epics.pin}
            icon={pinned ? PinOff : Pin}
            variant={pinned ? 'reward' : 'neutral'}
            size="sm"
            aria-pressed={pinned}
            onClick={togglePin}
            className={pinned ? '-rotate-2' : undefined}
          />
        )}
      </div>

      {claimed ? (
        <div className="mt-3">
          <p className="type-slug text-ink">
            {saved.claimedTs === null
              ? xpReward(epic.xp)
              : COPY.epics.claimedOn(formatLongDate(dayKey(saved.claimedTs)), epic.xp)}
          </p>
          {saved.note.trim() ? (
            <p className="mt-2 border-l-3 border-ink pl-3 text-body-sm whitespace-pre-line">
              <span className="sr-only">{COPY.epics.yourNote}: </span>
              {saved.note.trim()}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {steps.total > 0 ? (
              <div className="flex items-center gap-2">
                <Meter
                  pips
                  value={steps.done}
                  max={steps.total}
                  label={`${epic.title} progress`}
                  valueText={`${formatNumber(steps.done)} of ${formatNumber(steps.total)} done`}
                />
                <span className="font-mono text-data-sm leading-none text-ink-2" aria-hidden="true">
                  {formatNumber(steps.done)} / {formatNumber(steps.total)}
                </span>
              </div>
            ) : (
              <span className="type-slug text-ink-3">{COPY.epics.onYourWord}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconRight={ChevronDown}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((current) => !current)}
              className={cn('-mr-2', open && '[&_svg]:rotate-180')}
            >
              {open ? COPY.epics.close : COPY.epics.start}
              <span className="sr-only">: {epic.title}</span>
            </Button>
          </div>

          <div id={bodyId} hidden={!open} className="mt-3 border-t-2 border-dashed border-ink pt-4">
            {epic.requirement ? (
              <div className="mb-4">
                <p className="type-slug text-ink-3">{COPY.epics.fromLogs}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag hue={status.progress.done ? 'green' : 'white'}>
                    {`${formatNumber(status.progress.current)} / ${formatNumber(status.progress.target)} logged`}
                  </Tag>
                  {status.progress.done
                    ? null
                    : actions.map((action) => <ActionChip key={action.id} action={action} />)}
                </div>
              </div>
            ) : null}

            {attestation?.kind === 'checklist' ? (
              <fieldset className="mb-4">
                <legend className="type-slug text-ink-3">{COPY.epics.checklist}</legend>
                <div className="mt-1 divide-y-[1.5px] divide-line">
                  {attestation.items.map((item, index) => (
                    <Checkbox
                      key={item}
                      label={item}
                      checked={saved.checklist[index] === true}
                      onCheckedChange={(checked) => setChecked(index, checked)}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            {attestation?.kind === 'form' ? (
              <div className="mb-4 grid gap-3">
                {attestation.fields.map((field, index) => (
                  <Field key={field} label={field} required>
                    <Input
                      value={formLines(draft, attestation.fields.length)[index] ?? ''}
                      maxLength={160}
                      autoComplete="off"
                      onChange={(event) =>
                        setDraft(
                          withFormLine(draft, attestation.fields.length, index, event.target.value),
                        )
                      }
                      onBlur={commit}
                    />
                  </Field>
                ))}
              </div>
            ) : null}

            {attestation?.kind === 'note' ? (
              <Field label={attestation.prompt} required className="mb-4">
                <Input
                  value={draft}
                  maxLength={160}
                  autoComplete="off"
                  onChange={(event) => setDraft(event.target.value.replace(/\r?\n/g, ' '))}
                  onBlur={commit}
                />
              </Field>
            ) : null}

            {attestation?.kind === 'confirm' || attestation?.kind === 'checklist' ? (
              <Field label={COPY.epics.noteLabel} hint={COPY.epics.noteHint} className="mb-4">
                <Textarea
                  value={draft}
                  rows={2}
                  maxLength={NOTE_MAX}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commit}
                  className="min-h-20"
                />
              </Field>
            ) : null}

            {isXpOnlyEpic(epic.id) ? (
              <p className="mb-4 text-caption text-ink-2">
                {COPY.epics.xpOnly}{' '}
                <TextLink href={ROUTES.methodology}>{COPY.epics.xpOnlyLink}</TextLink>
              </p>
            ) : null}

            {gap === 'cooldown' ? (
              <p className="flex items-start gap-2 rounded-md border-2 border-ink bg-mat-deep px-3 py-2.5 text-body-sm font-semibold">
                <Hourglass
                  size={16}
                  strokeWidth={2.25}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
                {COPY.epics.cooldown(status.cooldownDays)}
              </p>
            ) : (
              <>
                <HoldButton
                  label={COPY.epics.hold}
                  hint={`${COPY.epics.holdHint} ${COPY.epics.honour}`}
                  earlyHint={COPY.epics.holdEarly}
                  disabledReason={gap === null ? undefined : GAP_REASON[gap]}
                  onConfirm={claim}
                />
                {gap === null ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 -ml-2"
                    onClick={() => setConfirming(true)}
                  >
                    {COPY.epics.confirmAlt}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}

      <p role="status" className="sr-only">
        {claimedHere ? COPY.epics.claimed(epic.xp) : ''}
      </p>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={COPY.epics.confirmTitle}
        description={`${epic.title}. ${COPY.epics.confirmBody}`}
        confirmLabel={COPY.epics.confirmYes}
        cancelLabel={COPY.epics.confirmNo}
        onConfirm={claim}
      />
    </Card>
  );
}
