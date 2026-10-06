'use client';

/**
 * Moss: the conversation with the coach. One component for both surfaces, so they can never
 * drift apart: `variant="drawer"` fills the shell's coach sheet and scrolls its own list;
 * `variant="page"` is the `/coach` route and scrolls with the document.
 *
 * FOR THE SHELL: default export, every prop optional. Give the drawer a box with a definite
 * height and no padding. Never mount two panels at once (each owns a coach controller on the
 * one saved chat). The draft and the reading position live in a module store, so closing and
 * reopening the drawer loses neither.
 */
import { ArrowDown, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCoachStore, type CoachMessage, type QuickPrompt } from '@/ai';
import { ROUTES } from '@/app/routes';
import { gameActions, useGameState, useProfile, useTreeStatus } from '@/game';
import { cn } from '@/lib/cn';
import { Avatar, Button, ConfirmDialog, TapeNote, toast } from '@/ui';
import { useCoachUi, type PanelVariant } from './coachUi';
import { Composer } from './components/Composer';
import { QuickPrompts } from './components/QuickPrompts';
import { CoachSlip, GreetingSlip, ThinkingSlip, UserSlip } from './components/Slips';
import { StatusControls } from './components/StatusControls';
import { COACH_COPY, greeting } from './copy';
import { readMessage } from './model/chips';
import { announcement, countChars } from './model/text';
import { useAutoScroll } from './useAutoScroll';
import { useChipWorld } from './useChipWorld';
import { statusLine, useCoachSession } from './useCoachSession';

export interface CoachPanelProps {
  /** `drawer` (default): fills its box and scrolls inside it. `page`: scrolls with the document. */
  variant?: PanelVariant;
  /** Called right before a chip or an in-answer link leaves for another route (close the drawer there). */
  onNavigate?: () => void;
  /** When `id` changes, `text` is sent as the user's question (the palette's "Ask Moss: …"). */
  ask?: { id: string | number; text: string };
  /** When `id` changes, `text` is put in the box without sending it (`/coach?q=…`). */
  prefill?: { id: string | number; text: string };
  /** Page only: draws the page header from the pieces the panel owns (status line, controls). */
  renderHeader?: (parts: {
    controls: ReactNode;
    statusLine: string;
    thinking: boolean;
  }) => ReactNode;
  className?: string;
}

/** An answer that never got a single word: shown as a kind note, not as an empty slip. */
function isEmptyFailure(message: CoachMessage | undefined): boolean {
  return (
    message?.role === 'assistant' && message.status === 'error' && message.content.trim() === ''
  );
}

