'use client';

import { ArrowRight, Repeat2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import type { QuestView } from '@/game';
import { cn } from '@/lib/cn';
import { Button, CATEGORY, CATEGORY_ICON, TearStub, UiLink } from '@/ui';
import { COPY, xpReward } from './copy';
import {
  questCategory,
  ticketProgress,
  type ActionLink,
  type QuestHint,
  type QuestTab,
  type TicketState,
} from './model';

/** Width of the kit's stub below `lg`; the flight starts from its centre. */
const STUB_HALF = 42;

const CHIP =
  'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border-2 border-ink bg-white pr-3 pl-1 text-caption font-semibold whitespace-nowrap text-ink transition-colors duration-(--dur-fast) after:absolute after:inset-x-0 after:-inset-y-1.5 active:bg-yellow fine:hover:bg-yellow-tint';

/** A qualifying action as a small link: it opens the Log sheet prefilled, never logs by itself. */
export function ActionChip({ action }: { action: ActionLink }) {
  const Icon = CATEGORY_ICON[action.category];
  return (
    <UiLink href={action.href} className={CHIP} aria-label={`Log: ${action.title}`}>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 place-items-center rounded-full border-2 border-ink',
          CATEGORY[action.category].bg,
        )}
      >
        <Icon size={11} strokeWidth={2.75} />
      </span>
      {action.label}
    </UiLink>
  );
}

/** How many qualifying actions a slip shows before "+N more" opens the rest. */
const CHIPS_SHOWN = 2;

/** The actions that count, two at a time so a long list never swamps its ticket. */
export function ChipList({ actions }: { actions: readonly ActionLink[] }) {
  const [all, setAll] = useState(false);
  const extra = actions.length - CHIPS_SHOWN;
  const shown = all || extra <= 0 ? actions : actions.slice(0, CHIPS_SHOWN);
  return (
    <>
      {shown.map((action) => (
        <ActionChip key={action.id} action={action} />
      ))}
      {extra > 0 ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((current) => !current)}
          className={cn(CHIP, 'pl-3')}
        >
          {all ? COPY.fewer : COPY.more(extra)}
        </button>
      ) : null}
    </>
  );
}

/**
 * The slip tucked under a ticket: what counts toward it, and the one thing you may do about
 * it (swap, pin). It sits on the mat like the ticket, a sheet lower.
 */
export function TicketTray({
  label,
  children,
  action,
  className,
}: {
  /** Mono lead-in for the left side: "Counts". */
  label?: string;
  children?: ReactNode;
  /** One ghost control on the right. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative mx-2.5 -mt-0.5 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-b-md border-x-2 border-b-2 border-ink bg-paper px-3 pt-2 pb-1.5 md:mx-3.5',
        className,
      )}
    >
      {children ? (
        <div className="flex min-w-0 flex-[1_1_13rem] flex-wrap items-center gap-x-2 gap-y-1.5">
          {label ? <span className="shrink-0 type-slug text-ink-3">{label}</span> : null}
          {children}
        </div>
      ) : (
        <span className="flex-1" />
      )}
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

export interface QuestTicketProps {
  quest: QuestView;
  state: TicketState;
  hint: QuestHint;
  /** "9 h left" / "4 days left". */
  timeLeft: string;
  /** The first claimable ticket of the deck takes the colour plate. */
  featured: boolean;
  /** Just swapped in: it is stuck on rather than simply there. */
  fresh: boolean;
  onClaim: (quest: QuestView, from: { x: number; y: number } | null) => void;
  onSwap: (quest: QuestView) => void;
  onTab: (tab: QuestTab) => void;
}

/** One quest: the kit's tear-stub ticket, plus the slip that says what counts and offers a swap. */
export function QuestTicket({
  quest,
  state,
  hint,
  timeLeft,
  featured,
  fresh,
  onClaim,
  onSwap,
  onTab,
}: QuestTicketProps) {
  const item = useRef<HTMLLIElement>(null);
  const category = questCategory(quest.pool);
  const active = state === 'active';
  const canSwap = active && quest.canSwap;
  const hasHint = hint.actions.length > 0 || hint.step !== null || hint.note !== null;

  const stubCentre = () => {
    const rect = item.current?.querySelector('[data-state]')?.getBoundingClientRect();
    return rect ? { x: rect.right - STUB_HALF, y: rect.top + rect.height / 2 } : null;
  };

  let counts: ReactNode = null;
  if (hint.note) {
    counts = <p className="text-caption text-ink-2">{hint.note}</p>;
  } else if (hint.actions.length > 0) {
    counts = <ChipList actions={hint.actions} />;
  } else if (hint.step) {
    const step = hint.step;
    counts =
      step.kind === 'link' ? (
        <UiLink href={step.href} className={cn(CHIP, 'pl-3')}>
          {step.label}
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </UiLink>
      ) : (
        <button type="button" onClick={() => onTab(step.tab)} className={cn(CHIP, 'pl-3')}>
          {step.label}
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      );
  }

  return (
    <li
      ref={item}
      data-quest={quest.id}
      // The stub unmounts when it is torn off; the ticket keeps the focus it had.
      tabIndex={-1}
      className={cn('relative isolate min-w-0 outline-hidden', fresh && 'animate-stick')}
    >
      <TearStub
        className="relative z-1"
        title={quest.title}
        description={quest.copy}
        category={category}
        kind={category ? undefined : quest.kind}
        progress={ticketProgress(quest)}
        reward={xpReward(quest.xp)}
        state={state}
        timeLeft={timeLeft}
        featured={featured}
        onClaim={() => {
          const from = stubCentre();
          item.current?.focus({ preventScroll: true });
          onClaim(quest, from);
        }}
      />
      {active && (hasHint || canSwap) ? (
        <TicketTray
          label={hint.actions.length > 0 ? COPY.counts : undefined}
          action={
            canSwap ? (
              <Button variant="ghost" size="sm" icon={Repeat2} onClick={() => onSwap(quest)}>
                <span>
                  {COPY.swapShort}
                  <span className="max-sm:sr-only">{COPY.swapRest}</span>
                  <span className="sr-only">: {quest.title}</span>
                </span>
              </Button>
            ) : undefined
          }
        >
          {counts}
        </TicketTray>
      ) : null}
    </li>
  );
}
