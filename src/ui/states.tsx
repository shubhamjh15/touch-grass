'use client';

import { CircleAlert, Copy, Download, RotateCw, WifiOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useOnlineStatus } from '@/lib/hooks';
import { Button } from './Button';
import { Card } from './Card';
import { Sticker } from './Sticker';
import type { CategoryId } from './tokens';

export type EmptyStateProps = Omit<ComponentProps<'div'>, 'title' | 'slot'> & {
  /** Mono line above the sentence: "NOTHING STUCK YET". */
  slug: string;
  /** One kind sentence. No "oops", no blame. */
  title: string;
  body?: string;
  /** One primary button. */
  action?: ReactNode;
  /** Replaces the ghost sticker. */
  illustration?: ReactNode;
  /** Shape of the default ghost sticker. */
  category?: CategoryId;
  /** Album slot number, printed after the slug as "Nº 01". */
  slot?: number;
  /** Heading level of the title. */
  as?: 'h2' | 'h3' | 'h4';
};

/** Not-yet, drawn as an empty album slot: a dashed die line, a ghost sticker, one sentence, one button. */
export function EmptyState({
  slug,
  title,
  body,
  action,
  illustration,
  category = 'nature',
  slot,
  as: Heading = 'h3',
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'grid min-h-[200px] place-items-center rounded-lg dieline p-6 text-center',
        className,
      )}
      {...rest}
    >
      <div className="flex max-w-sm flex-col items-center">
        {illustration ?? <Sticker category={category} ghost size={66} />}
        <p className="mt-4 type-slug text-ink-3">
          {slug}
          {slot === undefined ? null : ` · Nº ${String(slot).padStart(2, '0')}`}
        </p>
        <Heading className="mt-2 text-h3">{title}</Heading>
        {body ? <p className="mt-1.5 text-body-sm text-ink-2">{body}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export type SkeletonProps = Omit<ComponentProps<'div'>, 'children'> & {
  shape?: 'text' | 'block' | 'sticker' | 'row';
  /** `text`: number of bars. */
  lines?: number;
};

const LINE_WIDTH = ['w-[86%]', 'w-[72%]', 'w-[90%]', 'w-[60%]'] as const;
const BONE = 'hatch animate-hatch border-2 border-line bg-white';

/**
 * A hatched placeholder with the radius of the thing it replaces. It steps between two opacities; it
 * never shimmers. Decorative: the parent carries `aria-busy`. Only for lazy chunks and the coach.
 */
export function Skeleton({ shape = 'block', lines = 3, className, ...rest }: SkeletonProps) {
  if (shape === 'text') {
    return (
      <div aria-hidden="true" className={cn('grid gap-2.5', className)} {...rest}>
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={cn(BONE, 'block h-3 rounded-xs', LINE_WIDTH[index % LINE_WIDTH.length])}
          />
        ))}
      </div>
    );
  }
  if (shape === 'sticker') {
    return (
      <div
        aria-hidden="true"
        className={cn(BONE, 'size-[66px] rounded-full', className)}
        {...rest}
      />
    );
  }
  if (shape === 'row') {
    return (
      <div
        aria-hidden="true"
        className={cn('flex min-h-16 items-center gap-3 px-4 py-3', className)}
        {...rest}
      >
        <span className={cn(BONE, 'size-10 shrink-0 rounded-sm')} />
        <span className="grid flex-1 gap-2">
          <span className={cn(BONE, 'block h-3 w-[55%] rounded-xs')} />
          <span className={cn(BONE, 'block h-2.5 w-[35%] rounded-xs')} />
        </span>
        <span className={cn(BONE, 'block h-3 w-14 rounded-xs')} />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(BONE, 'h-32 rounded-md md:rounded-lg', className)}
      {...rest}
    />
  );
}

export type ErrorStateProps = Omit<ComponentProps<'div'>, 'title'> & {
  title?: string;
  /** A plain sentence about what happened. */
  body: string;
  onRetry?: () => void;
  onExport?: () => void;
  /** Technical details, revealed (and copied) on request. */
  details?: string;
};

/** Something came unstuck. Calm, specific, and it always says the data is safe. */
export function ErrorState({
  title = 'Something came unstuck.',
  body,
  onRetry,
  onExport,
  details,
  className,
  ...rest
}: ErrorStateProps) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = () => {
    setShown(true);
    if (!details) return;
    // Clipboard access can be denied; the details are on screen either way.
    void navigator.clipboard
      ?.writeText(details)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <Card padded={false} role="alert" className={cn('overflow-hidden', className)} {...rest}>
      <div className="flex items-center gap-2 border-b-3 border-ink bg-tomato-tint px-4 py-2.5">
        <CircleAlert size={20} strokeWidth={2.25} aria-hidden="true" />
        <span className="type-slug font-semibold">Came unstuck</span>
      </div>
      <div className="p-4 md:p-5">
        <h2 className="text-h3">{title}</h2>
        <p className="mt-1.5 text-body text-ink-2">{body}</p>
        <p className="mt-1.5 text-body-sm font-semibold">Your data is safe on this device.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {onRetry ? (
            <Button variant="primary" icon={RotateCw} onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="neutral" icon={Download} onClick={onExport}>
              Export my data
            </Button>
          ) : null}
          {details ? (
            <Button variant="ghost" icon={Copy} onClick={reveal} aria-expanded={shown}>
              Copy details
            </Button>
          ) : null}
        </div>
        {details && shown ? (
          <div className="mt-3">
            <p role="status" className="type-slug text-ink-3">
              {copied ? 'Copied to the clipboard' : 'Details'}
            </p>
            <pre className="mt-1.5 max-h-48 overflow-auto rounded-paper border-2 border-ink bg-paper p-3 font-mono text-data-sm break-words whitespace-pre-wrap">
              {details}
            </pre>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export type OfflineBannerProps = Omit<ComponentProps<'p'>, 'children'> & {
  /** Overrides the browser's network status (stories, tests). */
  offline?: boolean;
};

/** Not an error: a calm yellow pill while there is no network. Renders nothing online. */
export function OfflineBanner({ offline, className, ...rest }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const show = offline ?? !online;
  return (
    <p role="status" className={cn(!show && 'sr-only', className)} {...rest}>
      {show ? (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border-2 border-ink bg-yellow px-3 type-slug font-semibold whitespace-nowrap text-ink shadow-1">
          <WifiOff size={14} strokeWidth={2.5} aria-hidden="true" />
          Offline · everything still saves
        </span>
      ) : null}
    </p>
  );
}
