'use client';

import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ACTION_BY_ID } from '@/data/catalogue';
import { effectiveDay, gameActions, useGame, useHistory, useImpact, type LogEntry } from '@/game';
import {
  formatCo2Estimate,
  formatDay,
  formatDecimal,
  formatNumber,
  formatTime,
} from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Approx,
  Button,
  CATEGORY_ICON,
  Co2e,
  ConfirmDialog,
  EmptyState,
  HonestyMark,
  IconButton,
  ListRow,
  Sticker,
} from '@/ui';
import { COPY } from '../copy';
import { HISTORY_PAGE, totalsSource } from '../model';

function title(log: LogEntry): string {
  return ACTION_BY_ID.get(log.actionId)?.title ?? log.title;
}

function meta(log: LogEntry, today: string): string {
  const quantity = log.unit ? `${formatDecimal(log.qty, 2)} ${log.unit}` : '';
  const kind = COPY.history.kinds[log.kind];
  return [formatDay(log.day, today), formatTime(log.ts), quantity, kind]
    .filter(Boolean)
    .join(' · ');
}

function Figure({ log }: { log: LogEntry }) {
  if (log.co2eKg === null || log.estimate === 'none') {
    return <span className="type-tick text-ink-3">{COPY.history.notQuantified}</span>;
  }
  return (
    <span
      className={
        log.estimate === 'ai'
          ? 'underline decoration-dotted decoration-2 underline-offset-4'
          : undefined
      }
    >
      <Approx weight="mono" />
      {formatCo2Estimate(log.co2eKg)} <Co2e className="sr-only" />
    </span>
  );
}

/**
 * Every log, newest first, 25 at a time, with a visible delete on each row. The honesty mark
 * sits on the total above the list; the rows use the plain drawn "≈" (bible 4.6, ledgers).
 */
export function HistoryPanel() {
  const logs = useHistory();
  const impact = useImpact();
  const today = useGame(effectiveDay);
  const [shown, setShown] = useState(HISTORY_PAGE);
  const [pending, setPending] = useState<LogEntry | null>(null);
  const [said, setSaid] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const source = useMemo(() => totalsSource(impact), [impact]);

  if (logs.length === 0) {
    return (
      <div className="p-3">
        <EmptyState slug="NOTHING STUCK YET" title={COPY.history.empty} className="min-h-40" />
      </div>
    );
  }

  const visible = logs.slice(0, shown);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-ink bg-paper px-4 py-2.5 md:px-5">
        <p className="min-w-0 type-slug text-ink-3">
          {formatNumber(logs.length)} {logs.length === 1 ? 'log' : 'logs'}
        </p>
        <p className="flex items-center gap-1.5 font-mono text-data-lg font-semibold">
          <HonestyMark source={source} size="sm" />
          <span>
            {formatCo2Estimate(impact.kg)} <Co2e />
          </span>
          <span className="sr-only">{COPY.history.columnTotal}</span>
        </p>
      </div>
      <ul
        ref={listRef}
        tabIndex={-1}
        aria-label={COPY.history.title}
        className="divide-y-[1.5px] divide-ink focus-visible:outline-hidden"
      >
        {visible.map((log) => (
          <ListRow
            key={log.id}
            leading={
              <Sticker
                category={log.category}
                icon={CATEGORY_ICON[log.category]}
                size={32}
                rotate={-3}
              />
            }
            title={title(log)}
            meta={meta(log, today)}
            value={<Figure log={log} />}
            trailing={
              <IconButton
                label={`${COPY.history.delete}: ${title(log)}`}
                icon={Trash2}
                size="sm"
                onClick={() => setPending(log)}
              />
            }
          />
        ))}
      </ul>
      {shown < logs.length ? (
        <div className="border-t-[1.5px] border-ink p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShown((count) => count + HISTORY_PAGE)}
          >
            {COPY.history.more} ({formatNumber(logs.length - shown)})
          </Button>
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={COPY.history.confirmTitle}
        description={COPY.history.confirmBody}
        confirmLabel={COPY.history.confirmAction}
        destructive
        onConfirm={() => {
          if (!pending) return;
          play('tap');
          gameActions.deleteLog(pending.id);
          setSaid(COPY.history.deleted);
          setPending(null);
          window.setTimeout(() => listRef.current?.focus(), 0);
        }}
      />
    </div>
  );
}
