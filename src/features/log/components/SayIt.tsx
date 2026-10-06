'use client';

import { ArrowLeft, ArrowRight, MessageSquareText, Minus, Plus, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AiClient } from '@/ai';
import { ACTION_BY_ID } from '@/data/catalogue';
import {
  previewAction,
  selectToday,
  useGame,
  useGameState,
  useProfile,
  type LogActionInput,
  type LogPreview,
} from '@/game';
import { formatNumber } from '@/lib/format';
import { useOnlineStatus } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import {
  Button,
  Checkbox,
  Co2e,
  ColorBar,
  Field,
  HonestyMark,
  IconButton,
  Modal,
  Sticker,
  Tag,
  Textarea,
} from '@/ui';
import { COPY } from '../copy';
import { combinedEstimateSource, estimateParts, previewEstimateSource } from '../model/estimate';
import {
  SAY_IT_MAX_CHARS,
  proposeFromSentence,
  splitSentence,
  type SayItProposal,
} from '../model/sayIt';
import type { Tile, TileState } from '../model/tiles';
import { formatQty, snapQty, stepFor, type UnitSystem } from '../model/units';
import type { StickJob } from './QuickLogSheet';

type ActionProposal = Extract<SayItProposal, { kind: 'action' }>;

type Step =
  { name: 'write' } | { name: 'looking' } | { name: 'review'; proposals: readonly SayItProposal[] };

/** What the engine says each ticked proposal would do, with the same preview the sheet uses. */
function usePreviews(
  proposals: readonly SayItProposal[],
  amounts: Readonly<Record<string, number>>,
): ReadonlyMap<string, LogPreview> {
  const logs = useGameState((game) => game.logs);
  const profile = useGameState((game) => game.profile);
  const baseline = useGameState((game) => game.baseline);
  const settings = useGameState((game) => game.settings);
  const day = useGame(selectToday);
  return useMemo(() => {
    const previews = new Map<string, LogPreview>();
    for (const item of proposals) {
      if (item.kind !== 'action') continue;
      const qty = amounts[item.actionId] ?? item.qty;
      previews.set(
        item.actionId,
        previewAction(
          { logs, profile, baseline, settings },
          { actionId: item.actionId, qty, source: 'log' },
          day,
        ),
      );
    }
    return previews;
  }, [proposals, amounts, logs, profile, baseline, settings, day]);
}

