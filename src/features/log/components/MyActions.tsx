'use client';

import { Plus, X } from 'lucide-react';
import { useRef } from 'react';
import {
  SAVED_CUSTOM_ACTIONS_MAX,
  customXp,
  gameActions,
  useCustomActions,
  type SavedCustomAction,
} from '@/game';
import { formatNumber } from '@/lib/format';
import { CATEGORY, IconButton, Ledger, ListRow, SectionHeading, Sticker, toast } from '@/ui';
import { COPY } from '../copy';

function Row({
  saved,
  onStick,
}: {
  saved: SavedCustomAction;
  onStick: (saved: SavedCustomAction, origin: Element | null) => void;
}) {
  const stickerRef = useRef<HTMLSpanElement | null>(null);
  const estimate = saved.estimate === 'ai' ? 'AI estimate' : COPY.mine.notQuantified;
  return (
    <ListRow
      leading={
        <span ref={stickerRef} className="inline-block">
          <Sticker category={saved.category} size={32} rotate={-3} />
        </span>
      }
      title={saved.title}
      meta={`${CATEGORY[saved.category].label} · ${COPY.custom.effort[saved.effort - 1]} · +${formatNumber(
        customXp(saved.effort),
      )} XP · ${estimate}`}
      trailing={
        <>
          <IconButton
            label={`${COPY.mine.stick}: ${saved.title}`}
            icon={Plus}
            size="sm"
            variant="primary"
            onClick={() => onStick(saved, stickerRef.current)}
          />
          <IconButton
            label={`${COPY.mine.remove}: ${saved.title}`}
            icon={X}
            size="sm"
            onClick={() => {
              if (gameActions.removeSavedCustom(saved.id)) {
                toast({ title: COPY.mine.removed(saved.title) });
              }
            }}
          />
        </>
      }
    />
  );
}

/** Custom actions kept for one-tap reuse, each with the estimate it was saved with (spec 3.6). */
export function MyActions({
  onStick,
}: {
  onStick: (saved: SavedCustomAction, origin: Element | null) => void;
}) {
  const saved = useCustomActions();
  if (saved.length === 0) return null;
  return (
    <section aria-label={COPY.mine.title} className="mt-8">
      <SectionHeading
        title={COPY.mine.title}
        meta={COPY.mine.meta(saved.length, SAVED_CUSTOM_ACTIONS_MAX)}
        className="mt-0"
      />
      <Ledger aria-label={COPY.mine.title}>
        {saved.map((item) => (
          <Row key={item.id} saved={item} onStick={onStick} />
        ))}
      </Ledger>
    </section>
  );
}
