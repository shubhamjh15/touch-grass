'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DAILY_QUEST_BY_ID, WEEKLY_QUEST_BY_ID } from '@/data/quests';
import {
  effectiveDay,
  gameActions,
  useActionStates,
  useGame,
  useGameNow,
  useGameState,
  useIsOnboarded,
  useQuests,
  useTreeStatus,
  type QuestView,
} from '@/game';
import { hourOfDay } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { PageHeader } from '@/app/shell';
import { TabPanel, Tabs, toast, type TabItem } from '@/ui';
import { COPY } from './copy';
import { EpicsPanel } from './EpicsPanel';
import {
  TAB_PARAM,
  autoClaimsToday,
  epicAnchor,
  headerSlug,
  isEpicId,
  parseTab,
  tabCounts,
  tabHref,
  weekEndsAt,
  type HintContext,
  type QuestTab,
} from './model';
import { QuestBoardPanel } from './QuestBoardPanel';
import { useRewardFlight } from './RewardFlight';
import { useSettleAt } from './useQuestClock';

const EPIC_HASH = /^#epic-(.+)$/;

/** The epic a link pointed at (`/quests?tab=epics#epic-e_green_power`), read once on arrival. */
function linkedEpic(): string | null {
  const id = EPIC_HASH.exec(window.location.hash)?.[1];
  return id && isEpicId(id) ? id : null;
}

/**
 * `/quests`: three boards behind index tabs. Daily and weekly quests track themselves from
 * the logs and are claimed by tearing off the ticket's stub; epics are long real-world
 * projects, some tracked, some confirmed on the user's word.
 */
export default function QuestsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const board = useQuests();
  const tree = useTreeStatus();
  const actionStates = useActionStates();
  const onboarded = useIsOnboarded();
  const now = useGameNow();
  const today = useGame(effectiveDay);
  const claims = useGameState((game) => game.quests.claims);
  const dailyPeriod = useGameState((game) => game.quests.daily);
  const weeklyPeriod = useGameState((game) => game.quests.weekly);

  const [focusEpic] = useState(linkedEpic);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [said, setSaid] = useState('');
  const flight = useRewardFlight();

  const tab: QuestTab =
    focusEpic && !params.has(TAB_PARAM) ? 'epics' : parseTab(params.get(TAB_PARAM));
  const setTab = useCallback(
    (next: QuestTab) => {
      router.replace(tabHref(next, params.toString()), { scroll: false });
    },
    [params, router],
  );

  // The boards rotate on time even if this page is the only thing awake.
  useSettleAt(board.dailyResetsAt);

  // A saved board that is stale, or names a quest an update removed, is put right by one
  // settle: the engine redraws only the slot that needs it.
  const dailyGone = (dailyPeriod?.slots.length ?? 0) > board.daily.length;
  const weeklyGone = (weeklyPeriod?.slots.length ?? 0) > board.weekly.length;
  const retired = dailyGone || weeklyGone;
  const stale = onboarded && (dailyPeriod === null || dailyPeriod.key !== today);
  useEffect(() => {
    if (!retired && !stale) return;
    gameActions.tick();
    if (retired) {
      toast({
        id: 'quests-redrawn',
        tone: 'info',
        title: COPY.redrawn.title,
        meta: COPY.redrawn.meta,
      });
    }
  }, [retired, stale]);

  // A link to one epic lands on it.
  useEffect(() => {
    if (!focusEpic) return;
    document.getElementById(epicAnchor(focusEpic))?.scrollIntoView({ block: 'start' });
  }, [focusEpic]);

  // A swapped-in ticket takes the focus its predecessor's button had.
  useEffect(() => {
    if (!freshId) return;
    document
      .querySelector<HTMLElement>(`[data-quest="${freshId}"]`)
      ?.focus({ preventScroll: true });
  }, [freshId]);

  const hidden = useMemo(
    () => new Set(actionStates.filter((state) => state.hidden).map((state) => state.action.id)),
    [actionStates],
  );
  const hintContext = useMemo<HintContext>(
    () => ({
      hidden,
      checkedInToday: tree.checkedInToday,
      hour: hourOfDay(now),
      treeName: tree.name,
    }),
    [hidden, now, tree.checkedInToday, tree.name],
  );
  const dailyAuto = useMemo(() => autoClaimsToday(claims, 'daily', today), [claims, today]);
  const weeklyAuto = useMemo(() => autoClaimsToday(claims, 'weekly', today), [claims, today]);

  const counts = tabCounts(board);
  const tabs: TabItem<QuestTab>[] = [
    { value: 'daily', label: COPY.tabs.daily, count: counts.daily },
    { value: 'weekly', label: COPY.tabs.weekly, count: counts.weekly },
    { value: 'epics', label: COPY.tabs.epics, count: counts.epics },
  ];

  const claim = (quest: QuestView, from: { x: number; y: number } | null) => {
    const result = gameActions.claimQuest(quest.id);
    if (result.ok) {
      flight.launch(from, `+${formatNumber(result.xp)}`);
      return;
    }
    // A second tap on a claimed quest is a no-op; anything else means the progress changed.
    if (result.reason === 'already-claimed') return;
    setRetry((value) => value + 1);
    toast({
      id: 'quest-claim-refused',
      tone: 'info',
      title: COPY.claimRefused.title,
      meta: COPY.claimRefused.meta,
    });
  };

  const swap = (quest: QuestView) => {
    const result = gameActions.swapQuest(quest.kind, quest.slot);
    if (!result.ok) {
      toast({ id: 'quest-swap-refused', tone: 'info', title: COPY.swapRefused });
      return;
    }
    const pool = quest.kind === 'daily' ? DAILY_QUEST_BY_ID : WEEKLY_QUEST_BY_ID;
    setFreshId(result.questId);
    setSaid(COPY.swapped(pool.get(result.questId)?.title ?? ''));
  };

  return (
    <div className="w-full">
      <PageHeader slug={headerSlug(board.weeklyDaysLeft)} title={COPY.title} lead={COPY.lead} />

      <Tabs value={tab} onValueChange={setTab} tabs={tabs} aria-label={COPY.tabsLabel}>
        <TabPanel value="daily" bare className="pt-5">
          <QuestBoardPanel
            kind="daily"
            quests={board.daily}
            resetsAt={board.dailyResetsAt}
            daysLeft={board.weeklyDaysLeft}
            swapsUsed={dailyPeriod?.swapsUsed ?? 0}
            autoClaims={dailyAuto}
            hintContext={hintContext}
            freshId={freshId}
            retry={retry}
            onClaim={claim}
            onSwap={swap}
            onTab={setTab}
            onDraw={() => gameActions.tick()}
          />
        </TabPanel>
        <TabPanel value="weekly" bare className="pt-5">
          <QuestBoardPanel
            kind="weekly"
            quests={board.weekly}
            resetsAt={weekEndsAt(now)}
            daysLeft={board.weeklyDaysLeft}
            swapsUsed={weeklyPeriod?.swapsUsed ?? 0}
            autoClaims={weeklyAuto}
            hintContext={hintContext}
            freshId={freshId}
            retry={retry}
            onClaim={claim}
            onSwap={swap}
            onTab={setTab}
            onDraw={() => gameActions.tick()}
          />
        </TabPanel>
        <TabPanel value="epics" bare className="pt-5">
          <EpicsPanel
            epics={board.epics}
            hidden={hidden}
            focusId={focusEpic}
            onFlight={flight.launch}
            onAnnounce={setSaid}
          />
        </TabPanel>
      </Tabs>

      <p role="status" className="sr-only">
        {said}
      </p>
      {flight.layer}
    </div>
  );
}
