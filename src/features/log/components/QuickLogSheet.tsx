'use client';

import { ArrowRight, EyeOff, Minus, Plus } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { GROUP_BY_ID, type ActionDef } from '@/data/catalogue';
import {
  CARPOOL_PEOPLE,
  COMMUTE_MAX_KM,
  COMMUTE_PRESETS_KM,
  DEFAULT_CARPOOL_PEOPLE,
  DEFAULT_COMMUTE_KM,
  contextKgPerUnit,
  decodeVariant,
  gameActions,
  getGameState,
  isHeatAction,
  ledYearlyKgPerBulb,
  previewAction,
  useActionStates,
  useGameState,
  useProfile,
  useToday,
  type ActionState,
  type HeatSource,
  type LogActionInput,
  type LogInputs,
  type LogPreview,
  type LogSource,
} from '@/game';
import { cn } from '@/lib/cn';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { roundTo } from '@/lib/math';
import { play } from '@/lib/sfx';
import {
  Approx,
  Button,
  Co2e,
  Field,
  HonestyMark,
  IconButton,
  Input,
  Modal,
  Panel,
  Segmented,
  Select,
  Sticker,
  Switch,
  Tag,
  TextLink,
  type EstimateSource,
} from '@/ui';
import { COPY, EXTRA_NOTES, HEAT_OPTIONS, MATERIAL_LABEL, TAP_LITRES_PER_DAY } from '../copy';
import {
  combinedEstimateSource,
  estimateParts,
  methodologyHref,
  previewEstimateSource,
  type EstimatePart,
} from '../model/estimate';
import type { Tile } from '../model/tiles';
import {
  formatQty,
  hasQuantityChoice,
  parseQty,
  snapQty,
  stepFor,
  toDisplayQty,
  toStoredQty,
  unitSuffix,
  type UnitSystem,
} from '../model/units';
import { QuantityPicker } from './QuantityPicker';

export interface QuickLogRequest {
  tile: Tile;
  /** The member to start on, when a link named one. */
  actionId: string | null;
  /** A quantity to prefill, in stored units. */
  qty: number | null;
  source: LogSource;
  /** Distinguishes two openings of the same tile, so each starts fresh. */
  nonce: number;
}

export interface StickJob {
  tile: Tile;
  /** The sticker the flying clone lifts off from. */
  origin: Element | null;
  logs: LogActionInput[];
}

export interface QuickLogSheetProps {
  request: QuickLogRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStick: (job: StickJob) => void;
  onNotForMe: (tile: Tile) => void;
}

/**
 * Quick Log: a bottom sheet on phones, a modal from `md` up. Shows the action's sticker, the
 * amount, whatever else its estimate needs, and the honest preview before anything is saved.
 */
export function QuickLogSheet({
  request,
  open,
  onOpenChange,
  onStick,
  onNotForMe,
}: QuickLogSheetProps) {
  if (!request) return null;
  const key = `${request.tile.id}:${request.nonce}`;
  const shared = { request, open, onOpenChange, onStick, onNotForMe };
  return request.tile.kind === 'recycling' ? (
    <RecyclingDialog key={key} {...shared} />
  ) : (
    <ActionDialog key={key} {...shared} />
  );
}

type DialogProps = Omit<QuickLogSheetProps, 'request'> & { request: QuickLogRequest };

function useMembers(tile: Tile): ActionState[] {
  const states = useActionStates();
  return useMemo(() => {
    const all = tile.actionIds
      .map((actionId) => states.find((state) => state.action.id === actionId))
      .filter((state): state is ActionState => state !== undefined);
    const visible = all.filter((state) => !state.hidden);
    return visible.length > 0 ? visible : all;
  }, [states, tile]);
}

/** The amount the sheet opens on: the link's, else the last one used, kept within today's room. */
function startingQty(state: ActionState, requested: number | null): number {
  const { action } = state;
  if (requested !== null) return roundTo(requested, action.decimals);
  const usual = state.quickQty > 0 ? state.quickQty : action.defaultQty;
  return state.unitsLeft > 0 ? Math.min(usual, state.unitsLeft) : usual;
}

/** What the sheet asked last time for this action (people in the car, the commute, the variant). */
function lastInputs(actionId: string): LogInputs {
  const { logs } = getGameState();
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const log = logs[index];
    if (log?.actionId === actionId) return decodeVariant(actionId, log.variant);
  }
  return {};
}

