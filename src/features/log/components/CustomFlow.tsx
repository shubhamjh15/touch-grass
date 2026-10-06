'use client';

import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { AiClient } from '@/ai';
import { ROUTES } from '@/app/routes';
import { CATEGORIES, type CategoryId } from '@/data/catalogue';
import {
  SAVED_CUSTOM_ACTIONS_MAX,
  customXp,
  useCustomActions,
  useProfile,
  useToday,
  type LogCustomInput,
} from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { useOnlineStatus } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import {
  Button,
  CATEGORY_ICON,
  Checkbox,
  Co2e,
  ColorBar,
  Field,
  HonestyMark,
  Input,
  Modal,
  Panel,
  Segmented,
  Sticker,
  Tag,
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
import { parseQty } from '../model/units';

const MIN_CHARS = 3;
const MAX_CHARS = 80;

export interface CustomStickJob {
  category: CategoryId;
  origin: Element | null;
  input: LogCustomInput;
}

export interface CustomFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Text to start with (a search that found nothing). */
  initialText: string;
  tiles: readonly TileState[];
  /** The description names a catalogue action: open its sheet instead. */
  onPickTile: (tile: Tile, actionId: string | null, qty: number | null) => void;
  onStick: (job: CustomStickJob) => void;
  /** Test seam for the AI client. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
  /** Changes whenever the page opens the flow afresh, so earlier text never lingers. */
  session?: number;
}

type Step =
  | { name: 'describe' }
  | { name: 'match'; tiles: readonly { tile: Tile; actionId: string | null }[]; qty: number | null }
  | { name: 'estimating' }
  | {
      name: 'review';
      origin: 'ai' | 'local' | 'manual';
      notice: CustomNotice;
      rationale: string | null;
    };

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
 * The custom-action flow (spec 3.6): describe it, let the catalogue claim it if it can, ask
 * for an estimate, then review a card that is always shown and always editable before saving.
 */
export function CustomFlow(props: CustomFlowProps) {
  // A fresh flow each time it opens: nothing from the last custom action leaks into the next.
  const [session, setSession] = useState(0);
  const { open, onOpenChange } = props;
  return (
    <CustomDialog
      key={`${props.session ?? 0}:${session}`}
      {...props}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && open) window.setTimeout(() => setSession((value) => value + 1), 400);
      }}
    />
  );
}

