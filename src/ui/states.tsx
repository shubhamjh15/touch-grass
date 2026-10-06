'use client';

import { CircleAlert, WifiOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useOnlineStatus } from '@/lib/hooks';
import { Button } from './Button';
import { Card } from './Card';
import { Sticker } from './Sticker';
import type { CategoryId } from './tokens';

export type EmptyStateProps = Omit<ComponentProps<'div'>, 'title' | 'slot'> & {
  /** Retired: there are no labels above titles any more. Accepted and not shown. */
  slug?: string;
  /** One kind sentence. No "oops", no blame. */
  title: string;
  body?: string;
  /** One primary button. */
  action?: ReactNode;
  /** Replaces the outlined sticker. */
  illustration?: ReactNode;
  /** Shape of the default outlined sticker. */
  category?: CategoryId;
  /** Retired with `slug`. */
  slot?: number;
  /** Heading level of the title. */
  as?: 'h2' | 'h3' | 'h4';
};

/** Not yet: an outlined sticker, one sentence, one button. Never an empty chart or an empty list. */
export function EmptyState({
  slug: _slug,
  title,
  body,
  action,
  illustration,
  category = 'nature',
  slot: _slot,
  as: Heading = 'h3',
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div className={cn('grid place-items-center px-5 py-10 text-center', className)} {...rest}>
      <div className="flex max-w-sm flex-col items-center">
        {illustration ?? <Sticker category={category} ghost size={66} />}
        <Heading className="mt-4 text-h2">{title}</Heading>
        {body ? <p className="mt-2 text-body text-ink-2">{body}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
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
const BONE = 'bg-mat-deep';

/**
 * A still, pale placeholder with the shape of the thing it replaces, so nothing jumps when the data
 * arrives. It does not shimmer or pulse. Decorative: the parent carries `aria-busy`.
 */
export function Skeleton({ shape = 'block', lines = 3, className, ...rest }: SkeletonProps) {
  if (shape === 'text') {
    return (
      <div aria-hidden="true" className={cn('grid gap-3', className)} {...rest}>
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={cn(BONE, 'block h-3 rounded-pill', LINE_WIDTH[index % LINE_WIDTH.length])}
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
        className={cn('flex min-h-16 items-center gap-3 px-5 py-3', className)}
        {...rest}
      >
        <span className={cn(BONE, 'size-10 shrink-0 rounded-md')} />
        <span className="grid flex-1 gap-2">
          <span className={cn(BONE, 'block h-3 w-[55%] rounded-pill')} />
          <span className={cn(BONE, 'block h-2.5 w-[35%] rounded-pill')} />
        </span>
        <span className={cn(BONE, 'block h-3 w-14 rounded-pill')} />
      </div>
    );
  }
  return <div aria-hidden="true" className={cn(BONE, 'h-32 rounded-lg', className)} {...rest} />;
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

/** Something went wrong. Calm, specific, with a way forward, and it always says the data is safe. */
export function ErrorState({
  title = 'Something went wrong',
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
    <Card role="alert" className={className} {...rest}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-tomato-tint text-tomato-deep"
        >
          <CircleAlert size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-h2">{title}</h2>
          <p className="mt-1 text-body text-ink-2">{body}</p>
          <p className="mt-1 text-body-sm text-ink-3">Your data is safe on this device.</p>
        </div>
      </div>
      {onRetry || onExport || details ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {onRetry ? (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="secondary" onClick={onExport}>
              Export my data
            </Button>
          ) : null}
          {details ? (
            <Button variant="link" onClick={reveal} aria-expanded={shown}>
              Copy details
            </Button>
          ) : null}
        </div>
      ) : null}
      {details && shown ? (
        <div className="mt-4">
          <p role="status" className="text-body-sm text-ink-3">
            {copied ? 'Copied to the clipboard' : 'Details'}
          </p>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-mat-deep p-3 font-mono text-data-sm break-words whitespace-pre-wrap">
            {details}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}

export type OfflineBannerProps = Omit<ComponentProps<'p'>, 'children'> & {
  /** Overrides the browser's network status (stories, tests). */
  offline?: boolean;
};

/** Not an error: a quiet pill while there is no network. Renders nothing online. */
export function OfflineBanner({ offline, className, ...rest }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const show = offline ?? !online;
  return (
    <p role="status" className={cn(!show && 'sr-only', className)} {...rest}>
      {show ? (
        <span className="inline-flex h-8 items-center gap-2 rounded-pill bg-yellow-tint px-3 text-body-sm font-medium whitespace-nowrap text-ink">
          <WifiOff size={16} strokeWidth={2} aria-hidden="true" />
          Offline. Everything still saves.
        </span>
      ) : null}
    </p>
  );
}