interface FrameProps {
  tile: Tile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotForMe: (tile: Tile) => void;
  formId: string;
  onSubmit: () => void;
  stickerRef: RefObject<HTMLSpanElement | null>;
  /** Why "Stick it on" is unavailable; the button stays focusable and says so. */
  blockedReason?: string;
  /** Under the title: what the estimate is compared with. */
  lead?: string;
  children: ReactNode;
}

function SheetFrame({
  tile,
  open,
  onOpenChange,
  onNotForMe,
  formId,
  onSubmit,
  stickerRef,
  blockedReason,
  lead,
  children,
}: FrameProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={tile.title}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => onNotForMe(tile)}>
            {COPY.notForMe.button}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="lg"
            fullWidth
            disabledReason={blockedReason}
          >
            {COPY.quick.stick}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-center gap-4">
          <span ref={stickerRef} className="inline-block shrink-0">
            <Sticker category={tile.category} icon={tile.icon} size={96} rotate={-4} />
          </span>
          <div className="min-w-0">
            <Tag category={tile.category} />
            {lead ? <p className="mt-2 text-body-sm text-ink-2">{lead}</p> : null}
          </div>
        </div>
        {children}
      </form>
    </Modal>
  );
}

function Notes({ notes }: { notes: readonly ReactNode[] }) {
  if (notes.length === 0) return null;
  return (
    <Panel variant="well" as="ul" className="grid gap-1.5 text-body-sm text-ink-2">
      {notes.map((note, index) => (
        <li key={index}>{note}</li>
      ))}
    </Panel>
  );
}

interface PreviewRowProps {
  /** `null`: the action carries no creditable figure. */
  kg: number | null;
  source: EstimateSource | null;
  versus: string | null;
  xp: number;
  maxed: boolean;
  /** Replaces "Impact not quantified" for figures shown as context only. */
  unquantified?: string;
  /** A second headline above the kilograms (litres of water for the tap). */
  headline?: ReactNode;
}

/** The honest preview: the mark, the figure, what it is compared with, and the XP. */
function PreviewRow({ kg, source, versus, xp, maxed, unquantified, headline }: PreviewRowProps) {
  const parts = kg === null ? null : estimateParts(kg);
  return (
    <div
      aria-live="polite"
      className="rounded-md border-3 border-ink bg-paper px-3.5 py-3 text-ink"
      data-testid="log-preview"
    >
      {headline}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {parts && source ? (
            <>
              <p
                className={cn(
                  'flex flex-wrap items-baseline gap-x-1.5 gap-y-1',
                  headline ? 'text-body-sm font-semibold' : 'type-figure text-display-sm',
                )}
              >
                <HonestyMark
                  source={source}
                  size={headline ? 'sm' : 'md'}
                  className="self-center"
                />
                <span className="sr-only">approximately </span>
                <span>
                  {parts.value}
                  <span className={cn(!headline && 'ml-1 font-sans text-body font-bold')}>
                    {' '}
                    {parts.unit}
                  </span>
                </span>
                <span className="font-sans text-body-sm font-semibold text-ink-2">
                  <Co2e explain /> {COPY.quick.avoided}
                </span>
              </p>
              {versus ? <p className="mt-1 text-body-sm text-ink-2">{versus}</p> : null}
            </>
          ) : (
            <p className="text-body font-semibold">{unquantified ?? COPY.quick.notQuantified}</p>
          )}
        </div>
        {xp > 0 ? (
          <Tag hue="yellow">+{formatNumber(xp)} XP</Tag>
        ) : (
          <Tag hue="white">{COPY.ledger.kgOnly}</Tag>
        )}
      </div>
      {maxed ? (
        <p className="mt-2 border-t-[1.5px] border-dashed border-ink pt-2 text-body-sm font-semibold">
          {COPY.quick.maxed}
        </p>
      ) : null}
    </div>
  );
}

function refusalText(
  preview: LogPreview,
  qty: number | null,
  system: UnitSystem,
  action: ActionDef,
) {
  if (qty === null) return COPY.quick.invalid;
  const refusal = preview.refusal;
  if (!refusal) return undefined;
  if (refusal.reason === 'over-cap' && preview.remainingUnits > 0) {
    return `${COPY.quick.overCap} ${COPY.quick.capLeft(
      formatQty(preview.remainingUnits, action.unit, system),
    )}`;
  }
  return refusal.message;
}

