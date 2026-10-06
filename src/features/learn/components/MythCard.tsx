'use client';

import { ArrowRight, Check, RotateCw, Undo2 } from 'lucide-react';
import { useId, type MouseEvent } from 'react';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/hooks';
import { Stamp, Tag, UiLink } from '@/ui';
import { LEARN_COPY } from '../copy';
import { sourceHref, sourceShortLabel } from '../model/claims';
import { mythNumber, type MythCardModel } from '../model/myths';
import { curlyQuotes, richText } from '../model/richText';

export interface MythCardProps {
  card: MythCardModel;
  flipped: boolean;
  /** XP this flip has just paid; 0 on every flip after the first. */
  earned: number;
  /** How many times the verdict has been turned up this visit: replays the stamp. */
  reveals: number;
  onFlip: (toVerdict: boolean) => void;
}

/** Both faces share one grid cell, so the card is as tall as its longer side and never clips. */
const FACE =
  'relative flex min-h-[19rem] min-w-0 flex-col rounded-md border-3 border-ink px-4 pt-3.5 pb-14 [grid-area:1/1]';

const INLINE_LINK =
  'rounded-xs py-1 font-semibold text-ink underline decoration-2 underline-offset-4 fine:hover:bg-yellow-tint';

/** The dashed fold above the flip strip, drawn on each face so it turns with the card. */
function Fold() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 bottom-11 border-t-2 border-dashed border-ink"
    />
  );
}

/**
 * One myth-buster card. The myth is on the front; the verdict, the reason and the source are on
 * the back. It turns over in 3D on a click, Enter or Space.
 *
 * One real toggle button lies over the whole card, so there is a single focus stop whose ring
 * wraps the card and whose pressed state says which side is up. The face that is turned away is
 * inert, so its links can never take focus unseen. Once the verdict is showing the button lets
 * the pointer through everywhere but its own strip: the text can be selected and the links
 * followed, while a plain click on the paper still turns the card back.
 */
export function MythCard({ card, flipped, earned, reveals, onFlip }: MythCardProps) {
  const claimId = useId();
  const hintId = useId();
  const verdictId = useId();
  const reduced = useReducedMotion();
  const { myth, number, checked, lesson, stamp } = card;

  const turnBack = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest('a')) return;
    // Dragging across the text to copy it ends in a click too; that is not a request to flip.
    if (window.getSelection()?.toString()) return;
    onFlip(false);
  };

  return (
    <li className="group/myth relative grid w-[272px] min-w-0 perspective-[1200px] @2xl:w-auto">
      {/* The hard shadow stays on the table while the card turns above it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-md bg-ink"
      />

      <div
        data-flipped={flipped}
        className={cn(
          'relative grid [grid-area:1/1]',
          !reduced &&
            'transition-[transform,translate] duration-(--dur-slow) ease-in-out transform-3d fine:group-hover/myth:-translate-0.5',
          !reduced && flipped && 'rotate-y-180',
        )}
      >
        <div
          inert={flipped}
          aria-hidden={flipped}
          className={cn(
            FACE,
            'bg-card',
            reduced
              ? ['transition-opacity duration-(--dur-fast)', flipped && 'invisible opacity-0']
              : 'backface-hidden',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <Tag hue="pink">{LEARN_COPY.mythTag}</Tag>
            <span className="type-slug text-ink-3">{mythNumber(number)}</span>
          </span>
          <p
            id={claimId}
            className="my-auto py-5 text-[1.375rem] leading-[1.18] font-bold text-balance"
          >
            {curlyQuotes(myth.myth)}
          </p>
          <span className="flex min-h-[22px] items-center">
            {checked ? (
              <Tag hue="green" icon={Check}>
                {LEARN_COPY.mythChecked}
              </Tag>
            ) : (
              <Tag hue="yellow">{LEARN_COPY.mythReward}</Tag>
            )}
          </span>
          <span aria-hidden="true" className="h-3" />
          <Fold />
        </div>

        {/* A plain click on the paper turns the card back; the toggle button is the real control. */}
        <div
          role="presentation"
          inert={!flipped}
          aria-hidden={!flipped}
          onClick={turnBack}
          className={cn(
            FACE,
            'bg-paper',
            reduced
              ? ['transition-opacity duration-(--dur-fast)', !flipped && 'invisible opacity-0']
              : 'rotate-y-180 backface-hidden',
          )}
        >
          <span className="flex min-h-10 items-start justify-between gap-2">
            <Stamp
              key={reveals}
              label={stamp.label}
              hue={stamp.hue}
              rotate={-5}
              animate={flipped && !reduced}
              className="mt-1 ml-1.5 [animation-delay:200ms]"
            />
            {earned > 0 ? (
              <Tag hue="yellow" className={cn(!reduced && 'animate-pop [animation-delay:440ms]')}>
                +{earned} XP
              </Tag>
            ) : (
              <span className="type-slug text-ink-3">{mythNumber(number)}</span>
            )}
          </span>
          <p id={verdictId} className="mt-4 text-body-sm">
            <b className="font-bold">{myth.verdictLabel}</b> {richText(myth.explanation)}
          </p>
          <p className="mt-auto pt-3 pb-2 text-caption leading-[1.7] text-ink-2">
            <span className="mr-1.5 type-slug text-ink-3">{LEARN_COPY.mythSource}</span>
            {myth.sources.map((source, index) => (
              <span key={source.key}>
                {index > 0 ? ' · ' : null}
                <UiLink
                  href={sourceHref(source.key)}
                  tabIndex={flipped ? undefined : -1}
                  className={INLINE_LINK}
                >
                  {sourceShortLabel(source)}
                </UiLink>
              </span>
            ))}
            {lesson ? (
              <>
                <br />
                <UiLink
                  href={ROUTES.lesson(lesson.id)}
                  tabIndex={flipped ? undefined : -1}
                  className={cn(INLINE_LINK, 'inline-flex items-center gap-1')}
                >
                  {LEARN_COPY.mythLesson}
                  <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
                </UiLink>
              </>
            ) : null}
          </p>
          <Fold />
        </div>
      </div>

      <button
        type="button"
        aria-pressed={flipped}
        aria-labelledby={claimId}
        aria-describedby={flipped ? verdictId : hintId}
        onClick={() => onFlip(!flipped)}
        className={cn(
          'relative z-10 flex items-end rounded-md text-ink [grid-area:1/1]',
          flipped && 'pointer-events-none',
        )}
      >
        <span
          // Keyed by side: the label leaves at once and comes back when the card has turned.
          key={flipped ? 'back' : 'front'}
          className={cn(
            'pointer-events-auto flex h-11 w-full items-center justify-center gap-1.5 type-slug font-semibold',
            // Not on arrival: only once the card has been turned at least once.
            !reduced && reveals > 0 && 'animate-pop [animation-delay:300ms]',
          )}
        >
          {flipped ? (
            <Undo2 size={14} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <RotateCw size={14} strokeWidth={2.5} aria-hidden="true" />
          )}
          {flipped ? LEARN_COPY.mythFlipBack : LEARN_COPY.mythFlip}
        </span>
      </button>
      <span id={hintId} hidden>
        {`Myth ${number}. ${LEARN_COPY.mythFlip}.`}
      </span>
    </li>
  );
}