function ProposalRow({
  item,
  qty,
  preview,
  units,
  checked,
  stickerRef,
  onChecked,
  onQty,
  onOpenSheet,
}: {
  item: ActionProposal;
  qty: number;
  preview: LogPreview | undefined;
  units: UnitSystem;
  checked: boolean;
  stickerRef?: (node: HTMLSpanElement | null) => void;
  onChecked: (checked: boolean) => void;
  onQty: (qty: number) => void;
  onOpenSheet: () => void;
}) {
  const action = ACTION_BY_ID.get(item.actionId);
  if (!action) return null;
  const step = stepFor(action);
  const most = preview ? Math.max(preview.remainingUnits, qty) : qty;
  const kg = preview?.kg && action.credit === 'log' ? preview.kg : null;
  const refused = preview && !preview.ok ? (preview.refusal?.message ?? null) : null;
  const amount = formatQty(qty, action.unit, units);
  const change = (next: number) => {
    play('tick');
    onQty(snapQty(Math.min(Math.max(next, step), most), action.decimals));
  };

  return (
    <li className="grid gap-2 rounded-md border-2 border-ink bg-card p-3">
      <div className="flex items-start gap-3">
        <span ref={stickerRef} className="mt-0.5 shrink-0">
          <Sticker category={item.tile.category} icon={item.tile.icon} size={44} />
        </span>
        <div className="min-w-0 flex-1">
          <Checkbox
            checked={checked && !refused}
            disabled={Boolean(refused)}
            onCheckedChange={onChecked}
            label={<span className="text-body font-bold text-ink">{action.title}</span>}
            description={
              <span className="text-caption text-ink-3">
                {COPY.sayIt.said(item.said)}
                {' · '}
                {item.sure
                  ? item.by === 'ai'
                    ? COPY.sayIt.byAi
                    : COPY.sayIt.byList
                  : COPY.sayIt.closest}
              </span>
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-0.5">
        <div className="flex items-center gap-1.5">
          <IconButton
            label={COPY.sayIt.less(action.title)}
            icon={Minus}
            size="sm"
            tooltipSide={null}
            disabled={qty <= step}
            onClick={() => change(qty - step)}
          />
          <button
            type="button"
            onClick={onOpenSheet}
            aria-label={COPY.sayIt.openSheet(action.title)}
            className="min-h-11 min-w-16 cursor-pointer rounded-sm px-1.5 font-mono text-data-lg text-ink underline decoration-ink-4 decoration-dotted decoration-2 underline-offset-4 fine:hover:bg-yellow-tint"
          >
            {amount}
          </button>
          <IconButton
            label={COPY.sayIt.more(action.title)}
            icon={Plus}
            size="sm"
            tooltipSide={null}
            disabled={qty >= most}
            onClick={() => change(qty + step)}
          />
        </div>

        <p
          aria-live="polite"
          className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-body-sm font-semibold text-ink"
        >
          {refused ? (
            <span className="text-ink-2">{refused}</span>
          ) : kg ? (
            <>
              <HonestyMark source={previewEstimateSource(action, qty, kg, units)} size="sm" />
              <span>
                <span className="sr-only">approximately </span>
                {estimateParts(kg.kg).value} {estimateParts(kg.kg).unit}{' '}
                <span className="text-ink-2">
                  <Co2e /> {COPY.quick.avoided}
                </span>
              </span>
            </>
          ) : (
            <span className="text-ink-2">{COPY.sayIt.notQuantified}</span>
          )}
          {refused ? null : preview && preview.xp > 0 ? (
            <Tag hue="yellow">+{formatNumber(preview.xp)} XP</Tag>
          ) : (
            <Tag hue="white">{COPY.ledger.kgOnly}</Tag>
          )}
        </p>
      </div>
    </li>
  );
}

export interface SayItProps {
  tiles: readonly TileState[];
  /** Sticks the confirmed actions on, with the page's own flying sticker. */
  onStick: (job: StickJob) => void;
  /** Hands a part the catalogue does not know to the custom-action flow. */
  onCustom: (text: string) => void;
  /** Opens the full Quick Log sheet for one proposal: variants, context, a typed amount. */
  onOpenTile: (tile: Tile, options: { actionId: string; qty: number }) => void;
  /** Test seam for the AI client. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

/**
 * The plain-sentence way in. A button on the page opens a sheet: say what you did, see what
 * that sounds like as catalogue actions with their honest estimates, tick, adjust and stick.
 * Nothing is logged before that last tap.
 */
export function SayIt({ tiles, onStick, onCustom, onOpenTile, client }: SayItProps) {
  const profile = useProfile();
  const online = useOnlineStatus();
  const formId = useId();
  const request = useRef<AbortController | null>(null);
  const firstSticker = useRef<HTMLSpanElement | null>(null);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState<Step>({ name: 'write' });
  const [off, setOff] = useState<Readonly<Record<string, boolean>>>({});
  const [amounts, setAmounts] = useState<Readonly<Record<string, number>>>({});

  useEffect(() => () => request.current?.abort(), []);

  // Each step replaces what had focus (the field, then the loader). Focus goes to the step's
  // own heading, so a keyboard or screen-reader user lands on what just appeared.
  const stepHeading = useRef<HTMLHeadingElement | null>(null);
  const stepName = step.name;
  useEffect(() => {
    if (stepName !== 'write') stepHeading.current?.focus();
  }, [stepName]);

  const proposals = step.name === 'review' ? step.proposals : NO_PROPOSALS;
  const previews = usePreviews(proposals, amounts);
  const actions = proposals.filter((item): item is ActionProposal => item.kind === 'action');
  const isTicked = (item: ActionProposal) =>
    !(off[item.actionId] ?? !item.sure) && previews.get(item.actionId)?.ok !== false;
  const ticked = actions.filter(isTicked);
  const tooShort = splitSentence(text).length === 0;

  const reset = () => {
    request.current?.abort();
    setStep({ name: 'write' });
    setOff({});
    setAmounts({});
    setTouched(false);
  };

  const change = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Closed: the next opening starts clean, but only after the sheet has slid away.
      request.current?.abort();
      window.setTimeout(() => {
        reset();
        setText('');
      }, 300);
    }
  };

  const find = async (sentence: string) => {
    setTouched(true);
    if (splitSentence(sentence).length === 0) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStep({ name: 'looking' });
    try {
      const found = await proposeFromSentence(sentence, tiles, {
        region: profile.region,
        units: profile.units,
        online,
        signal: controller.signal,
        client,
      });
      if (!controller.signal.aborted) setStep({ name: 'review', proposals: found });
    } catch {
      // Only an abort reaches here: the sheet was closed or the person went back.
    }
  };

  const stick = () => {
    const first = ticked[0];
    if (!first) return;
    const logs: LogActionInput[] = ticked.map((item) => ({
      actionId: item.actionId,
      qty: amounts[item.actionId] ?? item.qty,
      source: 'log',
    }));
    onStick({ tile: first.tile, origin: firstSticker.current, logs });
    change(false);
  };

  // The slip for everything ticked: one figure, with every part of its sum behind the mark.
  const parts = ticked.flatMap((item) => {
    const action = ACTION_BY_ID.get(item.actionId);
    const estimate = previews.get(item.actionId)?.kg;
    return action && estimate && action.credit === 'log'
      ? [{ action, qty: amounts[item.actionId] ?? item.qty, estimate }]
      : [];
  });
  const totalSource = parts.length > 1 ? combinedEstimateSource(parts, profile.units) : null;
  const total = totalSource
    ? {
        source: totalSource,
        ...estimateParts(parts.reduce((sum, part) => sum + part.estimate.kg, 0)),
      }
    : null;

  const footer =
    step.name === 'write' ? (
      <Button type="submit" form={formId} variant="primary" size="lg" fullWidth icon={Search}>
        {COPY.sayIt.find}
      </Button>
    ) : step.name === 'review' ? (
      <>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={reset}>
          {COPY.sayIt.back}
        </Button>
        {actions.length > 0 ? (
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="lg"
            fullWidth
            disabledReason={ticked.length === 0 ? COPY.sayIt.pickOne : undefined}
          >
            {COPY.sayIt.stick(Math.max(ticked.length, 1))}
          </Button>
        ) : null}
      </>
    ) : (
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={reset}>
        {COPY.sayIt.back}
      </Button>
    );

  return (
    <>
      <button
        type="button"
        data-tour="say-it"
        onClick={() => change(true)}
        aria-haspopup="dialog"
        className="mb-2 flex min-h-14 w-full hard cursor-pointer items-center gap-3 rounded-md border-3 border-ink bg-paper px-3.5 py-2 text-left lift-3"
      >
        <MessageSquareText size={22} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-label text-ink">{COPY.sayIt.entry}</span>
          <span className="block truncate text-body-sm text-ink-3">
            {COPY.sayIt.said(COPY.sayIt.example)}
          </span>
        </span>
        <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
      </button>

      <Modal open={open} onOpenChange={change} title={COPY.sayIt.title} size="md" footer={footer}>
        <form
          id={formId}
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (step.name === 'write') void find(text);
            else if (step.name === 'review') stick();
          }}
        >
          {step.name === 'write' ? (
            <>
              <Field
                label={COPY.sayIt.label}
                hint={COPY.sayIt.hint}
                error={touched && tooShort ? COPY.sayIt.tooShort : undefined}
              >
                <Textarea
                  // The sheet exists to be typed into: the caret starts in the field.
                  autoFocus
                  value={text}
                  rows={2}
                  maxLength={SAY_IT_MAX_CHARS}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder={COPY.sayIt.example}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends, as in a search field; Shift+Enter is still a new line.
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void find(text);
                    }
                  }}
                />
              </Field>
              <div>
                <p className="type-slug text-ink-3">{COPY.sayIt.examplesLabel}</p>
                <ul className="mt-2 grid gap-2">
                  {COPY.sayIt.examples.map((example) => (
                    <li key={example}>
                      <button
                        type="button"
                        onClick={() => {
                          setText(example);
                          void find(example);
                        }}
                        className="min-h-11 w-full cursor-pointer rounded-sm border-2 border-dashed border-ink-4 bg-card px-3 py-2 text-left text-body-sm font-medium text-ink fine:hover:border-ink fine:hover:bg-yellow-tint"
                      >
                        {COPY.sayIt.said(example)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-caption text-ink-3">{COPY.sayIt.privacy}</p>
            </>
          ) : null}

          {step.name === 'looking' ? (
            <div className="grid place-items-center gap-3 py-8" aria-busy="true">
              <ColorBar loading size="md" label={COPY.sayIt.looking} />
              <h3 ref={stepHeading} tabIndex={-1} className="text-body-sm text-ink-2">
                {COPY.sayIt.looking}
              </h3>
            </div>
          ) : null}

          {step.name === 'review' ? (
            <div className="grid gap-3">
              <div>
                <h3 ref={stepHeading} tabIndex={-1} className="text-h4">
                  {actions.length > 0 ? COPY.sayIt.heard : COPY.sayIt.nothing}
                </h3>
                <p className="mt-1 text-body-sm text-ink-2">
                  {actions.length > 0 ? COPY.sayIt.heardBody : COPY.sayIt.nothingBody}
                </p>
              </div>
              <ul className="grid gap-2.5">
                {proposals.map((item) =>
                  item.kind === 'action' ? (
                    <ProposalRow
                      key={item.actionId}
                      item={item}
                      qty={amounts[item.actionId] ?? item.qty}
                      preview={previews.get(item.actionId)}
                      units={profile.units}
                      checked={isTicked(item)}
                      stickerRef={
                        item === ticked[0]
                          ? (node) => {
                              firstSticker.current = node;
                            }
                          : undefined
                      }
                      onChecked={(checked) =>
                        setOff((current) => ({ ...current, [item.actionId]: !checked }))
                      }
                      onQty={(qty) =>
                        setAmounts((current) => ({ ...current, [item.actionId]: qty }))
                      }
                      onOpenSheet={() => {
                        change(false);
                        onOpenTile(item.tile, {
                          actionId: item.actionId,
                          qty: amounts[item.actionId] ?? item.qty,
                        });
                      }}
                    />
                  ) : (
                    <li
                      key={`unknown:${item.said}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border-2 border-dashed border-ink-4 px-3 py-2"
                    >
                      <p className="min-w-0 text-body-sm text-ink-2">
                        <span className="font-semibold text-ink">{COPY.sayIt.said(item.said)}</span>{' '}
                        {COPY.sayIt.unknown}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          change(false);
                          onCustom(item.said);
                        }}
                      >
                        {COPY.sayIt.custom}
                      </Button>
                    </li>
                  ),
                )}
              </ul>
              {total ? (
                <p className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 border-t-2 border-dashed border-ink-4 pt-3 text-body font-bold text-ink">
                  <span className="mr-auto type-slug text-ink-3">{COPY.sayIt.total}</span>
                  <HonestyMark source={total.source} size="sm" />
                  <span>
                    <span className="sr-only">approximately </span>
                    {total.value} {total.unit}{' '}
                    <span className="text-body-sm font-semibold text-ink-2">
                      <Co2e /> {COPY.quick.avoided}
                    </span>
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>
    </>
  );
}

const NO_PROPOSALS: readonly SayItProposal[] = [];