/** Commute presets in the person's units, stored as kilometres. */
function commuteOptions(system: UnitSystem) {
  return COMMUTE_PRESETS_KM.map((preset) => {
    const km = toStoredQty(preset, 'km', system, 1);
    return { value: String(preset), label: formatQty(km, 'km', system), km };
  });
}

function CommuteField({
  km,
  onChange,
  system,
}: {
  km: number;
  onChange: (km: number) => void;
  system: UnitSystem;
}) {
  const options = commuteOptions(system);
  const matched = options.find((option) => Math.abs(option.km - km) < 1e-6);
  const [other, setOther] = useState(matched === undefined);
  const [text, setText] = useState(() => String(toDisplayQty(km, 'km', system)));
  const typed = parseQty(text);
  const typedKm = typed === null ? null : toStoredQty(typed, 'km', system, 1);
  const invalid = other && (typedKm === null || typedKm > COMMUTE_MAX_KM);
  return (
    <div className="grid gap-2.5">
      <p className="text-label text-ink">{COPY.quick.commute}</p>
      <Segmented
        aria-label={COPY.quick.commute}
        fullWidth
        value={other ? 'other' : (matched?.value ?? 'other')}
        onValueChange={(value) => {
          play('tick');
          if (value === 'other') {
            setOther(true);
            return;
          }
          const option = options.find((candidate) => candidate.value === value);
          if (!option) return;
          setOther(false);
          setText(String(toDisplayQty(option.km, 'km', system)));
          onChange(option.km);
        }}
        options={[
          ...options.map(({ value, label }) => ({ value, label })),
          { value: 'other', label: COPY.quick.commuteCustom },
        ]}
      />
      {other ? (
        <Field label={COPY.quick.amountLabel} error={invalid ? COPY.quick.commuteError : undefined}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={text}
            suffix={unitSuffix('km', system)}
            inputClassName="font-mono text-data-lg"
            onChange={(event) => {
              setText(event.target.value);
              const shown = parseQty(event.target.value);
              if (shown === null) return;
              const next = toStoredQty(shown, 'km', system, 1);
              if (next <= COMMUTE_MAX_KM) onChange(next);
            }}
          />
        </Field>
      ) : null}
    </div>
  );
}

