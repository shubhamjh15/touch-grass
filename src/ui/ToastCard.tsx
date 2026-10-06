'use client';

import { Check, CircleAlert, Info, X, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Sticker } from './Sticker';
import type { CategoryId } from './tokens';

export type ToastTone = 'neutral' | 'success' | 'info' | 'danger';

export interface ToastCardProps {
  title: string;
  /** Mono line under the title: "≈1.02 kg CO2e · +30 XP". Estimates start with `<Approx weight="mono" />`. */
  meta?: ReactNode;
  /** Leads with that category's sticker. */
  category?: CategoryId;
  /** Overrides the sticker's glyph or the tone disc's icon. */
  icon?: LucideIcon;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds the toast stays; drives the stepping timer bar when there is an action. */
  duration?: number;
  onDismiss?: () => void;
}

const DISC: Record<ToastTone, { className: string; icon: LucideIcon | null }> = {
  neutral: { className: 'bg-white', icon: null },
  success: { className: 'bg-green', icon: Check },
  info: { className: 'bg-blue', icon: Info },
  danger: { className: 'bg-tomato-tint', icon: CircleAlert },
};

/** A toast is a mini receipt: sticker, one bold line, one mono line, at most one action. */
export function ToastCard({
  title,
  meta,
  category,
  icon,
  tone = 'neutral',
  action,
  duration,
  onDismiss,
}: ToastCardProps) {
  const danger = tone === 'danger';
  const disc = DISC[tone];
  const DiscIcon = icon ?? disc.icon;
  const timed = Boolean(action) && duration !== undefined && Number.isFinite(duration);

  return (
    <div
      role={danger ? 'alert' : 'status'}
      className="relative flex w-[min(100vw-24px,380px)] animate-stick items-center gap-3 overflow-hidden rounded-md border-3 border-ink bg-card py-2.5 pr-2.5 pl-3 text-ink shadow-3"
    >
      {category ? (
        <Sticker category={category} icon={icon} size={32} rotate={-4} className="mr-0.5" />
      ) : DiscIcon ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink',
            disc.className,
          )}
        >
          <DiscIcon size={16} strokeWidth={2.6} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-bold">{title}</p>
        {meta ? <p className="font-mono text-data-sm text-ink-2">{meta}</p> : null}
      </div>
      {action ? (
        <Button
          size="sm"
          variant="neutral"
          onClick={() => {
            action.onClick();
            onDismiss?.();
          }}
        >
          {action.label}
        </Button>
      ) : null}
      {danger ? (
        <IconButton label="Dismiss" icon={X} size="sm" tooltipSide={null} onClick={onDismiss} />
      ) : null}
      {timed ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[3px] origin-left animate-timer bg-ink"
          style={{ '--timer-dur': `${duration}ms` } as CSSProperties}
        />
      ) : null}
    </div>
  );
}
