'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { AiClient } from '@/ai';
import { ROUTES } from '@/app/routes';
import { CATEGORY_IDS } from '@/data/catalogue';
import {
  SAVED_CUSTOM_ACTIONS_MAX,
  customXp,
  gameActions,
  useCustomActions,
  useProfile,
  useToday,
  type LogCustomInput,
  type SavedCustomAction,
} from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { useOnlineStatus } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import {
  Button,
  CATEGORY,
  Checkbox,
  Chip,
  Co2e,
  ColorBar,
  Field,
  HonestyMark,
  IconButton,
  Input,
  Modal,
  Segmented,
  Sticker,
  toast,
  type EstimateSource,
} from '@/ui';
import { COPY } from '../copy';
import {
  blankDraft,
  cleanTitle,
  estimateCustom,
  type CustomDraft,
  type CustomNotice,
  type CustomOutcome,
  type Effort,
} from '../model/customEstimate';
import { guessCatalogueTiles, quantityIn } from '../model/search';
import type { Tile, TileState } from '../model/tiles';

const MIN_CHARS = 3;
const MAX_CHARS = 80;

export interface CustomFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Text to start with (a search that found nothing). */
  initialText: string;
  tiles: readonly TileState[];
  /** The description names a catalogue action: open its sheet instead. */
  onPickTile: (tile: Tile, actionId: string | null, qty: number | null) => void;
  onLog: (input: LogCustomInput) => void;
  /** One tap on an action saved earlier. */
  onLogSaved: (saved: SavedCustomAction) => void;
  /** Test seam for the AI client. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

type Step =
  | { name: 'describe' }
  | { name: 'match'; tiles: readonly { tile: Tile; actionId: string | null }[]; qty: number | null }
  | { name: 'estimating' }
  | { name: 'review'; origin: 'ai' | 'local' | 'manual'; notice: CustomNotice };

const NOTICE: Record<CustomNotice, string> = {
  ai: COPY.custom.sourceAi,
  local: COPY.custom.sourceLocal,
  manual: COPY.custom.sourceManual,
  offline: COPY.custom.offline,
  failed: COPY.custom.failed,
  'no-ai': COPY.custom.noAi,
  'not-climate': COPY.custom.notClimate,
};

const AI_SOURCE: EstimateSource = {
  code: 'CUSTOM',
  kind: 'ai',
  formula: 'Estimated from your description by a language model.',
  comparedWith:
    'A cautious guess, capped at 2 kg a log and 5 kg a day. It is kept out of your headline total, your badges and your pace.',
  sourceLabel: 'AI estimate',
  href: ROUTES.methodology,
};

/**
 * "Something else" (spec 3.6): say what you did, let the list claim it if it can, get an
 * estimate (the AI when one is set up, a labelled built-in guess otherwise), then check a card
 * that is always shown and always editable before anything is saved.
 * `session` changes each time the flow is opened, so nothing leaks from the last one.
 */
export function CustomFlow({ session, ...props }: CustomFlowProps & { session: number }) {
  return <CustomDialog key={session} {...props} />;
}