function ActionDialog({ request, open, onOpenChange, onStick, onNotForMe }: DialogProps) {
  const { tile } = request;
  const members = useMembers(tile);
  const game = useGameState((state) => state);
  const today = useToday();
  const profile = useProfile();
  const system: UnitSystem = profile.units;
  const formId = useId();
  const stickerRef = useRef<HTMLSpanElement | null>(null);

  const [memberId, setMemberId] = useState<string>(() => {
    const named = members.find((state) => state.action.id === request.actionId);
    const usual = [...members].sort((a, b) => b.recentLogs - a.recentLogs)[0];
    return (named ?? usual ?? members[0])?.action.id ?? tile.actionIds[0] ?? '';
  });
  const state = members.find((member) => member.action.id === memberId) ?? members[0];
  const [qty, setQty] = useState<number | null>(() =>
    state ? startingQty(state, request.qty) : null,
  );
  const [inputs, setInputs] = useState<LogInputs>(() => lastInputs(memberId));
  /** The heat question stays on screen for this sheet once it has been shown. */
  const [askHeat] = useState(() => profile.heat === 'unknown');

  const preview = useMemo(
    () => previewAction(game, { actionId: memberId, qty: qty ?? 0, inputs }, today.day),
    [game, memberId, qty, inputs, today.day],
  );

  if (!state) return null;
  const { action } = state;

  const switchMember = (nextId: string) => {
    const next = members.find((member) => member.action.id === nextId);
    if (!next || nextId === memberId) return;
    play('tick');
    setMemberId(nextId);
    setQty(startingQty(next, null));
    setInputs(lastInputs(nextId));
  };

  const blocked = state.blocked;
  const error = blocked ? undefined : refusalText(preview, qty, system, action);
  const source =
    preview.kg && qty !== null ? previewEstimateSource(action, qty, preview.kg, system) : null;
  const group = action.group ? GROUP_BY_ID.get(action.group) : undefined;
  const contextKg = contextKgPerUnit(action);
  const low = action.confidence === 'low';

  const notes: ReactNode[] = [];
  if (contextKg !== null && action.factor) {
    notes.push(
      <>
        A young tree that survives takes up <Approx spoken />
        {formatCo2Estimate(contextKg)} of CO<sub>2</sub> a year (
        {formatCo2Estimate(action.factor.low)} to {formatCo2Estimate(action.factor.high)}).
      </>,
    );
  }
  if (action.sheetNote) notes.push(action.sheetNote);
  const extra = EXTRA_NOTES[action.id as keyof typeof EXTRA_NOTES];
  if (extra) notes.push(extra);
  else if (action.perHousehold) notes.push(COPY.quick.household);
  if (action.id === 'led-bulb-swap') {
    notes.push(
      <>
        Each bulb keeps avoiding <Approx spoken />
        {formatCo2Estimate(ledYearlyKgPerBulb(profile.region))} a year while it replaces an old
        incandescent. That is context, not added to any total.
      </>,
    );
  }
  if (group?.hint) notes.push(group.hint);
  if (preview.kg && low) {
    notes.push(
      COPY.quick.likely(formatCo2Estimate(preview.kg.low), formatCo2Estimate(preview.kg.high)),
    );
  }

  const stick = () => {
    if (!preview.ok || qty === null) return;
    onStick({
      tile,
      origin: stickerRef.current,
      logs: [{ actionId: memberId, qty, source: request.source, inputs }],
    });
  };

  const headline =
    action.id === 'tap-off-while-brushing' ? (
      <p className="mb-2 type-figure text-display-sm">
        <Approx />
        {formatNumber(TAP_LITRES_PER_DAY)}
        <span className="ml-1.5 font-sans text-body font-bold">litres of water</span>
      </p>
    ) : undefined;

  return (
    <SheetFrame
      tile={tile}
      open={open}
      onOpenChange={onOpenChange}
      onNotForMe={onNotForMe}
      formId={formId}
      onSubmit={stick}
      stickerRef={stickerRef}
      blockedReason={blocked?.message ?? error}
      lead={tile.kind === 'single' ? undefined : action.title}
    >
      {tile.kind === 'secondhand' && members.length > 1 ? (
        <div className="grid gap-2">
          <p className="text-label text-ink">{COPY.quick.secondhand}</p>
          <Segmented
            aria-label={COPY.quick.secondhand}
            fullWidth
            value={memberId}
            onValueChange={switchMember}
            options={[
              { value: 'second-hand-tshirt', label: COPY.quick.secondhandTop },
              { value: 'second-hand-jeans', label: COPY.quick.secondhandJeans },
            ]}
          />
        </div>
      ) : null}

      {tile.kind === 'flight-swap' && members.length > 1 ? (
        <Switch
          label={COPY.quick.flightUnknown}
          description={COPY.quick.flightUnknownHint}
          checked={memberId === 'train-instead-of-short-flight-trip'}
          onCheckedChange={(unknown) =>
            switchMember(
              unknown ? 'train-instead-of-short-flight-trip' : 'train-instead-of-short-flight-km',
            )
          }
        />
      ) : null}

      {blocked ? (
        <Panel variant="well" className="text-body font-semibold text-ink" role="status">
          {blocked.message}
        </Panel>
      ) : (
        <>
          {hasQuantityChoice(action) ? (
            <QuantityPicker
              key={memberId}
              action={action}
              system={system}
              qty={qty}
              onChange={setQty}
              unitsLeft={state.unitsLeft}
              label={COPY.quick.amount}
              error={error}
            />
          ) : (
            <p className="type-slug text-ink-3">
              {COPY.quick.once(formatQty(action.defaultQty, action.unit, system))}
            </p>
          )}

          {action.id === 'carpool' ? (
            <div className="grid gap-2">
              <p className="text-label text-ink">{COPY.quick.people}</p>
              <Segmented
                aria-label={COPY.quick.people}
                fullWidth
                value={String(inputs.people ?? DEFAULT_CARPOOL_PEOPLE)}
                onValueChange={(value) => {
                  play('tick');
                  setInputs((current) => ({ ...current, people: Number(value) }));
                }}
                options={CARPOOL_PEOPLE.map((count) => ({
                  value: String(count),
                  label: formatNumber(count),
                }))}
              />
            </div>
          ) : null}

          {action.id === 'work-from-home-day' ? (
            <>
              <CommuteField
                km={inputs.commuteKm ?? DEFAULT_COMMUTE_KM}
                system={system}
                onChange={(km) => setInputs((current) => ({ ...current, commuteKm: km }))}
              />
              <Switch
                label={COPY.quick.heatingOn}
                description={COPY.quick.heatingOnHint}
                checked={inputs.heatingOn !== false}
                onCheckedChange={(on) => setInputs((current) => ({ ...current, heatingOn: on }))}
              />
            </>
          ) : null}

          {action.variants.length > 0 ? (
            <Field label={COPY.quick.variant}>
              <Select
                value={inputs.variant ?? action.defaultVariant ?? undefined}
                onValueChange={(variant) => setInputs((current) => ({ ...current, variant }))}
                options={action.variants.map((variant) => ({
                  value: variant.id,
                  label: variant.label,
                }))}
              />
            </Field>
          ) : null}

          {isHeatAction(action) && askHeat ? (
            <Field label={COPY.quick.heat} hint={COPY.quick.heatHint}>
              <Select
                value={profile.heat}
                onValueChange={(heat) => gameActions.updateProfile({ heat: heat as HeatSource })}
                options={HEAT_OPTIONS.map((option) => ({ ...option }))}
              />
            </Field>
          ) : null}

          <PreviewRow
            kg={preview.kg ? preview.kg.kg : null}
            source={source}
            versus={COPY.quick.versus(action.counterfactual)}
            xp={preview.xp}
            maxed={preview.maxed}
            headline={headline}
            unquantified={
              action.credit === 'context'
                ? 'Shown as context, never added to your total. XP for showing up.'
                : undefined
            }
          />

          {preview.kg && preview.kg.kg === 0 && action.id === 'work-from-home-day' ? (
            <p role="status" className="text-body-sm font-semibold text-ink">
              {COPY.quick.zeroCommute}
            </p>
          ) : null}

          {low && preview.kg ? (
            <p>
              <Tag hue="white">{COPY.quick.rough}</Tag>
            </p>
          ) : null}
        </>
      )}

      <Notes notes={notes} />

      {action.factor ? (
        <p>
          <TextLink
            href={methodologyHref(action.id)}
            className="inline-flex min-h-11 items-center gap-1 text-body-sm"
          >
            {COPY.quick.how}
            <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
          </TextLink>
        </p>
      ) : null}
    </SheetFrame>
  );
}

