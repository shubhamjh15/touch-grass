'use client';

import { useMemo } from 'react';
import { PageSection, ROUTES } from '@/app/shell';
import { gameActions, useGameNow, useQuests } from '@/game';
import { formatNumber } from '@/lib/format';
import { TearStub } from '@/ui';
import { COPY } from '../copy';
import { questCategory, questOrder, resetsIn } from '../model';

/**
 * Today's three daily quests as tear-off stubs. A finished quest waits for its claim:
 * tearing the stub is the claim, and it happens exactly once (the game refuses a second;
 * the stub announces the claim itself).
 * Weekly quests and epics live behind "All quests".
 */
export function TodayQuests() {
  const board = useQuests();
  const now = useGameNow();

  const ordered = useMemo(() => {
    const byId = new Map(board.daily.map((quest) => [quest.id, quest]));
    return questOrder(board.daily).flatMap((id) => {
      const quest = byId.get(id);
      return quest ? [quest] : [];
    });
  }, [board.daily]);

  const done = board.daily.filter((quest) => quest.claimed).length;
  const firstClaimable = ordered.find((quest) => quest.claimable)?.id;
  const progress = `${formatNumber(done)} of ${formatNumber(board.daily.length)} done`;

  return (
    <PageSection
      id="quests"
      title={COPY.questsHeading}
      seeAll={{ href: ROUTES.quests, label: COPY.allQuests }}
    >
      <ul className="grid gap-3">
        {ordered.map((quest) => (
          <li key={quest.id}>
            <TearStub
              title={quest.title}
              description={quest.copy}
              category={questCategory(quest)}
              progress={{
                value: Math.min(quest.progress.current, quest.progress.target),
                max: quest.progress.target,
              }}
              reward={`+${formatNumber(quest.xp)} XP`}
              state={quest.claimed ? 'claimed' : quest.claimable ? 'claimable' : 'active'}
              featured={quest.id === firstClaimable}
              onClaim={() => gameActions.claimQuest(quest.id)}
            />
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption text-ink-2">
        <span>{board.cleanSweep ? COPY.cleanSweep : progress}</span>
        <span className="type-tick text-ink-3">{resetsIn(board.dailyResetsAt, now)}</span>
      </p>
    </PageSection>
  );
}