function CustomDialog({
  open,
  onOpenChange,
  initialText,
  tiles,
  onPickTile,
  onLog,
  onLogSaved,
  client,
}: CustomFlowProps) {
  const online = useOnlineStatus();
  const profile = useProfile();
  const today = useToday();
  const saved = useCustomActions();
  const formId = useId();
  const request = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>({ name: 'describe' });
  const [text, setText] = useState(initialText);
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState<CustomDraft>(() => blankDraft(initialText));
  const [useNumber, setUseNumber] = useState(true);
  const [keep, setKeep] = useState(false);
  /** The person said "something else": the list is not offered again. */
  const declined = useRef(false);

  useEffect(() => () => request.current?.abort(), []);

  const description = text.replace(/\s+/g, ' ').trim();
  const tooShort = description.length < MIN_CHARS;

  const apply = (outcome: CustomOutcome) => {
    if (outcome.kind === 'catalogue') {
      setStep({
        name: 'match',
        tiles: [{ tile: outcome.tile, actionId: outcome.actionId }],
        qty: outcome.qty,
      });
      return;
    }
    setDraft(outcome.draft);
    setUseNumber(outcome.draft.kg !== null);
    setStep({ name: 'review', origin: outcome.origin, notice: outcome.notice });
  };

  const estimate = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStep({ name: 'estimating' });
    try {
      const outcome = await estimateCustom(description, {
        region: profile.region,
        online,
        signal: controller.signal,
        skipCatalogue: declined.current,
        client,
      });
      if (!controller.signal.aborted) apply(outcome);
    } catch {
      // Only an abort reaches here: the person closed the sheet or went back.
    }
  };

  const lookUp = () => {
    setTouched(true);
    if (tooShort) return;
    const guesses = declined.current ? [] : guessCatalogueTiles(description, tiles);
    if (guesses.length > 0) {
      setStep({
        name: 'match',
        tiles: guesses.map((guess) => ({ tile: guess.tile, actionId: null })),
        qty: quantityIn(description),
      });
      return;
    }
    void estimate();
  };

  const backToStart = () => {
    request.current?.abort();
    setStep({ name: 'describe' });
  };

  const title = cleanTitle(draft.title);
  const kg = useNumber ? draft.kg : null;
  const xp = today.customLeft > 0 ? Math.min(customXp(draft.effort), today.logXpLeft) : 0;
  const alreadyKept = saved.some((item) => item.title.toLowerCase() === title.toLowerCase());
  const keepFull = saved.length >= SAVED_CUSTOM_ACTIONS_MAX && !alreadyKept;

  const submit = () => {
    if (title.length < MIN_CHARS) return;
    onLog({
      title,
      emoji: draft.emoji,
      category: draft.category,
      effort: draft.effort,
      qty: draft.qty,
      unit: draft.unit,
      co2eKg: kg,
      save: keep && !keepFull,
    });
  };

  const back = (
    <Button variant="ghost" onClick={backToStart}>
      {COPY.custom.back}
    </Button>
  );
  const footer =
    step.name === 'describe' ? (
      <Button type="submit" form={formId} variant="primary" size="lg" fullWidth>
        {COPY.custom.next}
      </Button>
    ) : step.name === 'review' ? (
      <>
        {back}
        <Button
          type="submit"
          form={formId}
          variant="primary"
          size="lg"
          className="max-md:w-full md:flex-1"
          disabledReason={title.length < MIN_CHARS ? COPY.custom.tooShort : undefined}
        >
          {COPY.custom.log}
        </Button>
      </>
    ) : (
      back
    );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) request.current?.abort();
        onOpenChange(next);
      }}
      title={step.name === 'review' ? COPY.custom.reviewTitle : COPY.custom.title}
      size="sm"
      footer={footer}
    >
      <form
        id={formId}
        noValidate
        className="grid grid-cols-1 gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (step.name === 'describe') lookUp();
          else if (step.name === 'review') submit();
        }}
      >
        {step.name === 'describe' ? (
          <>
            <Field
              label={COPY.custom.whatLabel}
              hint={COPY.custom.privacy}
              error={touched && tooShort ? COPY.custom.tooShort : undefined}
            >
              <Input
                value={text}
                maxLength={MAX_CHARS}
                autoComplete="off"
                enterKeyHint="next"
                placeholder={COPY.custom.whatPlaceholder}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>

            {saved.length > 0 ? (
              <section aria-label={COPY.custom.savedTitle}>
                <h3 className="text-label text-ink">{COPY.custom.savedTitle}</h3>
                <ul className="mt-1 divide-y divide-line">
                  {saved.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 py-2">
                      <button
                        type="button"
                        aria-label={COPY.custom.logSaved(item.title)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm text-left text-body font-semibold text-ink focus-inset"
                        onClick={() => onLogSaved(item)}
                      >
                        <Sticker category={item.category} size={32} rotate={0} />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </button>
                      <IconButton
                        label={COPY.custom.removeSaved(item.title)}
                        icon={X}
                        size="sm"
                        tooltipSide={null}
                        onClick={() => {
                          if (gameActions.removeSavedCustom(item.id)) {
                            toast({ title: COPY.custom.removed(item.title) });
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {step.name === 'match' ? (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-body font-semibold text-ink">{COPY.custom.looksLike}</p>
              <p className="mt-1 text-body-sm text-ink-2">{COPY.custom.looksLikeBody}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2.5">
              {step.tiles.map(({ tile, actionId }) => (
                <li key={tile.id}>
                  <button
                    type="button"
                    onClick={() => onPickTile(tile, actionId, step.qty)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 text-left transition-transform duration-(--dur-fast) ease-out active:translate-y-px"
                  >
                    <Sticker category={tile.category} icon={tile.icon} size={44} rotate={0} />
                    <span className="min-w-0 flex-1 text-body font-semibold text-ink">
                      {tile.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="neutral"
              fullWidth
              onClick={() => {
                declined.current = true;
                void estimate();
              }}
            >
              {COPY.custom.somethingElse}
            </Button>
          </div>
        ) : null}

        {step.name === 'estimating' ? (
          <div role="status" className="grid place-items-center gap-3 py-10">
            <ColorBar loading label={COPY.custom.estimating} />
            <p className="text-body-sm font-semibold text-ink-2">{COPY.custom.estimating}</p>
          </div>
        ) : null}

        {step.name === 'review' ? (
          <>
            <p role="status" className="text-body-sm text-ink-2">
              {NOTICE[step.notice]}
            </p>

            <Field
              label={COPY.custom.nameLabel}
              error={title.length < MIN_CHARS ? COPY.custom.tooShort : undefined}
            >
              <Input
                value={draft.title}
                maxLength={MAX_CHARS}
                autoComplete="off"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-label text-ink">{COPY.custom.categoryLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_IDS.map((id) => (
                  <Chip
                    key={id}
                    selected={draft.category === id}
                    className="h-10 px-4 text-body-sm"
                    onClick={() => {
                      play('tick');
                      setDraft((current) => ({ ...current, category: id }));
                    }}
                  >
                    {CATEGORY[id].label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-2.5">
              <p className="text-label text-ink">{COPY.custom.effortLabel}</p>
              <Segmented
                aria-label={COPY.custom.effortLabel}
                fullWidth
                value={String(draft.effort)}
                onValueChange={(value) => {
                  play('tick');
                  setDraft((current) => ({ ...current, effort: Number(value) as Effort }));
                }}
                options={COPY.custom.effort.map((label, index) => ({
                  value: String(index + 1),
                  label,
                }))}
              />
            </div>

            <div
              aria-live="polite"
              data-testid="custom-preview"
              className="rounded-lg bg-mat px-4 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                {kg !== null ? (
                  <p className="flex flex-wrap items-baseline gap-x-2 text-h2 text-ink">
                    <HonestyMark source={AI_SOURCE} className="self-center" />
                    <span className="sr-only">approximately </span>
                    <span className="underline decoration-dotted decoration-2 underline-offset-4">
                      {formatCo2Estimate(kg)}
                    </span>
                    <span className="text-body font-medium text-ink-2">
                      <Co2e explain />
                    </span>
                  </p>
                ) : (
                  <p className="text-body font-semibold text-ink">{COPY.custom.notQuantified}</p>
                )}
                <p className="text-body font-bold whitespace-nowrap text-ink">
                  {xp > 0 ? `+${formatNumber(xp)} XP` : COPY.quick.noXp}
                </p>
              </div>
              {kg !== null ? (
                <p className="mt-1.5 text-body-sm text-ink-2">{COPY.custom.aiLabel}</p>
              ) : null}
              {today.customLeft === 0 ? (
                <p className="mt-2 text-body-sm font-semibold text-ink">{COPY.custom.capReached}</p>
              ) : null}
              {draft.kg !== null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-2"
                  onClick={() => setUseNumber((value) => !value)}
                >
                  {useNumber ? COPY.custom.dropNumber : COPY.custom.restoreNumber}
                </Button>
              ) : null}
            </div>

            <Checkbox
              checked={keep && !keepFull}
              onCheckedChange={setKeep}
              disabled={keepFull}
              label={COPY.custom.keep}
              description={keepFull ? COPY.custom.keepFull : undefined}
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}
