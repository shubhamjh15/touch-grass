'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gameActions } from '@/game';
import { prefersReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { SectionHeading } from '@/ui';
import { LEARN_COPY } from '../copy';
import { buildMythDeck, mythAnnouncement, type MythCardModel } from '../model/myths';
import { MythCard } from './MythCard';

/** When the verdict stamp lands after a flip starts: the card's turn, then the stamp coming down. */
const STAMP_LANDS_MS = 380;

interface CardState {
  flipped: boolean;
  reveals: number;
  earned: number;
}

const FACE_DOWN: CardState = { flipped: false, reveals: 0, earned: 0 };

/**
 * The ten myth-buster cards: a sideways row on a phone, a grid once there is room. Which side
 * of each card is up lasts for the visit; which cards were ever flipped is the store's to keep,
 * because the first flip of each pays XP exactly once.
 */
export function MythDeck({ flippedEver }: { flippedEver: readonly number[] }) {
  const deck = useMemo(() => buildMythDeck(flippedEver), [flippedEver]);
  const [cards, setCards] = useState<Readonly<Record<number, CardState>>>({});
  const [announcement, setAnnouncement] = useState('');
  const stampTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (stampTimer.current !== null) window.clearTimeout(stampTimer.current);
    },
    [],
  );

  const flip = (card: MythCardModel, toVerdict: boolean) => {
    const before = cards[card.number] ?? FACE_DOWN;
    if (before.flipped === toVerdict) return;

    if (!toVerdict) {
      setCards({ ...cards, [card.number]: { ...before, flipped: false, earned: 0 } });
      setAnnouncement('');
      return;
    }

    // Every turn to the verdict counts as "opened" for quests; only the first one pays.
    const result = gameActions.flipMyth(card.number);
    const earned = result.ok ? result.xp : 0;
    setCards({
      ...cards,
      [card.number]: { flipped: true, reveals: before.reveals + 1, earned },
    });
    setAnnouncement(mythAnnouncement(card.myth, earned));

    if (stampTimer.current !== null) window.clearTimeout(stampTimer.current);
    stampTimer.current = window.setTimeout(
      () => {
        stampTimer.current = null;
        play('stamp');
      },
      prefersReducedMotion() ? 0 : STAMP_LANDS_MS,
    );
  };

  const checked = deck.filter((card) => card.checked).length;

  return (
    <section aria-labelledby="learn-myths">
      <SectionHeading
        id="learn-myths-heading"
        className="mt-0"
        title={LEARN_COPY.mythsHeading}
        meta={`${LEARN_COPY.mythsHint} · ${LEARN_COPY.mythsProgress(checked, deck.length)}`}
      />
      <p className="mb-4 max-w-[62ch] text-body-sm text-ink-2">{LEARN_COPY.mythsLead}</p>

      <ul
        aria-label={LEARN_COPY.mythListLabel}
        className="scroll-row gap-3 [--row-pad:10px] @2xl:m-0 @2xl:grid @2xl:grid-cols-3 @2xl:gap-4 @2xl:overflow-visible @2xl:p-0 @4xl:grid-cols-4 @6xl:grid-cols-5 @6xl:gap-5"
      >
        {deck.map((card) => {
          const state = cards[card.number] ?? FACE_DOWN;
          return (
            <MythCard
              key={card.myth.id}
              card={card}
              flipped={state.flipped}
              earned={state.earned}
              reveals={state.reveals}
              onFlip={(toVerdict) => flip(card, toVerdict)}
            />
          );
        })}
      </ul>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
