'use client';

import { ArrowRight, Hourglass, Pin, PinOff } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { PageSection } from '@/app/shell';
import { gameActions, type EpicStatus } from '@/game';
import { dayKey } from '@/lib/dates';
import { formatLongDate, formatNumber } from '@/lib/format';
import { play } from '@/lib/sfx';
import { Button, EmptyState, Panel, TearStub, UiLink } from '@/ui';
import { COPY, xpReward } from './copy';
import { EpicCard } from './EpicCard';
import {
  epicActionLinks,
  epicAnchor,
  epicStarted,
  epicStep,
  groupEpics,
  type TicketState,
} from './model';
import { ChipList, TicketTray } from './QuestTicket';

const STUB_HALF = 42;

const STEP_CHIP =
  'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border-2 border-ink bg-white px-3 text-caption font-semibold whitespace-nowrap text-ink transition-colors duration-(--dur-fast) after:absolute after:inset-x-0 after:-inset-y-1.5 active:bg-yellow fine:hover:bg-yellow-tint';

interface EpicTicketProps {
  status: EpicStatus;
  hidden: ReadonlySet<string>;
  featured: boolean;
  onClaim: (status: EpicStatus, from: { x: number; y: number } | null) => void;
  onAnnounce: (text: string) => void;
}

/** An epic tracked from the logs: the same tear-stub ticket as a quest, with no deadline. */
function EpicTicket({ status, hidden, featured, onClaim, onAnnounce }: EpicTicketProps) {
  const item = useRef<HTMLLIElement>(null);
  const { epic, claimed, claimable, pinned, saved } = status;
  const state: TicketState = claimed ? 'claimed' : claimable ? 'claimable' : 'active';
  const actions = epicActionLinks(epic, hidden);
  const step = epicStep(epic);

  const togglePin = () => {
    play('toggle', { on: !pinned });
    gameActions.pinEpic(pinned ? null : epic.id);
    onAnnounce(pinned ? COPY.epics.unpinnedSaid(epic.title) : COPY.epics.pinnedSaid(epic.title));
  };

  const stubCentre = () => {
    const rect = item.current?.querySelector('[data-state]')?.getBoundingClientRect();
    return rect ? { x: rect.right - STUB_HALF, y: rect.top + rect.height / 2 } : null;
  };

  let tray: ReactNode = null;
  if (state === 'active') {
    tray = (
      <TicketTray
        label={actions.length > 0 ? COPY.counts : undefined}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={pinned ? PinOff : Pin}
            aria-pressed={pinned}
            onClick={togglePin}
          >
            {pinned ? COPY.epics.unpin : COPY.epics.pin}
            <span className="sr-only">: {epic.title}</span>
          </Button>
        }
      >
        {actions.length > 0 ? (
          <ChipList actions={actions} />
        ) : step?.kind === 'link' ? (
          <UiLink href={step.href} className={STEP_CHIP}>
            {step.label}
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </UiLink>
        ) : null}
      </TicketTray>
    );
  } else if (state === 'claimed' && saved.claimedTs !== null) {
    tray = (
      <TicketTray>
        <p className="type-slug text-ink-2">
          {COPY.epics.claimedOn(formatLongDate(dayKey(saved.claimedTs)), epic.xp)}
        </p>
      </TicketTray>
    );
  }

  return (
    <li
      ref={item}
      id={epicAnchor(epic.id)}
      data-epic={epic.id}
      tabIndex={-1}
      className="relative isolate min-w-0 scroll-mt-28 outline-hidden lg:scroll-mt-40"
    >
      <TearStub
        className="relative z-1"
        title={epic.title}
        description={epic.copy}
        kind="epic"
        progress={{ value: Math.floor(status.progress.current), max: status.progress.target }}
        reward={xpReward(epic.xp)}
        state={state}
        timeLeft={pinned && state === 'active' ? COPY.epics.pinned : undefined}
        featured={featured}
        onClaim={() => {
          const from = stubCentre();
          item.current?.focus({ preventScroll: true });
          onClaim(status, from);
        }}
      />
      {tray}
    </li>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-h4">
          {title}
        </h3>
        <span className="font-mono text-data text-ink-3" aria-hidden="true">
          {formatNumber(count)}
        </span>
      </div>
      {children}
    </section>
  );
}

