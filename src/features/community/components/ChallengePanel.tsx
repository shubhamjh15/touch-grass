'use client';

import { CalendarDays, Link2 } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_BY_ID } from '@/data/catalogue';
import {
  CHALLENGE_TEMPLATES,
  challengeLink,
  challengeResultFor,
  challengeTemplate,
  gameActions,
  getGameState,
  useChallenge,
  useGameState,
  useProfile,
  type CategoryId,
} from '@/game';
import type { DayKey } from '@/lib/dates';
import { formatDay } from '@/lib/format';
import {
  CATEGORY_IDS,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Meter,
  Select,
  Stamp,
  Switch,
  Tag,
  TapeNote,
} from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import { inviteLinkFor, refusalCopy, siteOrigin } from '../model/challengeLinks';
import { LinkBox } from './LinkBox';

const COPY = COMMUNITY_COPY.challenge;
const MESSAGE_MAX = 80;

const TEMPLATE_OPTIONS = CHALLENGE_TEMPLATES.map((template) => ({
  value: template.id,
  label: template.title,
}));
const CATEGORY_OPTIONS = CATEGORY_IDS.map((id) => ({ value: id, label: CATEGORY_BY_ID[id].label }));

function ResultLink({ today }: { today: DayKey }) {
  const [includeName, setIncludeName] = useState(false);
  const [encoded, setEncoded] = useState<string | null>(null);
  const make = () => setEncoded(challengeResultFor(getGameState(), today, includeName));

  return (
    <div className="grid gap-3 border-t-[1.5px] border-ink pt-4">
      <p className="text-body-sm text-ink-2">{COPY.resultHint}</p>
      <Switch
        label={COPY.resultInclude}
        checked={includeName}
        onCheckedChange={(next) => {
          setIncludeName(next);
          setEncoded(null);
        }}
      />
      {encoded ? (
        <LinkBox
          label={COPY.resultLabel}
          url={challengeLink(siteOrigin(), encoded, 'result')}
          shareText="Here is how my Touch Grass challenge went."
        />
      ) : (
        <div>
          <Button variant="neutral" size="sm" icon={Link2} onClick={make}>
            {COPY.makeResult}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The challenge the visitor is in right now: progress, days left, the link to send, and a no-penalty way out. */
interface NameChoice {
  includeName: boolean;
  onIncludeNameChange: (value: boolean) => void;
}

function ActiveChallenge({
  today,
  includeName,
  onIncludeNameChange,
}: { today: DayKey } & NameChoice) {
  const view = useChallenge();
  const profile = useProfile();
  const [confirming, setConfirming] = useState(false);
  if (!view) return null;

  const { state, progress, finished } = view;
  const creator = state.role === 'creator';
  const link = creator ? inviteLinkFor(state, profile, includeName) : null;
  const dare = challengeTemplate(state.templateId)?.dare(state.category) ?? '';

  return (
    <Card as="section" aria-labelledby="active-challenge-title" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 type-slug text-ink-3">
            {creator ? COPY.youStarted : COPY.fromFriend(state.from)}
          </p>
          <h2 id="active-challenge-title" className="text-h3">
            {progress.template.title}
          </h2>
        </div>
        {finished ? (
          <Stamp hue="green" label={COPY.done} animate />
        ) : (
          <Tag hue="yellow" icon={CalendarDays}>
            {COPY.daysLeft(progress.daysLeft)}
          </Tag>
        )}
      </div>

      <p className="max-w-prose text-body">{view.invite ?? `You dared a friend: ${dare}.`}</p>
      {state.message ? (
        <TapeNote tone="paper" tape="blue" rotate={0} className="max-w-prose">
          “{state.message}”
        </TapeNote>
      ) : null}

      <div className="grid gap-2">
        <Meter
          value={progress.current}
          max={progress.target}
          tone={finished ? 'green' : 'blue'}
          label={`${progress.template.title} progress`}
          valueText={view.progressText}
        />
        <p className="font-mono text-data font-semibold">
          {view.progressText}
          <span className="font-medium text-ink-3">
            {' · '}
            {formatDay(progress.startDay, today)} to {formatDay(progress.endDay, today)}
          </span>
        </p>
      </div>

      {finished ? (
        <div className="grid gap-1">
          <p className="text-h3">{COPY.finishedTitle}</p>
          <p className="text-body-sm text-ink-2">{COPY.finishedBody}</p>
        </div>
      ) : null}

      {link ? (
        <div className="grid gap-3 border-t-[1.5px] border-ink pt-4">
          <LinkBox label={COPY.linkLabel} url={link} shareText={COPY.shareText(dare)} />
          <Switch
            label={COPY.includeName}
            description={COPY.includeNameHint}
            checked={includeName}
            onCheckedChange={onIncludeNameChange}
          />
        </div>
      ) : null}

      {finished ? <ResultLink today={today} /> : null}

      <p className="text-caption text-ink-3">{COPY.noAccounts}</p>

      {!finished ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {COPY.giveUp}
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="ghost" size="sm" onClick={() => gameActions.dismissChallenge()}>
            {COMMUNITY_COPY.invite.dismiss}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={COPY.giveUpTitle}
        description={COPY.giveUpBody}
        confirmLabel={COPY.giveUpConfirm}
        cancelLabel={COPY.keepGoing}
        onConfirm={() => gameActions.dismissChallenge()}
      />
    </Card>
  );
}

/** Pick a dare, add a line if you like, and get a link. The seven days start for you as you press the button. */
function CreateChallenge({ includeName, onIncludeNameChange }: NameChoice) {
  const [templateId, setTemplateId] = useState(CHALLENGE_TEMPLATES[1]?.id ?? 'rings_5');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const template = challengeTemplate(templateId);
  const needsCategory = template?.needsCategory ?? false;

  const create = () => {
    const result = gameActions.createChallenge({ templateId, category, message, includeName });
    setError(result.ok ? null : refusalCopy(result.reason));
  };

  return (
    <Card as="section" aria-labelledby="create-challenge-title" className="grid gap-4">
      <div>
        <h2 id="create-challenge-title" className="text-h3">
          {COPY.title}
        </h2>
        <p className="mt-1 max-w-prose text-body-sm text-ink-2">{COPY.lead}</p>
      </div>

      <div className="grid gap-4 @xl:grid-cols-2">
        <Field label={COPY.templateLabel}>
          <Select value={templateId} onValueChange={setTemplateId} options={TEMPLATE_OPTIONS} />
        </Field>
        {needsCategory ? (
          <Field
            label={COPY.categoryLabel}
            error={error === COPY.needsCategory ? error : undefined}
          >
            <Select
              value={category ?? undefined}
              onValueChange={(next) => {
                setCategory(next as CategoryId);
                setError(null);
              }}
              options={CATEGORY_OPTIONS}
              placeholder={COPY.categoryPlaceholder}
            />
          </Field>
        ) : null}
      </div>

      <Field label={COPY.messageLabel} hint={COPY.messageHint(MESSAGE_MAX - message.length)}>
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          placeholder={COPY.messagePlaceholder}
          autoComplete="off"
        />
      </Field>

      <Switch
        label={COPY.includeName}
        description={COPY.includeNameHint}
        checked={includeName}
        onCheckedChange={onIncludeNameChange}
      />

      <div className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-ink pt-4">
        <Button variant="primary" icon={Link2} onClick={create}>
          {COPY.create}
        </Button>
        <p className="min-w-0 flex-1 basis-48 text-caption text-ink-3">{COPY.noAccounts}</p>
      </div>
      <p role="status" className="min-h-5 text-body-sm text-tomato-deep">
        {error !== COPY.needsCategory ? (error ?? '') : ''}
      </p>
    </Card>
  );
}

function History() {
  const history = useGameState((state) => state.challenge.history);
  if (history.length === 0) return null;
  const rows = [...history].reverse().slice(0, 5);
  return (
    <section aria-labelledby="challenge-history" className="grid gap-2">
      <h2 id="challenge-history" className="text-label text-ink">
        {COPY.historyTitle}
      </h2>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={`${row.templateId}-${row.startDay}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-sm border-2 border-ink bg-white px-3 py-2 text-body-sm"
          >
            <span>
              {COPY.historyLine(
                challengeTemplate(row.templateId)?.title ?? 'Challenge',
                row.done,
                row.of,
              )}
            </span>
            <Tag hue={row.success ? 'green' : 'paper'}>
              {row.success ? COPY.historySuccess : COPY.historyOpen}
            </Tag>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ChallengePanelProps {
  today: DayKey;
}

export function ChallengePanel({ today }: ChallengePanelProps) {
  const view = useChallenge();
  const busy = view !== null;
  // One choice for the whole tab: the switch on the form and the one by the link are the same setting.
  const [includeName, setIncludeName] = useState(false);
  return (
    <div className="grid gap-5">
      <ActiveChallenge
        today={today}
        includeName={includeName}
        onIncludeNameChange={setIncludeName}
      />
      {busy ? (
        <p className="text-body-sm text-ink-2">{COPY.busy}</p>
      ) : (
        <CreateChallenge includeName={includeName} onIncludeNameChange={setIncludeName} />
      )}
      <History />
    </div>
  );
}
