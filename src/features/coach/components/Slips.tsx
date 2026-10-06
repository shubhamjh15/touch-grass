'use client';

import Link from 'next/link';
import { memo, useMemo, type ReactNode } from 'react';
import { type CoachMessage } from '@/ai';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { Avatar, Button, ColorBar } from '@/ui';
import { useCoachUi } from '../coachUi';
import { COACH_COPY, fallbackReason } from '../copy';
import { readMessage, type ChipWorld } from '../model/chips';
import { ChipRow } from './ChipRow';
import { CoachMarkdown } from './CoachMarkdown';

const SLIP = 'border-2 border-ink p-3 text-ink';

function SlipHeader({
  who,
  at,
  extra,
  align = 'left',
}: {
  who: string;
  at: number;
  extra?: string;
  align?: 'left' | 'right';
}) {
  return (
    <p className={cn('type-slug text-ink-3', align === 'right' && 'text-right')}>
      {who}
      {extra ? ` · ${extra}` : ''} ·{' '}
      <time dateTime={new Date(at).toISOString()}>{formatTime(at)}</time>
    </p>
  );
}

/** What the user said: a yellow slip on the right, shown exactly as typed. */
export const UserSlip = memo(function UserSlip({
  message,
  fresh,
}: {
  message: CoachMessage;
  fresh: boolean;
}) {
  return (
    <li className="flex justify-end">
      <div
        className={cn(
          SLIP,
          'max-w-[80%] rounded-md rounded-tr-paper bg-yellow-tint',
          fresh && 'motion-safe:animate-stick',
        )}
      >
        <SlipHeader who={COACH_COPY.you} at={message.createdAt} align="right" />
        <p className="mt-1 text-body break-words whitespace-pre-wrap">{message.content}</p>
      </div>
    </li>
  );
});

export interface CoachSlipProps {
  message: CoachMessage;
  world: ChipWorld;
  /** Only the latest answer offers Retry, Continue and Ask again. */
  latest: boolean;
  fresh: boolean;
  busy: boolean;
  onRetryLive: () => void;
  onAskAgain: () => void;
  onContinue: () => void;
  onNavigate?: () => void;
}

/** One answer from Moss: a paper slip with a mono header, formatted text, chips and its honest label. */
export const CoachSlip = memo(function CoachSlip({
  message,
  world,
  latest,
  fresh,
  busy,
  onRetryLive,
  onAskAgain,
  onContinue,
  onNavigate,
}: CoachSlipProps) {
  const stuck = useCoachUi((state) => state.stuck);
  const { text, chips } = useMemo(
    () => readMessage(message, world, stuck),
    [message, world, stuck],
  );
  const streaming = message.status === 'streaming';
  const builtIn = message.source === 'offline';
  const reason = builtIn ? fallbackReason(message.fallbackFrom) : null;

  let footer: ReactNode = null;
  if (message.status === 'stopped') {
    footer = (
      <SlipNote
        text={COACH_COPY.stopped}
        action={latest ? { label: COACH_COPY.askAgain, onClick: onAskAgain } : undefined}
        busy={busy}
      />
    );
  } else if (message.status === 'error') {
    footer = (
      <SlipNote
        text={COACH_COPY.cutShort}
        action={latest ? { label: COACH_COPY.continueAnswer, onClick: onContinue } : undefined}
        busy={busy}
      />
    );
  } else if (reason) {
    footer = (
      <SlipNote
        text={reason}
        action={latest ? { label: COACH_COPY.retryLive, onClick: onRetryLive } : undefined}
        busy={busy}
      />
    );
  } else if (!streaming && message.source === 'live') {
    footer = (
      <p className="mt-2.5 border-t-[1.5px] border-line pt-2 text-caption text-ink-3">
        {COACH_COPY.aiFooter}{' '}
        <Link href={ROUTES.methodology} onClick={onNavigate} className="link">
          {COACH_COPY.aiFooterLink}
        </Link>
        .
      </p>
    );
  }

  return (
    <li className="flex justify-start">
      <article
        aria-busy={streaming || undefined}
        className={cn(
          SLIP,
          'max-w-[88%] min-w-0 rounded-md rounded-tl-paper bg-card',
          fresh && 'motion-safe:animate-stick',
        )}
      >
        <SlipHeader
          who={COACH_COPY.name}
          extra={builtIn ? COACH_COPY.builtInAnswer : undefined}
          at={message.createdAt}
        />
        <CoachMarkdown text={text} streaming={streaming} onNavigate={onNavigate} className="mt-1" />
        <ChipRow messageId={message.id} chips={chips} onNavigate={onNavigate} />
        {footer}
      </article>
    </li>
  );
});

function SlipNote({
  text,
  action,
  busy,
}: {
  text: string;
  action?: { label: string; onClick: () => void };
  busy: boolean;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 border-t-[1.5px] border-line pt-1.5">
      <p className="min-w-0 flex-1 basis-48 py-1 text-caption text-ink-2">{text}</p>
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          disabledReason={busy ? COACH_COPY.busy : undefined}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** The greeting before the first message. Local words, shown as Moss's own slip. */
export function GreetingSlip({ text }: { text: string }) {
  return (
    <li className="flex justify-start">
      <article className={cn(SLIP, 'max-w-[88%] rounded-md rounded-tl-paper bg-card')}>
        <p className="type-slug text-ink-3">{COACH_COPY.name}</p>
        <p className="mt-1 text-body">{text}</p>
      </article>
    </li>
  );
}

/** Between the question and the first word: Moss's thinking pose and the colour-bar loader. */
export function ThinkingSlip() {
  return (
    <li className="flex justify-start">
      <div
        role="status"
        className="flex items-center gap-3 rounded-md rounded-tl-paper border-2 border-ink bg-card py-2 pr-4 pl-2"
      >
        <Avatar kind="moss" mood="thinking" size={32} />
        <span className="text-label font-medium text-ink">{COACH_COPY.thinking}</span>
        <ColorBar loading size="sm" label="" />
      </div>
    </li>
  );
}
