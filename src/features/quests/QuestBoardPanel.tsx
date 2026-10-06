'use client';

import { Shuffle } from 'lucide-react';
import { PageSection } from '@/app/shell';
import { XP_CLEAN_SWEEP, type QuestView } from '@/game';
import { formatNumber } from '@/lib/format';
import { Button, EmptyState, Meter, Panel, Stamp, TapeNote } from '@/ui';
import { COPY } from './copy';
import {
  autoClaimSentence,
  countdownText,
  deckOrder,
  questHint,
  ticketState,
  weeklyLeft,
  type AutoClaim,
  type HintContext,
  type QuestTab,
} from './model';
import { QuestTicket } from './QuestTicket';
import { useClock } from './useQuestClock';

export interface QuestBoardPanelProps {
  kind: 'daily' | 'weekly';
  quests: readonly QuestView[];
  /** The moment this board rotates, epoch milliseconds. */
  resetsAt: number;
  /** Days left in the week, today included. */
  daysLeft: number;
  swapsUsed: number;
  autoClaims: readonly AutoClaim[];
  hintContext: HintContext;
  /** The quest a swap just brought in. */
  freshId: string | null;
  /** Bumped when a claim was refused, so the ticket forgets its torn stub. */
  retry: number;
  onClaim: (quest: QuestView, from: { x: number; y: number } | null) => void;
  onSwap: (quest: QuestView) => void;
  onTab: (tab: QuestTab) => void;
  /** Asks the game to draw the board (the blank-board state). */
  onDraw: () => void;
}

/** One rotating board: its countdown, the deck of tickets, and what was claimed while away. */
export function QuestBoardPanel({
  kind,
  quests,
  resetsAt,
  daysLeft,
  swapsUsed,
  autoClaims,
  hintContext,
  freshId,
  retry,
  onClaim,
  onSwap,
  onTab,
  onDraw,
}: QuestBoardPanelProps) {
  const copy = COPY[kind];
  // The period ended but the calendar has not been settled yet (it is, within a second).
  const over = useClock((now) => now >= resetsAt);
  const countdown = useClock((now) => countdownText(resetsAt - now));

  const deck = deckOrder(quests);
  const claimed = quests.filter((quest) => quest.claimed).length;
  const claimable = quests.filter((quest) => quest.claimable).length;
  const swept = quests.length > 0 && claimed === quests.length;
  const firstClaimable = deck.find((quest) => quest.claimable)?.id;

  let meta: string;
  if (over) meta = copy.rollingOver;
  else if (kind === 'daily') meta = `Resets in ${countdown}`;
  else meta = daysLeft > 1 ? weeklyLeft(daysLeft) : `Ends tonight · ${countdown}`;

  let status: string = copy.idle;
  if (swept) status = copy.swept;
  else if (claimable > 0) status = COPY.ready(claimable);

  return (
    <PageSection
      title={copy.heading}
      lead={status}
      aside={<p className="type-slug text-ink-3">{meta}</p>}
      className="gap-4"
    >
      {deck.length === 0 ? (
        <EmptyState
          slug={COPY.noBoard.slug}
          title={COPY.noBoard.title}
          body={COPY.noBoard.body}
          category="power"
          action={
            <Button variant="primary" icon={Shuffle} onClick={onDraw}>
              {COPY.noBoard.action}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <ol className="grid gap-4">
            {deck.map((quest) => (
              <QuestTicket
                key={`${quest.id}:${retry}`}
                quest={quest}
                state={ticketState(quest, over)}
                hint={questHint(quest, hintContext)}
                featured={quest.id === firstClaimable}
                fresh={quest.id === freshId}
                onClaim={onClaim}
                onSwap={onSwap}
                onTab={onTab}
              />
            ))}
          </ol>
          <Panel variant="well" className="grid gap-3 px-4 py-4 lg:sticky lg:top-28">
            {kind === 'daily' && swept ? (
              <>
                <Stamp label={COPY.daily.sweepStamp} hue="green" rotate={-4} className="my-1" />
                <p className="text-body-sm font-semibold">
                  {COPY.daily.sweepDone(XP_CLEAN_SWEEP)}{' '}
                  <span className="font-medium text-ink-2">{COPY.daily.nextUp}</span>
                </p>
              </>
            ) : swept ? (
              <p className="text-body-sm font-semibold">{COPY.weekly.nextUp}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="type-slug font-semibold text-ink">
                    {kind === 'daily' ? COPY.daily.sweepLabel : COPY.weekly.progressLabel}
                  </span>
                  <Meter
                    pips
                    value={claimed}
                    max={quests.length}
                    label={kind === 'daily' ? COPY.daily.sweepLabel : COPY.weekly.progressLabel}
                    valueText={`${formatNumber(claimed)} of ${formatNumber(quests.length)} claimed`}
                  />
                  <span
                    className="font-mono text-data-sm leading-none text-ink-2"
                    aria-hidden="true"
                  >
                    {formatNumber(claimed)} / {formatNumber(quests.length)}
                  </span>
                </div>
                <p className="text-body-sm text-ink-2">
                  {kind === 'daily'
                    ? COPY.daily.sweepHint(XP_CLEAN_SWEEP)
                    : COPY.weekly.progressHint}
                </p>
              </>
            )}
            <p className="border-t-2 border-dashed border-ink-4 pt-3 text-caption text-ink-3">
              {swept
                ? COPY.honest
                : `${swapsUsed > 0 ? copy.swapSpent : copy.swapRule} ${COPY.honest}`}
            </p>
          </Panel>
        </div>
      )}

      {autoClaims.length > 0 ? (
        <TapeNote
          tone="paper"
          tape="blue"
          rotate={autoClaims.length > 1 ? 0 : -1}
          className="mx-1 mt-3 sm:max-w-xl"
        >
          {autoClaimSentence(autoClaims)}
        </TapeNote>
      ) : null}
    </PageSection>
  );
}
