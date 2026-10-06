'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ROUTES } from '@/app/shell';
import { gameActions, useNotices, type NoticeView } from '@/game';
import { IconButton, TapeNote, TextLink } from '@/ui';

/** A note that was on screen at least this long counts as seen when the page is left. */
const SEEN_AFTER_MS = 1500;

const TONE: Record<NoticeView['kind'], 'paper' | 'blue' | 'pink'> = {
  'rain-return': 'blue',
  'streak-rested': 'paper',
  'auto-claimed': 'paper',
  'challenge-ended': 'pink',
  'legacy-imported': 'paper',
  'woke-up': 'paper',
};

const FOLLOW_UP: Partial<Record<NoticeView['kind'], { label: string; href: string }>> = {
  'auto-claimed': { label: 'See your quests', href: ROUTES.quests },
  'challenge-ended': { label: 'Open Community', href: ROUTES.community },
};

/**
 * The one-time messages of a return: it rained, a streak rested, the tree is waking up.
 * They share one taped note, however many there are, so a long absence never buries the
 * day under paper. Each is shown once: closing it dismisses it, and so does leaving the
 * page after it has been on screen long enough to read.
 */
export function ReturnNotices() {
  const notices = useNotices();
  const shown = useRef(new Map<string, number>());

  useEffect(() => {
    const seen = shown.current;
    for (const notice of notices) if (!seen.has(notice.id)) seen.set(notice.id, Date.now());
  }, [notices]);

  useEffect(() => {
    const seen = shown.current;
    return () => {
      const now = Date.now();
      for (const [id, since] of seen) {
        if (now - since >= SEEN_AFTER_MS) gameActions.dismissNotice(id);
      }
    };
  }, []);

  const first = notices[0];
  if (!first) return null;

  return (
    <div className="px-1 pt-2">
      <TapeNote tone={TONE[first.kind]} tape="yellow" rotate={0} role="status">
        {/* The note is a paragraph, so the list is built from spans with list roles. */}
        <span role="list" aria-label="While you were away" className="grid">
          {notices.map((notice) => {
            const follow = FOLLOW_UP[notice.kind];
            return (
              <span
                role="listitem"
                key={notice.id}
                className="flex items-start gap-3 border-line py-2.5 not-first:border-t-2 not-first:border-dashed first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  {notice.text}
                  {follow ? (
                    <>
                      {' '}
                      <TextLink href={follow.href}>{follow.label}</TextLink>
                    </>
                  ) : null}
                </span>
                <IconButton
                  label="Dismiss"
                  icon={X}
                  size="sm"
                  tooltipSide={null}
                  onClick={() => gameActions.dismissNotice(notice.id)}
                />
              </span>
            );
          })}
        </span>
      </TapeNote>
    </div>
  );
}