function MaterialRow({
  state,
  shown,
  onChange,
  system,
}: {
  state: ActionState;
  /** The count in the person's units. */
  shown: number;
  onChange: (shown: number) => void;
  system: UnitSystem;
}) {
  const { action } = state;
  const step = stepFor(action);
  const max = toDisplayQty(state.unitsLeft, action.unit, system);
  const set = (next: number) =>
    onChange(snapQty(Math.min(max, Math.max(0, next)), action.decimals));
  const label = MATERIAL_LABEL[action.id] ?? action.title;
  const full = shown >= max - 1e-9;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold">{label}</p>
        <p className="mt-0.5 type-slug text-ink-3">
          {state.kgPerUnit === null ? (
            COPY.ledger.notQuantified
          ) : (
            <>
              <Approx weight="mono" />
              {formatCo2Estimate(state.kgPerUnit)} per {action.unit === 'kg' ? 'kg' : 'item'}
            </>
          )}
          {max <= 0 ? ` · ${COPY.sheet.done}` : null}
        </p>
      </div>
      <IconButton
        label={`${COPY.quick.less}: ${label}`}
        icon={Minus}
        size="sm"
        shape="square"
        tooltipSide={null}
        disabled={shown <= 0}
        onClick={() => {
          play('tick', { rate: 0.9 });
          set(shown - step);
        }}
      />
      <output
        aria-label={`${label}: ${formatQty(shown, action.unit, system)}`}
        className="w-14 text-center font-mono text-data-lg"
      >
        {formatNumber(shown) === String(shown) ? shown : shown.toFixed(1)}
        <span className="block type-tick text-ink-3">{unitSuffix(action.unit, system)}</span>
      </output>
      <IconButton
        label={`${COPY.quick.more}: ${label}`}
        icon={Plus}
        size="sm"
        shape="square"
        tooltipSide={null}
        disabled={full}
        onClick={() => {
          play('tick', { rate: 1.1 });
          set(shown + step);
        }}
      />
    </li>
  );
}

