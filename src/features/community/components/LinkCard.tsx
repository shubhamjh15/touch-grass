'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import {
  challengeInviteText,
  challengeResultText,
  challengeTemplate,
  gameActions,
  useChallenge,
} from '@/game';
import { formatLongDate } from '@/lib/format';
import { Button, Card, TapeNote } from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import { refusalCopy } from '../model/challengeLinks';
import { clearLinkHash, type LinkView } from '../model/linkHash';

const COPY = COMMUNITY_COPY.invite;

export interface LinkCardProps {
  view: Exclude<LinkView, { kind: 'none' }>;
  /** The visitor accepted: the page shows them their new challenge. */
  onAccepted: () => void;
  /** The visitor wants to make their own challenge instead. */
  onStartOwn: () => void;
}

/**
 * What the address bar asked for. An invite is the one featured card on the page; a damaged or
 * expired link is explained plainly, never silently ignored.
 */
export function LinkCard({ view, onAccepted, onStartOwn }: LinkCardProps) {
  const active = useChallenge();
  const [error, setError] = useState<string | null>(null);
  const busy = active !== null && !active.finished;

  if (view.kind === 'broken') {
    return (
      <TapeNote tone="pink" tape="pink" rotate={0} role="alert" className="max-w-prose">
        <span className="block">{view.message}</span>
        <span className="mt-2 flex flex-wrap gap-2">
          {view.expired ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                clearLinkHash();
                onStartOwn();
              }}
            >
              {COPY.startOwn}
            </Button>
          ) : null}
          <Button variant="neutral" size="sm" icon={X} onClick={clearLinkHash}>
            {COPY.dismiss}
          </Button>
        </span>
      </TapeNote>
    );
  }

  if (view.kind === 'result') {
    const template = challengeTemplate(view.payload.k);
    return (
      <Card as="section" tone="paper" aria-labelledby="link-card-title" className="grid gap-3">
        <p className="type-slug text-ink-3">
          {COPY.resultSlug} · {formatLongDate(view.payload.on)}
        </p>
        <h2 id="link-card-title" className="text-h3">
          {challengeResultText(view.payload)}
        </h2>
        {template ? <p className="text-body-sm text-ink-2">{template.title}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              clearLinkHash();
              onStartOwn();
            }}
          >
            {COPY.challengeBack}
          </Button>
          <Button variant="neutral" size="sm" icon={X} onClick={clearLinkHash}>
            {COPY.dismiss}
          </Button>
        </div>
      </Card>
    );
  }

  if (view.expired) {
    return (
      <TapeNote tone="pink" tape="pink" rotate={0} role="alert" className="max-w-prose">
        <span className="block">{COPY.expired}</span>
        <span className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              clearLinkHash();
              onStartOwn();
            }}
          >
            {COPY.startOwn}
          </Button>
          <Button variant="neutral" size="sm" icon={X} onClick={clearLinkHash}>
            {COPY.dismiss}
          </Button>
        </span>
      </TapeNote>
    );
  }

  const accept = () => {
    const result = gameActions.acceptChallenge(view.encoded);
    if (!result.ok) {
      setError(refusalCopy(result.reason));
      return;
    }
    clearLinkHash();
    onAccepted();
  };

  return (
    <Card
      as="section"
      featured
      plate="yellow"
      aria-labelledby="link-card-title"
      className="grid gap-4"
    >
      <p className="type-slug text-ink-3">{COPY.featuredSlug}</p>
      <h2 id="link-card-title" className="text-h2">
        {challengeInviteText(view.payload)}
      </h2>
      {view.payload.m ? (
        <TapeNote
          tone="yellow"
          tape="pink"
          rotate={0}
          author={`${COPY.messageFrom}:`}
          className="max-w-prose"
        >
          {view.payload.m}
        </TapeNote>
      ) : null}
      <p className="max-w-prose text-body-sm text-ink-2">
        {COPY.runs} {COMMUNITY_COPY.challenge.noAccounts}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          icon={Check}
          onClick={accept}
          disabledReason={busy ? COPY.busy : undefined}
        >
          {COPY.accept}
        </Button>
        <Button variant="ghost" onClick={clearLinkHash}>
          {COPY.notNow}
        </Button>
        {busy ? (
          <Button variant="neutral" size="sm" onClick={() => gameActions.dismissChallenge()}>
            {COPY.giveUpFirst}
          </Button>
        ) : null}
      </div>
      <p role="status" className="min-h-5 text-body-sm text-tomato-deep">
        {error ?? (busy ? COPY.busy : '')}
      </p>
    </Card>
  );
}
