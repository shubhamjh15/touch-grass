'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { PageSection, ROUTES } from '@/app/shell';
import { ACTION_BY_ID } from '@/data/catalogue';
import { useStreak, useToday, useTreeStatus, type LogEntry } from '@/game';
import { formatCo2, formatNumber } from '@/lib/format';
import { Co2e, HonestyMark, SPRINGS, Sticker, TabPanel, Tabs, Tag, TextLink } from '@/ui';
import { COPY } from '../copy';
import { logEstimateSource, logMeta, rhythmLine } from '../model';
import { stickerLabel } from '../stickerLabels';
import { WeekStrip } from './WeekStrip';

/** Today shows the newest few; the Log page keeps the whole ledger, with undo and delete. */
const SHOWN = 3;

type View = 'today' | 'week';

function rowTitle(log: LogEntry): string {
  const action = ACTION_BY_ID.get(log.actionId);
  return action ? stickerLabel(action) : log.title;
}

function LogRow({ log }: { log: LogEntry }) {
  const estimated = log.co2eKg !== null && log.co2eKg > 0 && log.estimate !== 'none';
  return (
    <>
      <Sticker category={log.category} size={32} rotate={0} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-ink">{rowTitle(log)}</span>
        <span className="mt-1 block truncate type-slug leading-[1.3] text-ink-3">
          {logMeta(log)}
        </span>
      </span>
      {estimated ? (
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-data text-ink">
          <HonestyMark source={logEstimateSource(log)} size="sm" />
          <span>
            {formatCo2(log.co2eKg ?? 0)} <Co2e className="sr-only" />
          </span>
        </span>
      ) : null}
      {log.xp > 0 ? <Tag hue="yellow">+{formatNumber(log.xp)} XP</Tag> : null}
    </>
  );
}

/**
 * What has been stuck on today, newest first, and the week as seven marks behind a tab.
 * New rows spring in and push the older ones down (after Magic UI's Animated List, MIT),
 * moving only `transform` and `opacity`.
 */
export function RecentActivity() {
  const today = useToday();
  const streak = useStreak();
  const tree = useTreeStatus();
  const [view, setView] = useState<View>('today');

  const shown = today.logs.slice(0, SHOWN);
  const more = today.logs.length - shown.length;

  return (
    <PageSection
      id="activity"
      title={COPY.activityHeading}
      seeAll={{ href: ROUTES.log, label: COPY.activityAll }}
    >
      <Tabs
        aria-label={COPY.activityHeading}
        value={view}
        onValueChange={setView}
        tabs={[
          { value: 'today', label: 'Today', count: today.logs.length },
          { value: 'week', label: 'This week' },
        ]}
      >
        <TabPanel value="today" className="p-0 md:p-0">
          {shown.length === 0 ? (
            <p className="px-4 py-5 text-body-sm text-ink-2">{COPY.activityEmpty}</p>
          ) : (
            <ul aria-label="Logged today" className="divide-y-[1.5px] divide-ink overflow-hidden">
              <AnimatePresence initial={false}>
                {shown.map((log) => (
                  <motion.li
                    key={log.id}
                    layout
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={SPRINGS.settle}
                    className="flex min-h-16 items-center gap-3 px-4 py-2.5"
                  >
                    <LogRow log={log} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {more > 0 ? (
            <p className="border-t-[1.5px] border-dashed border-line px-4 py-2.5 text-caption text-ink-2">
              <TextLink href={ROUTES.log}>
                {formatNumber(more)} more today, with undo, on the Log page
              </TextLink>
            </p>
          ) : null}
        </TabPanel>
        <TabPanel value="week" className="grid gap-3">
          <WeekStrip days={streak.week} label="This week" />
          <p className="text-caption text-ink-2">{rhythmLine(streak, tree.rings)}</p>
          <TextLink href={ROUTES.impact} className="justify-self-start text-body-sm font-semibold">
            {COPY.activityHistory}
          </TextLink>
        </TabPanel>
      </Tabs>
    </PageSection>
  );
}
