'use client';

import { ChevronDown, SearchX } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import {
  Approx,
  Button,
  CATEGORY,
  CATEGORY_IDS,
  Card,
  Chip,
  Co2Text,
  Co2e,
  EmptyState,
  SearchInput,
  Tag,
  TextLink,
  type Hue,
} from '@/ui';
import {
  countByCategory,
  filterFactorRows,
  resolveAnchor,
  type FactorConfidence,
  type FactorFilter,
  type FactorRow,
} from '../model';

const CONFIDENCE_HUE: Record<FactorConfidence, Hue | 'white'> = {
  high: 'green',
  medium: 'yellow',
  low: 'pink',
  not_quantified: 'white',
};

const NO_FILTER: FactorFilter = { category: 'all', query: '' };

const TH =
  'sticky top-0 z-1 border-b-3 border-ink bg-paper px-3 py-2.5 text-left type-slug font-semibold text-ink-2 lg:top-20';

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td role="cell" className={cn('px-3 py-3.5 align-top', className)}>
      {children}
    </td>
  );
}

function Title({ row }: { row: FactorRow }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="text-[1.375rem] leading-none">
        {row.emoji}
      </span>
      <div className="min-w-0">
        <p className="text-label font-bold break-words">{row.title}</p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          <Tag category={row.category} />
          <Tag hue={CONFIDENCE_HUE[row.confidence]}>{row.confidenceLabel}</Tag>
        </p>
      </div>
    </div>
  );
}

function Estimate({ row }: { row: FactorRow }) {
  return row.value ? (
    <>
      <p className="font-mono text-data font-semibold">
        <Approx weight="mono" />
        <Co2Text text={row.value} />
      </p>
      <p className="text-caption text-ink-2">{row.per}</p>
      {row.regional ? <p className="mt-0.5 text-caption text-ink-3">Varies by region</p> : null}
    </>
  ) : (
    <p className="text-body-sm font-semibold">Not quantified</p>
  );
}

function Range({ row }: { row: FactorRow }) {
  return row.range ? (
    <p className="font-mono text-data">{row.range}</p>
  ) : (
    <p className="text-body-sm text-ink-3">{row.value ? 'Single value' : 'No number shown'}</p>
  );
}

function Compared({ row }: { row: FactorRow }) {
  const hasWorking = Boolean(row.comparedWithDetail ?? row.formula ?? row.notes);
  return (
    <>
      <p className="text-body-sm">{row.comparedWith}</p>
      {hasWorking ? (
        <details className="group/work mt-1.5">
          <summary className="inline-flex min-h-8 cursor-pointer items-center type-slug text-ink underline decoration-2 underline-offset-4 coarse:min-h-11 [&::-webkit-details-marker]:hidden">
            <span className="group-open/work:hidden">Show working</span>
            <span className="hidden group-open/work:inline">Hide working</span>
          </summary>
          <div className="mt-1 grid gap-2 text-caption text-ink-2">
            {row.comparedWithDetail ? <p>{row.comparedWithDetail}</p> : null}
            {row.formula ? (
              <p className="rounded-xs border-2 border-ink/30 bg-paper px-2 py-1.5 font-mono text-[0.75rem] break-words text-ink">
                {row.formula}
              </p>
            ) : null}
            {row.notes ? <p>{row.notes}</p> : null}
          </div>
        </details>
      ) : null}
    </>
  );
}