function RecyclingDialog({ request, open, onOpenChange, onStick, onNotForMe }: DialogProps) {
  const { tile } = request;
  const members = useMembers(tile);
  const game = useGameState((state) => state);
  const today = useToday();
  const system: UnitSystem = useProfile().units;
  const formId = useId();
  const stickerRef = useRef<HTMLSpanElement | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const named = members.find((state) => state.action.id === request.actionId);
    if (!named) return {};
    return { [named.action.id]: startingQty(named, request.qty) };
  });

  const used = members
    .map((state) => ({ state, qty: counts[state.action.id] ?? 0 }))
    .filter((entry) => entry.qty > 0);

  const parts: EstimatePart[] = [];
  let kg = 0;
  let xp = 0;
  // Acts are shared by the group: the first materials saved take what is left of them.
  let room = Math.min(...members.map((state) => state.actsLeft), Number.POSITIVE_INFINITY);
  let xpRoom = today.logXpLeft;
  let refusal: string | undefined;
  for (const { state, qty } of used) {
    const preview = previewAction(game, { actionId: state.action.id, qty }, today.day);
    if (!preview.ok && !refusal) refusal = preview.refusal?.message;
    if (preview.kg) {
      kg += preview.kg.kg;
      parts.push({ action: state.action, qty, estimate: preview.kg });
    }
    if (room > 0 && state.actsLeft > 0) {
      const earned = Math.min(state.action.xp, xpRoom);
      xp += earned;
      xpRoom -= earned;
      room -= 1;
    }
  }
  const allBlocked = members.every((state) => state.blocked !== null);
  const group = GROUP_BY_ID.get('recycling');
  const blockedReason = allBlocked
    ? (members[0]?.blocked?.message ?? COPY.quick.overCap)
    : used.length === 0
      ? COPY.quick.recyclingNothing
      : refusal;

  const stick = () => {
    if (blockedReason) return;
    onStick({
      tile,
      origin: stickerRef.current,
      logs: used.map(({ state, qty }) => ({
        actionId: state.action.id,
        qty: toStoredQty(qty, state.action.unit, system, state.action.decimals),
        source: request.source,
      })),
    });
  };

  return (
    <SheetFrame
      tile={tile}
      open={open}
      onOpenChange={onOpenChange}
      onNotForMe={onNotForMe}
      formId={formId}
      onSubmit={stick}
      stickerRef={stickerRef}
      blockedReason={blockedReason}
      lead={COPY.quick.recyclingLead}
    >
      <ul className="divide-y-[1.5px] divide-ink border-y-[1.5px] border-ink">
        {members.map((state) => (
          <MaterialRow
            key={state.action.id}
            state={state}
            system={system}
            shown={counts[state.action.id] ?? 0}
            onChange={(next) => setCounts((current) => ({ ...current, [state.action.id]: next }))}
          />
        ))}
      </ul>
      <PreviewRow
        kg={parts.length > 0 ? kg : used.length > 0 ? null : 0}
        source={
          combinedEstimateSource(parts, system) ?? {
            code: 'WASTE',
            kind: 'factor',
            formula: COPY.quick.recyclingNothing,
            comparedWith: 'Compared with landfill, and new material made from scratch.',
            sourceLabel: 'Our factor table',
            href: methodologyHref(members[0]?.action.id ?? ''),
          }
        }
        versus={COPY.quick.versus('landfill, and new material made from scratch')}
        xp={xp}
        maxed={used.length > 0 && xp === 0}
      />
      <Notes notes={[COPY.quick.recyclingRewarded, ...(group?.hint ? [group.hint] : [])]} />
      <p>
        <TextLink
          href={methodologyHref(members[0]?.action.id ?? '')}
          className="inline-flex min-h-11 items-center gap-1 text-body-sm"
        >
          {COPY.quick.how}
          <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
        </TextLink>
      </p>
    </SheetFrame>
  );
}