export default function CoachPanel({
  variant = 'drawer',
  onNavigate,
  ask,
  prefill,
  renderHeader,
  className,
}: CoachPanelProps) {
  const session = useCoachSession();
  const { messages, isStreaming, status, online, notice, maxLength } = session;
  const world = useChipWorld();
  const profile = useProfile();
  const tree = useTreeStatus();
  const privacySeen = useGameState((game) => game.seen.coachPrivacyNotice);

  const draft = useCoachUi((state) => state.draft);
  const setDraft = useCoachUi((state) => state.setDraft);
  const stuck = useCoachUi((state) => state.stuck);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Messages that arrive after this surface opened get the "stick" entrance and are read aloud.
  const [openedAt] = useState(() => Date.now());

  const scroller = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);

  const last = messages[messages.length - 1];
  const failed = !isStreaming && isEmptyFailure(last);
  const thinking = isStreaming && last?.role === 'assistant' && last.content.trim() === '';
  const shown = messages.filter(
    (message) => !(message.role === 'assistant' && message.content.trim() === ''),
  );

  const scroll = useAutoScroll({
    container: variant === 'drawer' ? scroller : null,
    content: list,
    signal: `${messages.length}:${last?.content.length ?? 0}:${last?.status ?? ''}`,
    initialOffset: useCoachUi.getState().scroll[variant],
    onRest: useCallback(
      (offset: number | null) => useCoachUi.getState().setScroll(variant, offset),
      [variant],
    ),
    smooth: !session.calm,
  });

  const submit = useCallback(
    async (text: string, source: 'composer' | 'other'): Promise<void> => {
      const trimmed = text.trim();
      if (trimmed === '') {
        setProblem(COACH_COPY.emptyDraft);
        return;
      }
      if (countChars(trimmed) > maxLength) return;
      if (useCoachStore.getState().isStreaming) {
        setProblem(COACH_COPY.busy);
        return;
      }
      setProblem(null);
      if (source === 'composer') setDraft('');
      // The first live message counts as having read the one-line privacy note beside it.
      if (status.kind === 'live' && !privacySeen) gameActions.markCoachPrivacyNoticeSeen();
      scroll.jump(false);
      let delivered: boolean;
      try {
        const result = await session.send(trimmed);
        delivered = result.ok && !isEmptyFailure(useCoachStore.getState().messages.at(-1));
      } catch {
        delivered = false;
      }
      // Bible string 29: the message goes back in the box when nothing could answer it.
      if (!delivered && useCoachUi.getState().draft.trim() === '') setDraft(trimmed);
    },
    [maxLength, privacySeen, scroll, session, setDraft, status.kind],
  );

  // A question handed over by the shell (palette, a "Why?" button elsewhere) is sent once.
  const asked = useRef<string | number | null>(null);
  useEffect(() => {
    if (!ask || asked.current === ask.id) return;
    asked.current = ask.id;
    void submit(ask.text, 'other');
  }, [ask, submit]);

  const prefilled = useRef<string | number | null>(null);
  useEffect(() => {
    if (!prefill || prefilled.current === prefill.id) return;
    prefilled.current = prefill.id;
    setDraft(prefill.text.slice(0, maxLength));
    composer.current?.focus();
  }, [prefill, maxLength, setDraft]);

  const retryLive = useCallback(() => {
    scroll.jump(false);
    void session.refreshStatus().then(() => session.retry());
  }, [scroll, session]);
  const askAgain = useCallback(() => {
    scroll.jump(false);
    void session.retry();
  }, [scroll, session]);
  const continueAnswer = useCallback(
    () => void submit(COACH_COPY.continuePrompt, 'other'),
    [submit],
  );

  const clearChat = () => {
    session.clear();
    useCoachUi.getState().reset();
    setProblem(null);
    toast({ title: COACH_COPY.clearDone });
    composer.current?.focus();
  };

  // Screen readers hear a finished answer once, in full: never token by token.
  const finished = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'assistant' &&
        message.status !== 'streaming' &&
        message.createdAt >= openedAt &&
        message.content.trim() !== '',
    );
  const spoken = finished
    ? announcement(
        finished.content,
        readMessage(finished, world, stuck).chips.length,
        finished.source === 'offline',
      )
    : '';

  const page = variant === 'page';
  const line = statusLine(status);
  const controls = (
    <StatusControls
      status={status}
      variant={variant}
      canClear={messages.length > 0}
      onClear={() => setConfirmClear(true)}
      onNavigate={onNavigate}
    />
  );

  const notes = (
    <>
      {!online ? (
        <p className="flex items-start gap-2 rounded-paper border-2 border-ink bg-yellow-tint px-3 py-2 text-body-sm font-medium text-ink">
          <WifiOff size={16} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
          {COACH_COPY.offline}
        </p>
      ) : null}
      {status.kind === 'live' && !privacySeen ? (
        <TapeNote tone="blue" tape="blue" rotate={0}>
          {COACH_COPY.privacyLive(status.provider)}{' '}
          <Link href={ROUTES.privacy} onClick={onNavigate} className="link">
            {COACH_COPY.privacyLink}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1"
            onClick={() => gameActions.markCoachPrivacyNoticeSeen()}
          >
            {COACH_COPY.gotIt}
          </Button>
        </TapeNote>
      ) : null}
      {notice && online ? (
        <TapeNote
          role="status"
          tone={notice.kind === 'not_configured' ? 'yellow' : 'pink'}
          tape={notice.kind === 'not_configured' ? 'green' : 'pink'}
          rotate={0}
        >
          {notice.text}
          <Button variant="ghost" size="sm" className="ml-1" onClick={session.dismissNotice}>
            {COACH_COPY.dismiss}
          </Button>
        </TapeNote>
      ) : null}
      {failed ? (
        <TapeNote role="alert" tone="pink" tape="pink" rotate={0}>
          {COACH_COPY.unreachable}
          <Button variant="ghost" size="sm" className="ml-1" onClick={askAgain}>
            {COACH_COPY.tryAgain}
          </Button>
        </TapeNote>
      ) : null}
    </>
  );

  const conversation = (
    <>
      <ol ref={list} aria-label={COACH_COPY.conversationLabel} className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <GreetingSlip text={greeting(profile.name, tree.statusLine)} />
        ) : null}
        {shown.map((message) =>
          message.role === 'user' ? (
            <UserSlip key={message.id} message={message} fresh={message.createdAt >= openedAt} />
          ) : (
            <CoachSlip
              key={message.id}
              message={message}
              world={world}
              latest={message.id === last?.id}
              fresh={message.createdAt >= openedAt}
              busy={isStreaming}
              onRetryLive={retryLive}
              onAskAgain={askAgain}
              onContinue={continueAnswer}
              onNavigate={onNavigate}
            />
          ),
        )}
        {thinking ? <ThinkingSlip /> : null}
      </ol>
      <div className="mt-4 grid gap-3 empty:hidden">{notes}</div>
    </>
  );

  const dock = (
    <>
      {scroll.away && messages.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center">
          <Button
            size="sm"
            variant={scroll.unseen ? 'reward' : 'neutral'}
            icon={ArrowDown}
            className="pointer-events-auto"
            onClick={() => scroll.jump()}
          >
            {scroll.unseen ? COACH_COPY.newReply : COACH_COPY.jumpToLatest}
          </Button>
        </div>
      ) : null}
      <QuickPrompts
        busy={isStreaming}
        onPick={(prompt: QuickPrompt) => void submit(prompt.label, 'other')}
      />
      <Composer
        className="mt-1.5"
        value={draft}
        onChange={(value) => {
          setDraft(value);
          if (problem) setProblem(null);
        }}
        onSend={() => void submit(draft, 'composer')}
        onStop={session.stop}
        streaming={isStreaming}
        maxLength={maxLength}
        problem={problem}
        inputRef={composer}
      />
    </>
  );

  const overlays = (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={COACH_COPY.clearTitle}
        description={COACH_COPY.clearBody}
        confirmLabel={COACH_COPY.clearConfirm}
        destructive
        onConfirm={clearChat}
      />
    </>
  );

  if (page) {
    return (
      <section
        aria-label={COACH_COPY.name}
        className={cn('relative flex min-h-full w-full flex-1 flex-col', className)}
      >
        {renderHeader ? (
          renderHeader({ controls, statusLine: line, thinking })
        ) : (
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Avatar kind="moss" size={44} mood={thinking ? 'thinking' : 'happy'} />
            <div className="mr-auto min-w-0">
              <h1 className="text-h3 text-ink">{COACH_COPY.name}</h1>
              <p className="type-slug text-ink-3">{COACH_COPY.role}</p>
            </div>
            {controls}
            <p className="basis-full text-body-sm text-ink-2">{line}</p>
          </header>
        )}
        <div className="flex-1 pt-5 pb-6">{conversation}</div>
        <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-b))] z-(--z-sticky) -mx-(--gutter) border-t-[1.5px] border-ink bg-mat px-(--gutter) pt-2 pb-12 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-6">
          <div className="relative">{dock}</div>
        </div>
        {overlays}
      </section>
    );
  }

  return (
    <section aria-label={COACH_COPY.name} className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b-[1.5px] border-ink px-4 pt-1 pb-2.5">
        <Avatar kind="moss" size={32} mood={thinking ? 'thinking' : 'happy'} />
        <p className="min-w-0 flex-1 text-caption text-ink-2">{line}</p>
        {controls}
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label={COACH_COPY.conversationLabel}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 focus-inset"
      >
        {conversation}
      </div>
      <div className="relative shrink-0 border-t-[1.5px] border-ink px-4 pt-2 pb-sheet">{dock}</div>
      {overlays}
    </section>
  );
}