function Sources({ row }: { row: FactorRow }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
      {row.sources.map((source) => (
        <li key={source.key} className="min-w-0">
          <TextLink
            href={`#${source.anchor}`}
            title={source.title}
            className="flex min-h-6 max-w-full items-baseline gap-1.5 text-caption leading-snug max-md:min-h-9 max-md:items-center coarse:min-h-11 coarse:items-center"
          >
            <span className="shrink-0 font-mono text-[0.75rem]">{source.year}</span>
            <span className="min-w-0 truncate">{source.publisher}</span>
          </TextLink>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-0.5 block type-slug text-ink-3">{label}</span>
      {children}
    </div>
  );
}

/** One row of the table, for tablets and up. */
function Row({ row }: { row: FactorRow }) {
  return (
    <tr
      id={row.anchor}
      role="row"
      className="scroll-mt-28 border-b-2 border-ink/20 target:bg-yellow-tint"
    >
      <Cell>
        <Title row={row} />
      </Cell>
      <Cell>
        <Estimate row={row} />
      </Cell>
      <Cell>
        <Range row={row} />
      </Cell>
      <Cell>
        <Compared row={row} />
      </Cell>
      <Cell>
        <Sources row={row} />
      </Cell>
    </tr>
  );
}

/**
 * The same action on a phone: one compact line (name, estimate) that opens on a tap. A native
 * `details`, so the whole working is in the server's HTML and opens with no script.
 */
function CompactRow({ row, landed }: { row: FactorRow; landed: boolean }) {
  return (
    <li className="border-b-2 border-ink/20 last:border-b-0">
      <details
        id={`${PHONE_ID}${row.anchor}`}
        open={landed || undefined}
        className={cn('group/row scroll-mt-24', landed && 'bg-yellow-tint')}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="text-[1.375rem] leading-none">
            {row.emoji}
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-label font-bold break-words">{row.title}</span>
            <span className="font-mono text-caption text-ink-2">
              {row.value ? (
                <>
                  <Approx weight="mono" />
                  <Co2Text text={row.value} /> {row.per}
                </>
              ) : (
                'Not quantified'
              )}
            </span>
          </span>
          <ChevronDown
            size={20}
            strokeWidth={2.5}
            aria-hidden="true"
            className="shrink-0 transition-transform duration-(--dur-fast) ease-out group-open/row:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4">
          <p className="col-span-2 flex flex-wrap gap-1.5">
            <Tag category={row.category} />
            <Tag hue={CONFIDENCE_HUE[row.confidence]}>{row.confidenceLabel}</Tag>
          </p>
          <Field label="Estimate">
            <Estimate row={row} />
          </Field>
          <Field label="Likely range">
            <Range row={row} />
          </Field>
          <div className="col-span-2">
            <Field label="Compared with">
              <Compared row={row} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Sources">
              <Sources row={row} />
            </Field>
          </div>
        </div>
      </details>
    </li>
  );
}

/** The phone list's ids sit beside the table's, which keep the plain anchors. */
const PHONE_ID = 'm-';

/**
 * The factor table: one row per catalogue action, with its value, range, comparison, confidence
 * and sources. The whole table is in the server's HTML; the chips and the search only narrow it.
 * On a phone the table gives way to a compact list of the same rows, each opening on a tap.
 */
export function FactorTable({ rows }: { rows: readonly FactorRow[] }) {
  const [filter, setFilter] = useState<FactorFilter>(NO_FILTER);
  const counts = countByCategory(rows);
  const shown = filterFactorRows(rows, filter);
  const filtered = filter.category !== 'all' || filter.query.trim() !== '';
  // The row a link pointed at, so the phone list can open it and mark it.
  const [landed, setLanded] = useState<string | null>(null);

  // A link to a row the filter hides, or to an old-style bare id, still lands on the row.
  useEffect(() => {
    const land = () => {
      if (!window.location.hash) return;
      const target = resolveAnchor(
        window.location.hash,
        (id) => rows.some((row) => row.anchor === id) || document.getElementById(id) !== null,
      );
      if (!target) return;
      setFilter(NO_FILTER);
      setLanded(target);
      window.requestAnimationFrame(() => {
        // Phones show the compact list and tablets the table: scroll to whichever is on screen.
        const candidates = [
          document.getElementById(target),
          document.getElementById(`${PHONE_ID}${target}`),
        ];
        const element = candidates.find((node) => node && node.getClientRects().length > 0);
        if (!element) return;
        if (`#${target}` !== window.location.hash) {
          window.history.replaceState(null, '', `#${target}`);
        }
        element.scrollIntoView({ block: 'center' });
      });
    };
    land();
    window.addEventListener('hashchange', land);
    return () => window.removeEventListener('hashchange', land);
  }, [rows]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div role="group" aria-label="Filter by category" className="scroll-row gap-2 md:flex-wrap">
          <Chip
            selected={filter.category === 'all'}
            count={counts.all}
            onClick={() => setFilter((current) => ({ ...current, category: 'all' }))}
          >
            All
          </Chip>
          {CATEGORY_IDS.map((id) => (
            <Chip
              key={id}
              selected={filter.category === id}
              count={counts[id] ?? 0}
              onClick={() => setFilter((current) => ({ ...current, category: id }))}
            >
              {CATEGORY[id].label}
            </Chip>
          ))}
        </div>
        <SearchInput
          label={`Search ${formatNumber(rows.length)} actions`}
          value={filter.query}
          onValueChange={(query) => setFilter((current) => ({ ...current, query }))}
          resultCount={shown.length}
        />
      </div>

      <Card padded={false} className="min-w-0">
        <p className="border-b-2 border-dashed border-ink-4 px-4 py-2.5 text-caption text-ink-2 md:px-5">
          {filtered
            ? `Showing ${formatNumber(shown.length)} of ${formatNumber(rows.length)} actions.`
            : `${formatNumber(rows.length)} actions.`}{' '}
          Every value is an estimate in kg <Co2e /> avoided per unit, on the world-average grid.
        </p>
        {shown.length === 0 ? (
          <EmptyState
            slug="NO MATCH"
            title="No action matches that"
            body="Try a shorter word, or clear the filters to see all of them."
            illustration={<SearchX size={48} strokeWidth={2} aria-hidden="true" />}
            className="m-4 min-h-44"
            action={
              <Button size="sm" variant="neutral" onClick={() => setFilter(NO_FILTER)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <table role="table" className="hidden w-full table-fixed border-collapse md:table">
              <caption className="sr-only">
                Emission factors: one row for every action you can log
              </caption>
              <thead>
                <tr role="row">
                  <th scope="col" className={cn(TH, 'md:w-[26%]')}>
                    Action
                  </th>
                  <th scope="col" className={cn(TH, 'md:w-[16%]')}>
                    Estimate
                  </th>
                  <th scope="col" className={cn(TH, 'md:w-[14%]')}>
                    Likely range
                  </th>
                  <th scope="col" className={cn(TH, 'md:w-[22%]')}>
                    Compared with
                  </th>
                  <th scope="col" className={cn(TH, 'md:w-[22%]')}>
                    Sources
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </tbody>
            </table>
            <ul aria-label="Emission factors, one per action" className="md:hidden">
              {shown.map((row) => (
                <CompactRow key={row.id} row={row} landed={landed === row.anchor} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
