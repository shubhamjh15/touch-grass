'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { respondOffline, stripChips } from '@/ai';
import { ROUTES, logLink } from '@/app/shell';
import { CATEGORY_BY_ID } from '@/data/catalogue';
import {
  gameActions,
  getCoachContext,
  quietWeekCopy,
  useQuickLog,
  useRecap,
  useStreak,
  useTreeStatus,
  type WeekRecap,
} from '@/game';
import { formatCo2, formatNumber } from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Approx,
  Button,
  Card,
  Co2e,
  HonestyMark,
  Modal,
  Receipt,
  TapeNote,
  type ReceiptRow,
} from '@/ui';
import { COPY } from '../copy';
import { recapDelta, recapGrowth, recapRange, weekEstimateSource } from '../model';
import { stickerLabel } from '../stickerLabels';
import { WeekStrip } from './WeekStrip';

/** The built-in coach's opening sentence about the biggest lever, with its chips removed. */
function coachLine(): string {
  const text = stripChips(respondOffline("What's my biggest lever?", getCoachContext()).text);
  const end = text.search(/[.!?](\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1);
}

function rows(recap: WeekRecap, streak: { current: number; rainBank: number }): ReceiptRow[] {
  const list: ReceiptRow[] = [
    { label: 'Rings', value: `${formatNumber(recap.rings)} of 7` },
    { label: 'Full rings', value: formatNumber(recap.fullRings) },
    { label: 'Acts logged', value: formatNumber(recap.acts) },
    { label: 'Quests claimed', value: formatNumber(recap.questsClaimed) },
  ];
  if (recap.topCategory) {
    list.push({ label: 'Top category', value: CATEGORY_BY_ID[recap.topCategory].label });
  }
  if (recap.minutesOutside > 0) {
    list.push({ label: 'Minutes outside', value: formatNumber(recap.minutesOutside) });
  }
  list.push(
    { label: 'Tree', value: recapGrowth(recap) },
    { label: 'Streak now', value: `${formatNumber(streak.current)} days` },
    { label: 'Rain days banked', value: formatNumber(streak.rainBank) },
  );
  return list;
}

/**
 * Last week, torn off: offered on the first open of a new week until it is put away. Today
 * shows only a taped note that it is ready; the strip, the receipt and Moss's line open in
 * a sheet. It is built only from what was stored; a quiet week gets one kind line and three
 * ways back in, with nothing to open.
 */
export function WeeklyRecap() {
  const { pending } = useRecap();
  const tree = useTreeStatus();
  const streak = useStreak();
  const quick = useQuickLog();
  const [open, setOpen] = useState(false);
  const week = pending?.week;
  const line = useMemo(() => (week ? coachLine() : ''), [week]);

  if (!pending) return null;

  const putAway = () => {
    play('tear');
    setOpen(false);
    gameActions.markRecapSeen(pending.week);
  };
  const range = recapRange(pending);

  if (pending.empty) {
    return (
      <Card as="section" aria-label={COPY.recapTitle} className="grid gap-3">
        <p className="type-slug text-ink-3">
          {COPY.recapTitle} · {range}
        </p>
        <h2 className="text-h4 text-ink">{quietWeekCopy(tree.name)}</h2>
        <ul className="flex flex-wrap gap-2">
          {quick.slice(0, 3).map((state) => (
            <li key={state.action.id}>
              <Button asChild size="sm" variant="neutral" iconRight={ArrowRight}>
                <Link href={logLink(state.action.id, state.quickQty, 'recap')}>
                  {stickerLabel(state.action)}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button variant="ghost" size="sm" onClick={putAway}>
            Put it away
          </Button>
        </div>
      </Card>
    );
  }

  const delta = recapDelta(pending);

  return (
    <section aria-label={COPY.recapTitle} className="px-1 pt-2">
      <TapeNote tone="paper" tape="green" rotate={0}>
        <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span>{COPY.recapReady}</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="neutral" onClick={() => setOpen(true)}>
              {COPY.recapSeeIt}
            </Button>
            <Button size="sm" variant="ghost" onClick={putAway}>
              Put it away
            </Button>
          </span>
        </span>
      </TapeNote>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Last week, torn off"
        description={range}
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" iconRight={ArrowRight}>
              <Link href={ROUTES.quests} onClick={putAway}>
                See this week&rsquo;s quests
              </Link>
            </Button>
            <Button variant="ghost" onClick={putAway}>
              Put it away
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <WeekStrip days={pending.strip} label="Last week" />
          <Receipt
            title="Week total"
            meta={range}
            rows={rows(pending, streak)}
            total={{
              label: 'Avoided',
              value: (
                <>
                  <Approx weight="mono" />
                  {formatCo2(pending.kg)} <Co2e />
                </>
              ),
            }}
          />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-2">
            <HonestyMark source={weekEstimateSource(pending)} size="sm" />
            <span>{delta ? `${delta.text}.` : 'The first full week on record.'}</span>
          </p>
          {line ? (
            <p className="text-body-sm text-ink">
              <b className="font-bold">Moss says: </b>
              {line}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
