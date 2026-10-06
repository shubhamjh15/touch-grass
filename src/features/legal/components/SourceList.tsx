import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { TextLink } from '@/ui';
import type { SourceListRow } from '../model';

const SHOWN = 3;

function UsedFor({ row }: { row: SourceListRow }) {
  if (row.actions.length === 0) return null;
  const first = row.actions.slice(0, SHOWN);
  const rest = row.actions.slice(SHOWN);
  const link = (action: SourceListRow['actions'][number]) => (
    <TextLink
      key={action.id}
      href={`#${action.anchor}`}
      className="inline-flex items-center text-caption max-md:min-h-11 md:min-h-6"
    >
      {action.title}
    </TextLink>
  );
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption text-ink-2">
      <span className="type-slug text-ink-3">Used for</span>
      {first.map(link)}
      {rest.length > 0 ? (
        <details className="group/more inline">
          <summary className="inline-flex cursor-pointer items-center type-slug underline decoration-2 underline-offset-4 group-open/more:hidden max-md:min-h-11 md:min-h-6 [&::-webkit-details-marker]:hidden">
            +{rest.length} more
          </summary>
          <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {rest.map(link)}
          </span>
        </details>
      ) : null}
    </div>
  );
}

/** One source: its title (a link to the publisher), who published it, when, and what cites it. */
export function SourceItem({
  anchor,
  title,
  publisher,
  year,
  url,
  extra,
  children,
}: {
  anchor: string;
  title: string;
  publisher: string | null;
  year: number;
  url: string;
  extra?: string | null;
  children?: ReactNode;
}) {
  return (
    <li
      id={anchor}
      className="scroll-mt-28 rounded-md border-3 border-ink bg-card p-3.5 shadow-1 [contain-intrinsic-size:auto_120px] [content-visibility:auto] target:bg-yellow-tint md:p-4"
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline link text-body-sm leading-snug font-bold break-words"
      >
        {title}
        <ExternalLink
          size={14}
          strokeWidth={2.5}
          aria-hidden="true"
          className="mb-0.5 ml-1.5 inline-block align-baseline"
        />
        <span className="sr-only"> (opens the publisher's page in a new tab)</span>
      </a>
      <p className="mt-1 type-slug text-ink-3">
        {publisher ? `${publisher} · ${year}` : String(year)}
      </p>
      {children}
      {extra ? <p className="mt-1.5 text-caption text-ink-2">{extra}</p> : null}
    </li>
  );
}

/** Every source of the factor table, two columns on a laptop. */
export function SourceList({ rows }: { rows: readonly SourceListRow[] }) {
  return (
    <ol className="grid gap-3 xl:grid-cols-2" aria-label="Sources of the emission factors">
      {rows.map((row) => (
        <SourceItem
          key={row.key}
          anchor={row.anchor}
          title={row.title}
          publisher={row.publisher}
          year={row.year}
          url={row.url}
          extra={row.alsoCitedBy}
        >
          <UsedFor row={row} />
        </SourceItem>
      ))}
    </ol>
  );
}