export interface EpicsPanelProps {
  epics: readonly EpicStatus[];
  hidden: ReadonlySet<string>;
  /** An epic to unfold on arrival (`#epic-…`). */
  focusId: string | null;
  onFlight: (from: { x: number; y: number } | null, label: string) => void;
  onAnnounce: (text: string) => void;
}

/**
 * The long game: epics that run on the user's word (cards with a hold-to-confirm), epics
 * tracked from the logs (tickets), and the finished ones. Nothing here expires.
 */
export function EpicsPanel({ epics, hidden, focusId, onFlight, onAnnounce }: EpicsPanelProps) {
  // Epics claimed during this visit stay where they were instead of jumping to "Finished".
  const [claimedHere, setClaimedHere] = useState<ReadonlySet<string>>(() => new Set());
  const groups = groupEpics(epics, claimedHere);
  const allDone = epics.length > 0 && epics.every((status) => status.claimed);
  const cooldown = epics.find((status) => status.cooldownDays > 0)?.cooldownDays ?? 0;

  const remember = (epicId: string) => setClaimedHere((current) => new Set(current).add(epicId));

  const claimTicket = (status: EpicStatus, from: { x: number; y: number } | null) => {
    const result = gameActions.completeEpic(status.epic.id);
    if (!result.ok) return;
    remember(status.epic.id);
    onFlight(from, `+${formatNumber(status.epic.xp)}`);
  };

  const firstReady = groups.ready.find((status) => status.claimable)?.epic.id;

  return (
    <PageSection
      title={COPY.epics.heading}
      lead={COPY.epics.lead}
      aside={<p className="type-slug text-ink-3">{COPY.epics.meta}</p>}
      className="gap-6"
    >
      {allDone ? (
        <EmptyState
          slug={COPY.epics.emptySlug}
          title={COPY.epics.empty}
          category="nature"
          as="h3"
        />
      ) : null}

      {groups.ready.length > 0 ? (
        <Group title={COPY.epics.ready} count={groups.ready.length}>
          <ul className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
            {groups.ready.map((status) => (
              <EpicTicket
                key={status.epic.id}
                status={status}
                hidden={hidden}
                featured={status.epic.id === firstReady}
                onClaim={claimTicket}
                onAnnounce={onAnnounce}
              />
            ))}
          </ul>
        </Group>
      ) : null}

      {groups.onYourWord.length > 0 ? (
        <Group title={COPY.epics.onYourWord} count={groups.onYourWord.length}>
          {cooldown > 0 ? (
            <Panel variant="well" className="flex items-start gap-2.5 px-4">
              <Hourglass
                size={18}
                strokeWidth={2.25}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              <p className="text-body-sm">
                <b className="font-bold">{COPY.epics.weeklyLimit}</b>{' '}
                {COPY.epics.cooldown(cooldown)}
              </p>
            </Panel>
          ) : null}
          <div className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
            {groups.onYourWord.map((status) => (
              <EpicCard
                key={status.epic.id}
                status={status}
                hidden={hidden}
                defaultOpen={
                  status.epic.id === focusId ||
                  status.pinned ||
                  (epicStarted(status) && !status.claimed)
                }
                claimedHere={claimedHere.has(status.epic.id)}
                onClaimed={remember}
                onAnnounce={onAnnounce}
              />
            ))}
          </div>
        </Group>
      ) : null}

      {groups.fromLogs.length > 0 ? (
        <Group title={COPY.epics.fromLogs} count={groups.fromLogs.length}>
          <ul className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
            {groups.fromLogs.map((status) => (
              <EpicTicket
                key={status.epic.id}
                status={status}
                hidden={hidden}
                featured={false}
                onClaim={claimTicket}
                onAnnounce={onAnnounce}
              />
            ))}
          </ul>
        </Group>
      ) : null}

      {groups.finished.length > 0 ? (
        <Group title={COPY.epics.finished} count={groups.finished.length}>
          <ul className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
            {groups.finished.map((status) =>
              status.selfAttested ? (
                <li key={status.epic.id} className="min-w-0">
                  <EpicCard
                    status={status}
                    hidden={hidden}
                    defaultOpen={false}
                    claimedHere={false}
                    onClaimed={remember}
                    onAnnounce={onAnnounce}
                  />
                </li>
              ) : (
                <EpicTicket
                  key={status.epic.id}
                  status={status}
                  hidden={hidden}
                  featured={false}
                  onClaim={claimTicket}
                  onAnnounce={onAnnounce}
                />
              ),
            )}
          </ul>
        </Group>
      ) : null}
    </PageSection>
  );
}