function CustomDialog({
  open,
  onOpenChange,
  initialText,
  tiles,
  onPickTile,
  onStick,
  client,
}: CustomFlowProps) {
  const online = useOnlineStatus();
  const profile = useProfile();
  const today = useToday();
  const saved = useCustomActions();
  const formId = useId();
  const stickerRef = useRef<HTMLSpanElement | null>(null);
  const request = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>({ name: 'describe' });
  const [text, setText] = useState(initialText);
  const [qtyText, setQtyText] = useState('');
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState<CustomDraft>(() => blankDraft(initialText));
  const [useNumber, setUseNumber] = useState(true);
  const [keep, setKeep] = useState(false);
  /** The person said "something else": the catalogue is not offered again. */
  const declined = useRef(false);

  useEffect(() => () => request.current?.abort(), []);

  const description = text.replace(/\s+/g, ' ').trim();
  const tooShort = description.length < MIN_CHARS;
  const typedQty = qtyText.trim() === '' ? undefined : (parseQty(qtyText) ?? null);
  const qtyInvalid = typedQty === null;

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
    setStep({
      name: 'review',
      origin: outcome.origin,
      notice: outcome.notice,
      rationale: outcome.rationale,
    });
  };

  const estimate = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStep({ name: 'estimating' });
    try {
      const outcome = await estimateCustom(description, {
        region: profile.region,
        quantity: typedQty ?? undefined,
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
    if (tooShort || qtyInvalid) return;
    const guesses = declined.current ? [] : guessCatalogueTiles(description, tiles);
    if (guesses.length > 0) {
      setStep({
        name: 'match',
        tiles: guesses.map((guess) => ({ tile: guess.tile, actionId: null })),
        qty: typedQty ?? quantityIn(description),
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

  const stick = () => {
    if (title.length < MIN_CHARS) return;
    onStick({
      category: draft.category,
      origin: stickerRef.current,
      input: {
        title,
        emoji: draft.emoji,
        category: draft.category,
        effort: draft.effort,
        qty: draft.qty,
        unit: draft.unit,
        co2eKg: kg,
        save: keep && !keepFull,
      },
    });
  };

  const footer =
    step.name === 'describe' ? (
      <Button type="submit" form={formId} variant="primary" size="lg" fullWidth icon={Search}>
        {COPY.custom.next}
      </Button>
    ) : step.name === 'review' ? (
      <>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={backToStart}>
          {COPY.custom.back}
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          size="lg"
          fullWidth
          disabledReason={title.length < MIN_CHARS ? COPY.custom.tooShort : undefined}
        >
          {COPY.custom.stick}
        </Button>
      </>
    ) : (
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={backToStart}>
        {COPY.custom.back}
      </Button>
    );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) request.current?.abort();
        onOpenChange(next);
      }}
      title={step.name === 'review' ? COPY.custom.reviewTitle : COPY.custom.title}
      size="md"
      footer={footer}
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (step.name === 'describe') lookUp();
          else if (step.name === 'review') stick();
        }}
      >
        {step.name === 'describe' ? (
          <>
            <Field
              label={COPY.custom.whatLabel}
              hint={
                online ? COPY.custom.whatHint : `${COPY.custom.whatHint} ${COPY.custom.offline}`
              }
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
            <Field
              label={COPY.custom.qtyLabel}
              error={touched && qtyInvalid ? COPY.custom.qtyError : undefined}
            >
              <Input
                value={qtyText}
                inputMode="decimal"
                autoComplete="off"
                onChange={(event) => setQtyText(event.target.value)}
                inputClassName="font-mono text-data-lg"
              />
            </Field>
            <p className="text-caption text-ink-3">{COPY.custom.privacy}</p>
          </>
        ) : null}

        {step.name === 'match' ? (
          <div className="grid gap-3">
            <div>
              <p className="text-h4">{COPY.custom.looksLike}</p>
              <p className="mt-1 text-body-sm text-ink-2">{COPY.custom.looksLikeBody}</p>
            </div>
            <ul className="grid gap-2.5">
              {step.tiles.map(({ tile, actionId }) => (
                <li key={tile.id}>
                  <button
                    type="button"
                    onClick={() => onPickTile(tile, actionId, step.qty)}
                    className="flex min-h-16 w-full hard items-center gap-3 rounded-md border-3 border-ink bg-card px-3 py-2 text-left lift-3"
                  >
                    <Sticker category={tile.category} icon={tile.icon} size={44} rotate={-3} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-bold">{tile.title}</span>
                      <span className="mt-0.5 block type-slug text-ink-3">
                        {COPY.custom.logThat(tile.label)}
                      </span>
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
          <Panel variant="paper" className="grid place-items-center gap-3 py-8" role="status">
            <ColorBar loading label={COPY.custom.estimating} />
            <p className="text-body-sm font-semibold text-ink-2">{COPY.custom.estimating}</p>
            <p className="max-w-[32ch] text-center text-caption text-ink-3">“{description}”</p>
          </Panel>
        ) : null}

        {step.name === 'review' ? (
          <>
            <div className="flex items-center gap-4">
              <span ref={stickerRef} className="inline-block shrink-0">
                <Sticker category={draft.category} size={96} rotate={-4} />
              </span>
              <p role="status" className="min-w-0 text-body-sm text-ink-2">
                <Tag hue={step.origin === 'ai' ? 'blue' : 'white'} className="mr-2 align-middle">
                  {step.origin === 'ai' ? 'AI' : step.origin === 'local' ? 'Built-in' : 'By hand'}
                </Tag>
                {NOTICE[step.notice]}
              </p>
            </div>

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
              <div className="flex flex-wrap gap-x-1 gap-y-2">
                {CATEGORIES.map((category) => (
                  <Sticker
                    key={category.id}
                    category={category.id}
                    icon={CATEGORY_ICON[category.id]}
                    size={44}
                    rotate={0}
                    label={category.id === 'nature' ? 'Nature' : category.label}
                    selected={draft.category === category.id}
                    onClick={() => {
                      play('tick');
                      setDraft((current) => ({ ...current, category: category.id }));
                    }}
                    className="text-caption"
                  />
                ))}
              </div>
            </fieldset>

            <div className="grid gap-2">
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
              <p className="text-caption text-ink-3">
                {COPY.custom.effortHint[draft.effort - 1]} +{formatNumber(customXp(draft.effort))}{' '}
                XP.
              </p>
            </div>

            <div
              aria-live="polite"
              className="rounded-md border-3 border-ink bg-paper px-3.5 py-3"
              data-testid="custom-preview"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {kg !== null ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 type-figure text-display-sm">
                        <HonestyMark source={AI_SOURCE} className="self-center" />
                        <span className="sr-only">approximately </span>
                        <span className="underline decoration-dotted decoration-2 underline-offset-4">
                          {formatCo2Estimate(kg)}
                        </span>
                        <span className="font-sans text-body-sm font-semibold text-ink-2">
                          <Co2e explain />
                        </span>
                      </p>
                      <p className="mt-1 text-body-sm font-semibold">{COPY.custom.aiLabel}</p>
                      <p className="text-caption text-ink-3">{COPY.custom.aiNote}</p>
                    </>
                  ) : (
                    <p className="text-body font-semibold">{COPY.custom.notQuantified}</p>
                  )}
                  {step.rationale && step.origin === 'ai' ? (
                    <p className="mt-2 text-caption text-ink-2">“{step.rationale}”</p>
                  ) : null}
                </div>
                {xp > 0 ? (
                  <Tag hue="yellow">+{formatNumber(xp)} XP</Tag>
                ) : (
                  <Tag hue="white">{COPY.ledger.kgOnly}</Tag>
                )}
              </div>
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
              {today.customLeft === 0 ? (
                <p className="mt-2 border-t-[1.5px] border-dashed border-ink pt-2 text-body-sm font-semibold">
                  {COPY.custom.capReached}
                </p>
              ) : null}
            </div>

            <Checkbox
              checked={keep && !keepFull}
              onCheckedChange={setKeep}
              disabled={keepFull}
              label={COPY.custom.keep}
              description={keepFull ? COPY.custom.keepFull : COPY.custom.keepHint}
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}
