import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The landing page's flat spot illustrations. Decorative: each sits beside the words it
 * illustrates, so every one is hidden from assistive technology. Colours are tokens.
 */

const INK = 'var(--color-ink)';
const WHITE = 'var(--color-white)';

function Spot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      width={120}
      height={96}
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0 overflow-visible', className)}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A kitchen scale weighing a cloud you cannot see: the needle has not moved. */
export function InvisibleSpot({ className }: { className?: string }) {
  return (
    <Spot className={className}>
      <path
        d="M38 40a11 11 0 0 1 3-21 15 15 0 0 1 28-3 12 12 0 0 1 13 24Z"
        stroke="var(--color-ink-4)"
        strokeDasharray="6 6"
      />
      <path d="M26 46h68" strokeWidth={4} />
      <path d="M60 46v8" />
      <path d="M30 90l6-36h48l6 36Z" fill="var(--color-violet)" />
      <circle cx={60} cy={73} r={13} fill={WHITE} />
      <path d="M60 73V64" strokeWidth={3.5} />
      <circle cx={60} cy={73} r={2} fill={INK} />
      <path d="M49 71l1.5 1M71 71l-1.5 1M52 65l1 1.4M68 65l-1 1.4" strokeWidth={2} />
    </Spot>
  );
}

/** A week of boxes: three ticks, each fainter, then nothing answers back. */
export function NoFeedbackSpot({ className }: { className?: string }) {
  const boxes = [0, 1, 2, 3, 4, 5, 6];
  return (
    <Spot className={className}>
      <rect x={6} y={14} width={108} height={68} rx={8} fill={WHITE} />
      <path d="M6 32h108" />
      <path d="M28 8v12M92 8v12" strokeWidth={4} />
      {boxes.map((index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = 16 + column * 24;
        const y = 39 + row * 20;
        const done = index < 3;
        return (
          <g key={index}>
            <rect
              x={x}
              y={y}
              width={16}
              height={14}
              rx={3}
              strokeWidth={2}
              fill={done ? 'var(--color-green)' : 'none'}
              fillOpacity={done ? 1 - index * 0.3 : 1}
              stroke={done ? INK : 'var(--color-ink-4)'}
              strokeDasharray={done ? undefined : '3 3'}
            />
            {done ? (
              <path
                d={`M${x + 4} ${y + 7.5}l3 3 5-6`}
                strokeWidth={2.4}
                strokeOpacity={1 - index * 0.28}
              />
            ) : null}
          </g>
        );
      })}
    </Spot>
  );
}

/** A phone that only scrolls downhill: a storm cloud and a feed of warnings. */
export function AllDoomSpot({ className }: { className?: string }) {
  return (
    <Spot className={className}>
      <rect x={36} y={4} width={48} height={88} rx={9} fill={WHITE} />
      <path d="M54 11h12" strokeWidth={2.5} />
      <path
        d="M47 40a7 7 0 0 1 2-13.6 9.5 9.5 0 0 1 18-2 7.6 7.6 0 0 1 7 15.6Z"
        fill="var(--color-pink)"
      />
      <path d="M61 42l-5 9h7l-4 9" fill="var(--color-yellow)" strokeWidth={2.4} />
      <path d="M45 68h30M45 76h22M45 84h26" stroke="var(--color-ink-4)" strokeWidth={2.5} />
      <path d="M96 30v34M88 56l8 8 8-8" strokeWidth={3.5} />
      <path d="M24 30v34M16 56l8 8 8-8" strokeWidth={3.5} stroke="var(--color-ink-4)" />
    </Spot>
  );
}

export type MiniTreeState = 'thriving' | 'thirsty' | 'resting';

const CROWN: Record<MiniTreeState, { fill: string; droop: number }> = {
  thriving: { fill: 'var(--color-green)', droop: 0 },
  thirsty: { fill: 'var(--color-yellow)', droop: 5 },
  resting: { fill: 'var(--color-kraft)', droop: 8 },
};

/**
 * One small sticker tree per vitality state. The state is carried by shape as well as by
 * colour: an upright crown with a shine, a drooping one with a drop, a bare-limbed one asleep.
 */
export function MiniTree({ state, className }: { state: MiniTreeState; className?: string }) {
  const { fill, droop } = CROWN[state];
  const resting = state === 'resting';
  return (
    <svg
      viewBox="0 0 96 104"
      width={96}
      height={104}
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0 overflow-visible', className)}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx={48} cy={94} rx={34} ry={7} fill="var(--color-green-tint)" />
      <path d="M43 94l2-40h6l2 40Z" fill="var(--color-bark)" />
      {resting ? (
        <>
          <path d="M48 58c-8-8-16-9-22-8M48 54c8-10 15-12 22-11M47 50c-4-10-3-18 1-25" />
          <circle cx={27} cy={48} r={8} fill={fill} strokeDasharray="4 4" />
          <circle cx={69} cy={42} r={9} fill={fill} strokeDasharray="4 4" />
          <circle cx={49} cy={24} r={10} fill={fill} strokeDasharray="4 4" />
          <path d="M72 14h8l-8 9h8M84 4h6l-6 7h6" strokeWidth={2.4} />
        </>
      ) : (
        <>
          <circle cx={30} cy={44 + droop} r={15} fill={fill} />
          <circle cx={66} cy={44 + droop} r={15} fill={fill} />
          <circle cx={48} cy={28 + droop * 0.6} r={19} fill={fill} />
          {state === 'thriving' ? (
            <path d="M40 20c3-4 7-5 11-4" stroke={WHITE} strokeWidth={3.5} />
          ) : (
            <path
              d="M82 10c5 6 7 9 7 12a7 7 0 0 1-14 0c0-3 2-6 7-12Z"
              fill="var(--color-blue)"
              strokeWidth={2.4}
            />
          )}
        </>
      )}
    </svg>
  );
}
