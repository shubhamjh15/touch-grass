'use client';

import { ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EDITORIAL_POSTS, type EditorialPost } from '@/data/editorial';
import { logLink } from '@/app/shell';
import { gameActions, useGameState } from '@/game';
import { Button, Card, Chip, Tag } from '@/ui';
import { COMMUNITY_COPY } from '../copy';

const COPY = COMMUNITY_COPY.team;
const SAVED = 'saved';
const FIRST = 4;

function TeamCard({ post, saved }: { post: EditorialPost; saved: boolean }) {
  const href = post.tryActionId ? logLink(post.tryActionId) : (post.tryRoute ?? '/today');
  return (
    <Card as="article" tone="blue" className="grid grid-cols-1 content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tag hue="white">{COPY.label}</Tag>
        <span className="type-slug text-ink-3">{COPY.version(post.contentVersion)}</span>
      </div>
      <h3 className="text-h3">{post.title}</h3>
      <p className="max-w-prose text-body leading-relaxed">{post.body}</p>
      {post.sources.length > 0 ? (
        <details className="group text-body-sm text-ink-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold underline decoration-2 underline-offset-4">
            {COPY.sources}
          </summary>
          <ul className="mt-1 grid grid-cols-1 gap-1 pl-4">
            {post.sources.map((source) => (
              <li key={source.key} className="list-disc">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words underline underline-offset-2"
                >
                  {source.title}
                </a>
                , {source.publisher}, {source.year}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button
          variant="neutral"
          size="sm"
          icon={saved ? BookmarkCheck : Bookmark}
          aria-pressed={saved}
          onClick={() => gameActions.react(post.id, SAVED)}
        >
          {saved ? COPY.saved : COPY.save}
        </Button>
        <Button variant="primary" size="sm" iconRight={ArrowRight} asChild>
          <Link href={href}>{post.tryActionId ? COPY.tryIt : COPY.openToday}</Link>
        </Button>
      </div>
    </Card>
  );
}

/**
 * The team's eight starter notes: labelled editorial, dated by content version rather than a time,
 * with "Save" and "Try it" instead of likes. The first four show; the rest sit behind one button.
 */
export function TeamNotes() {
  const reactions = useGameState((state) => state.reactions);
  const [all, setAll] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  const isSaved = (id: string) => reactions[id]?.includes(SAVED) ?? false;
  const savedCount = EDITORIAL_POSTS.filter((post) => isSaved(post.id)).length;
  const pool =
    savedOnly && savedCount > 0
      ? EDITORIAL_POSTS.filter((post) => isSaved(post.id))
      : EDITORIAL_POSTS;
  const shown = all || savedOnly ? pool : pool.slice(0, FIRST);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          selected={!savedOnly}
          onSelectedChange={() => setSavedOnly(false)}
          count={EDITORIAL_POSTS.length}
        >
          {COMMUNITY_COPY.journal.allTags}
        </Chip>
        <Chip
          selected={savedOnly && savedCount > 0}
          onSelectedChange={() => setSavedOnly(true)}
          count={savedCount}
          disabled={savedCount === 0}
        >
          {COPY.saved}
        </Chip>
      </div>
      <ul className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        {shown.map((post) => (
          <li key={post.id} className="min-w-0">
            <TeamCard post={post} saved={isSaved(post.id)} />
          </li>
        ))}
      </ul>
      {!savedOnly && pool.length > FIRST ? (
        <div className="flex justify-center">
          <Button variant="neutral" onClick={() => setAll((open) => !open)}>
            {all ? COPY.showFewer : COPY.showAll(pool.length)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
