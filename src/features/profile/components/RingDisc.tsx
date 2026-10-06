import type { Passport } from '@/game';
import { cn } from '@/lib/cn';
import { BARK_RADIUS, PITH_RADIUS, ringBands, ringGeometry } from '../model/ringDisc';

/**
 * The tree's cross-section: one band per active day from the pith outward, thick for a day the
 * ring closed and thin for a check-in, paper and kraft alternating inside a bark edge. The disc
 * is a picture of the numbers beside it, so it is hidden from assistive technology.
 */
export function RingDisc({
  sequence,
  className,
}: {
  sequence: Passport['ringSequence'];
  className?: string;
}) {
  const bands = ringGeometry(ringBands(sequence));
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cn('block overflow-visible', className)}
    >
      <circle
        cx={50}
        cy={50}
        r={48.5}
        fill="var(--color-kraft-dark)"
        stroke="var(--color-ink)"
        strokeWidth={2.2}
      />
      <circle
        cx={50}
        cy={50}
        r={BARK_RADIUS + 0.6}
        fill="var(--color-kraft-deep)"
        stroke="var(--color-ink)"
        strokeWidth={1}
      />
      {[...bands].reverse().map((band, reversed) => {
        const index = bands.length - 1 - reversed;
        return (
          <circle
            key={index}
            cx={50}
            cy={50}
            r={band.radius}
            fill={index % 2 === 0 ? 'var(--color-paper)' : 'var(--color-kraft)'}
            stroke="var(--color-ink)"
            strokeWidth={band.kind === 'full' ? 0.9 : 0.35}
          />
        );
      })}
      <circle
        cx={50}
        cy={50}
        r={PITH_RADIUS}
        fill="var(--color-kraft-dark)"
        stroke="var(--color-ink)"
        strokeWidth={0.8}
      />
    </svg>
  );
}
