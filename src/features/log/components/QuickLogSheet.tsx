'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
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
import { formatCo2Estimate, formatDecimal, formatNumber } from '@/lib/format';
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
  Segmented,
  Select,
  Switch,
  type EstimateSource,
} from '@/ui';
import { COPY, EXTRA_NOTES, HEAT_OPTIONS, MATERIAL_LABEL, TAP_LITRES_PER_DAY } from '../copy';
import {
  combinedEstimateSource,
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

export interface LogJob {
  tile: Tile;
  logs: LogActionInput[];
}

export interface QuickLogSheetProps {
  request: QuickLogRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLog: (job: LogJob) => void;
  /** "Hide this action": the tile leaves the list. */
  onHide: (tile: Tile) => void;
}

/**
 * The log sheet: a bottom sheet on phones, a dialog from `md` up. It names the action, asks
 * how much, shows the honest estimate before anything is saved, and has one button.
 */
export function QuickLogSheet({ request, open, onOpenChange, onLog, onHide }: QuickLogSheetProps) {
  if (!request) return null;
  const key = `${request.tile.id}:${request.nonce}`;
  const shared = { request, open, onOpenChange, onLog, onHide };
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
  onHide: (tile: Tile) => void;
  formId: string;
  onSubmit: () => void;
  /** Why "Log it" is unavailable; the button stays focusable and says so. */
  blockedReason?: string;
  /** Under the title: the action as a full sentence. */
  lead: string;
  children: ReactNode;
}

function SheetFrame({
  tile,
  open,
  onOpenChange,
  onHide,
  formId,
  onSubmit,
  blockedReason,
  lead,
  children,
}: FrameProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={tile.label}
      description={lead}
      size="sm"
      footer={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          size="lg"
          fullWidth
          disabledReason={blockedReason}
        >
          {COPY.quick.log}
        </Button>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid grid-cols-1 gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <p className="-my-2">
          <Button variant="ghost" size="sm" className="-ml-1" onClick={() => onHide(tile)}>
            {COPY.hidden.hide}
          </Button>
        </p>
      </form>
    </Modal>
  );
}

/** The honesty rules that apply to this action, as plain lines under the estimate. */
function Notes({ notes }: { notes: readonly ReactNode[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-body-sm text-ink-2">
      {notes.map((note, index) => (
        <li key={index}>{note}</li>
      ))}
    </ul>
  );
}

interface EstimateProps {
  /** `null`: the action carries no creditable figure. */
  kg: number | null;
  source: EstimateSource | null;
  versus: string | null;
  xp: number;
  maxed: boolean;
  /** Replaces "Impact not estimated" for figures shown as context only. */
  unquantified?: string;
  /** A second headline above the kilograms (litres of water for the tap). */
  headline?: ReactNode;
  /** Low confidence: the likely range, in words. */
  rough?: string;
}

/** The honest estimate: the mark, the figure, what it is compared with, and the XP. */
function Estimate({ kg, source, versus, xp, maxed, unquantified, headline, rough }: EstimateProps) {
  const quantified = kg !== null && source !== null;
  return (
    <div aria-live="polite" data-testid="log-preview" className="rounded-lg bg-mat px-4 py-4">
      {headline}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {quantified ? (
          <p className="flex flex-wrap items-baseline gap-x-2 text-h2 text-ink">
            <HonestyMark source={source} className="self-center" />
            <span className="sr-only">approximately </span>
            <span>{formatCo2Estimate(kg)}</span>
            <span className="text-body font-medium text-ink-2">
              <Co2e explain /> {COPY.quick.avoided}
            </span>
          </p>
        ) : (
          <p className="text-body font-semibold text-ink">
            {unquantified ?? COPY.quick.notQuantified}
          </p>
        )}
        <p className="text-body font-bold whitespace-nowrap text-ink">
          {xp > 0 ? `+${formatNumber(xp)} XP` : COPY.quick.noXp}
        </p>
      </div>
      {quantified && versus ? <p className="mt-1.5 text-body-sm text-ink-2">{versus}</p> : null}
      {quantified && rough ? <p className="mt-1.5 text-body-sm text-ink-2">{rough}</p> : null}
      {maxed ? (
        <p className="mt-2 text-body-sm font-semibold text-ink">{COPY.quick.maxed}</p>
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

function CommuteField({
  km,
  onChange,
  system,
}: {
  km: number;
  onChange: (km: number) => void;
  system: UnitSystem;
}) {
  const options = COMMUTE_PRESETS_KM.map((preset) => {
    const stored = toStoredQty(preset, 'km', system, 1);
    return { value: String(preset), label: formatQty(stored, 'km', system), km: stored };
  });
  const matched = options.find((option) => Math.abs(option.km - km) < 1e-6);
  const [text, setText] = useState(() => String(toDisplayQty(km, 'km', system)));
  const typed = parseQty(text);
  const typedKm = typed === null ? null : toStoredQty(typed, 'km', system, 1);
  const invalid = typedKm === null || typedKm > COMMUTE_MAX_KM;
  return (
    <Field label={COPY.quick.commute} error={invalid ? COPY.quick.commuteError : undefined}>
      <Segmented
        aria-label={COPY.quick.commute}
        fullWidth
        className="mb-2.5"
        value={matched?.value ?? ''}
        onValueChange={(value) => {
          const option = options.find((candidate) => candidate.value === value);
          if (!option) return;
          play('tick');
          setText(String(toDisplayQty(option.km, 'km', system)));
          onChange(option.km);
        }}
        options={options.map(({ value, label }) => ({ value, label }))}
      />
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={text}
        suffix={unitSuffix('km', system)}
        inputClassName="text-center font-bold"
        onChange={(event) => {
          setText(event.target.value);
          const shown = parseQty(event.target.value);
          if (shown === null) return;
          const next = toStoredQty(shown, 'km', system, 1);
          if (next <= COMMUTE_MAX_KM) onChange(next);
        }}
      />
    </Field>
  );
}

function ActionDialog({ request, open, onOpenChange, onLog, onHide }: DialogProps) {
  const { tile } = request;
  const members = useMembers(tile);
  const game = useGameState((state) => state);
  const today = useToday();
  const profile = useProfile();
  const system: UnitSystem = profile.units;
  const formId = useId();

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
  const source = preview.kg && qty !== null ? previewEstimateSource(action, qty, preview.kg) : null;
  const group = action.group ? GROUP_BY_ID.get(action.group) : undefined;
  const contextKg = contextKgPerUnit(action);

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
  if (preview.kg && preview.kg.kg === 0 && action.id === 'work-from-home-day') {
    notes.unshift(<strong className="font-semibold text-ink">{COPY.quick.zeroCommute}</strong>);
  }

  const submit = () => {
    if (!preview.ok || qty === null) return;
    onLog({ tile, logs: [{ actionId: memberId, qty, source: request.source, inputs }] });
  };

  const headline =
    action.id === 'tap-off-while-brushing' ? (
      <p className="mb-2 flex items-baseline gap-x-2 text-h2 text-ink">
        <Approx />
        <span>{formatNumber(TAP_LITRES_PER_DAY)}</span>
        <span className="text-body font-medium text-ink-2">{COPY.quick.water}</span>
      </p>
    ) : undefined;

  return (
    <SheetFrame
      tile={tile}
      open={open}
      onOpenChange={onOpenChange}
      onHide={onHide}
      formId={formId}
      onSubmit={submit}
      blockedReason={blocked?.message ?? error}
      lead={action.title}
    >
      {tile.kind === 'secondhand' && members.length > 1 ? (
        <div className="grid grid-cols-1 gap-2.5">
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
        <p role="status" className="rounded-lg bg-mat px-4 py-4 text-body font-semibold text-ink">
          {blocked.message}
        </p>
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
          ) : null}

          {action.id === 'carpool' ? (
            <div className="grid grid-cols-1 gap-2.5">
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

          <Estimate
            kg={preview.kg ? preview.kg.kg : null}
            source={source}
            versus={COPY.quick.versus(action.counterfactual)}
            xp={preview.xp}
            maxed={preview.maxed}
            headline={headline}
            rough={
              preview.kg && action.confidence === 'low'
                ? COPY.quick.rough(
                    formatCo2Estimate(preview.kg.low),
                    formatCo2Estimate(preview.kg.high),
                  )
                : undefined
            }
            unquantified={action.credit === 'context' ? COPY.quick.context : undefined}
          />
        </>
      )}

      <Notes notes={notes} />
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
    <li className="flex items-center gap-3 py-3">
      <p className="min-w-0 flex-1 text-body font-semibold text-ink">{label}</p>
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
        className="w-16 text-center text-body font-bold text-ink"
      >
        {formatDecimal(shown, 2)}
        <span className="block text-body-sm font-medium text-ink-3">
          {unitSuffix(action.unit, system)}
        </span>
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

function RecyclingDialog({ request, open, onOpenChange, onLog, onHide }: DialogProps) {
  const { tile } = request;
  const members = useMembers(tile);
  const game = useGameState((state) => state);
  const today = useToday();
  const system: UnitSystem = useProfile().units;
  const formId = useId();
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

  const submit = () => {
    if (blockedReason) return;
    onLog({
      tile,
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
      onHide={onHide}
      formId={formId}
      onSubmit={submit}
      blockedReason={blockedReason}
      lead={COPY.quick.recyclingLead}
    >
      <ul className="divide-y divide-line border-y border-line">
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
      <Estimate
        kg={parts.length > 0 ? kg : used.length > 0 ? null : 0}
        source={
          combinedEstimateSource(parts) ?? {
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
    </SheetFrame>
  );
}
