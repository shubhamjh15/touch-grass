'use client';

import { X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';

export type BannerTone = 'neutral' | 'success' | 'info' | 'warning';

const TONE: Record<BannerTone, string> = {
  neutral: 'bg-mat-deep',
  success: 'bg-green-tint',
  info: 'bg-blue-tint',
  warning: 'bg-yellow-tint',
};

export interface BannerProps {
  title: string;
  /** One or two lines under the title. */
  children?: ReactNode;
  tone?: BannerTone;
  icon?: LucideIcon;
  /** One link or small button ("See your week"). */
  action?: ReactNode;
  /** Shows a close button. Called once; the banner also hides itself straight away. */
  onDismiss?: () => void;
  /** Accessible name of the close button. */
  dismissLabel?: string;
  className?: string;
}

/**
 * One quiet line across the top of a page that the user can close: the weekly recap on the day it
 * arrives, a welcome back. At most one per screen. It is announced politely, never as an alert.
 */
export function Banner({
  title,
  children,
  tone = 'neutral',
  icon: Icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: BannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg py-3 pr-2 pl-5 text-ink',
        TONE[tone],
        !onDismiss && 'pr-5',
        className,
      )}
    >
      {Icon ? (
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="mt-2.5 shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1 py-2">
        <p className="text-body font-semibold">{title}</p>
        {children ? <div className="mt-0.5 text-body-sm text-ink-2">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <IconButton
          label={dismissLabel}
          icon={X}
          variant="ghost"
          tooltipSide={null}
          onClick={() => {
            setDismissed(true);
            onDismiss();
          }}
        />
      ) : null}
    </div>
  );
}
