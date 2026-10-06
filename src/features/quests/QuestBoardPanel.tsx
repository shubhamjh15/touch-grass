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
  dailyLeft,
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
  const ticketLeft = useClock((now) =>
    kind === 'daily' ? dailyLeft(resetsAt - now) : weeklyLeft(daysLeft),
  );

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
        <ol className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
          {deck.map((quest) => (
            <QuestTicket
              key={`${quest.id}:${retry}`}
              quest={quest}
              state={ticketState(quest, over)}
              hint={questHint(quest, hintContext)}
              timeLeft={ticketLeft}
              featured={quest.id === firstClaimable}
              fresh={quest.id === freshId}
              onClaim={onClaim}
              onSwap={onSwap}
              onTab={onTab}
            />
          ))}
        </ol>
      )}

      {kind === 'daily' && deck.length > 0 ? (
        <Panel variant="well" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4">
          {swept ? (
            <>
              <Stamp label={COPY.daily.sweepStamp} hue="green" rotate={-4} className="my-1" />
              <p className="min-w-0 flex-1 text-body-sm font-semibold">
                {COPY.daily.sweepDone(XP_CLEAN_SWEEP)}{' '}
                <span className="font-medium text-ink-2">{COPY.daily.nextUp}</span>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="type-slug font-semibold text-ink">{COPY.daily.sweepLabel}</span>
                <Meter
                  pips
                  value={claimed}
                  max={quests.length}
                  label={COPY.daily.sweepLabel}
                  valueText={`${formatNumber(claimed)} of ${formatNumber(quests.length)} claimed`}
                />
                <span className="font-mono text-data-sm leading-none text-ink-2" aria-hidden="true">
                  {formatNumber(claimed)} / {formatNumber(quests.length)}
                </span>
              </div>
              <p className="min-w-0 flex-1 text-body-sm text-ink-2">
                {COPY.daily.sweepHint(XP_CLEAN_SWEEP)}
              </p>
            </>
          )}
        </Panel>
      ) : null}

      {kind === 'weekly' && swept ? (
        <Panel variant="well" className="px-4">
          <p className="text-body-sm font-semibold">{COPY.weekly.nextUp}</p>
        </Panel>
      ) : null}

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

      {deck.length > 0 ? (
        <p className="text-caption text-ink-3">
          {swept ? COPY.honest : `${swapsUsed > 0 ? copy.swapSpent : copy.swapRule} ${COPY.honest}`}
        </p>
      ) : null}
    </PageSection>
  );
}
