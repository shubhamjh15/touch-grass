'use client';

import { PageHeader } from '@/app/shell';
import { formatNumber } from '@/lib/format';
import { Ticket } from '@/ui';
import { LEARN_COPY } from '../copy';
import type { LibrarySummary } from '../model/library';

export interface LibraryHeaderProps {
  summary: LibrarySummary;
  mythsChecked: number;
  mythsTotal: number;
}

/**
 * The top of the library: the shell's page header (slug, die-cut title and, on a phone, the grove
 * sticker) with one ticket under it for the two things there are to finish here.
 */
export function LibraryHeader({ summary, mythsChecked, mythsTotal }: LibraryHeaderProps) {
  return (
    <PageHeader
      className="pb-0 lg:pb-0"
      slug={LEARN_COPY.librarySlug(summary.total, mythsTotal)}
      title={LEARN_COPY.title}
      lead={LEARN_COPY.lead}
    >
      <Ticket label={LEARN_COPY.progressGroup} className="mt-1 max-w-xl">
        <Ticket.Stub
          label={LEARN_COPY.progressLabel}
          value={formatNumber(summary.passed)}
          unit={`of ${formatNumber(summary.total)}`}
        />
        <Ticket.Stub
          label={LEARN_COPY.mythsCheckedLabel}
          value={formatNumber(mythsChecked)}
          unit={`of ${formatNumber(mythsTotal)}`}
        />
      </Ticket>
    </PageHeader>
  );
}
