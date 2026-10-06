'use client';

import { PenLine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { searchJournal, type JournalNote } from '@/game';
import type { DayKey } from '@/lib/dates';
import { Button, Chip, EmptyState, SearchInput } from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import { journalTagLabel } from '../model/tags';
import { NoteCard } from './NoteCard';

const COPY = COMMUNITY_COPY.journal;
const PAGE = 6;

export interface JournalListProps {
  notes: readonly JournalNote[];
  today: DayKey;
  /** The empty state's button: takes the visitor to the composer. */
  onWrite: () => void;
}

/** The notes, newest first, with a search field and a tag filter once there is something to search. */
export function JournalList({ notes, today, onWrite }: JournalListProps) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const tagsInUse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) if (note.tag) counts.set(note.tag, (counts.get(note.tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // A tag whose last note was deleted must not stay selected and show an empty list.
  const activeTag = tag && tagsInUse.some(([name]) => name === tag) ? tag : null;
  const found = useMemo(() => searchJournal(notes, query, activeTag), [notes, query, activeTag]);

  if (notes.length === 0) {
    return (
      <EmptyState
        slug={COPY.emptySlug}
        title={COPY.emptyTitle}
        body={COPY.emptyBody}
        category="nature"
        action={
          <Button variant="primary" icon={PenLine} onClick={onWrite}>
            {COPY.emptyCta}
          </Button>
        }
      />
    );
  }

  const shown = found.slice(0, limit);
  const rest = found.length - shown.length;
  const filtering = query.trim() !== '' || activeTag !== null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <SearchInput
          value={query}
          onValueChange={(next) => {
            setQuery(next);
            setLimit(PAGE);
          }}
          label={COPY.searchLabel(notes.length)}
          resultCount={found.length}
        />
        {tagsInUse.length > 0 ? (
          <div role="group" aria-label={COPY.filterLabel} className="flex flex-wrap gap-2">
            <Chip
              selected={activeTag === null}
              count={notes.length}
              onSelectedChange={() => {
                setTag(null);
                setLimit(PAGE);
              }}
            >
              {COPY.allTags}
            </Chip>
            {tagsInUse.map(([name, count]) => (
              <Chip
                key={name}
                selected={activeTag === name}
                count={count}
                onSelectedChange={(selected) => {
                  setTag(selected ? name : null);
                  setLimit(PAGE);
                }}
              >
                {journalTagLabel(name)}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {found.length === 0 ? (
        <EmptyState
          slug={COPY.emptySlug}
          title={COPY.noMatchTitle}
          body={COPY.noMatchBody}
          action={
            filtering ? (
              <Button
                variant="neutral"
                onClick={() => {
                  setQuery('');
                  setTag(null);
                }}
              >
                {COPY.clear}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid items-start gap-4 @3xl:grid-cols-2">
          {shown.map((note) => (
            <li key={note.id} className="min-w-0">
              <NoteCard note={note} today={today} />
            </li>
          ))}
        </ul>
      )}

      {rest > 0 ? (
        <div className="flex justify-center">
          <Button variant="neutral" onClick={() => setLimit((current) => current + PAGE)}>
            {COPY.showMore(rest)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
