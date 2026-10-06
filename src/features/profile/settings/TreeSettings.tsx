'use client';

import { useState, type KeyboardEvent } from 'react';
import { ACTION_BY_ID, CATEGORIES, GRID, type CategoryId } from '@/data/catalogue';
import {
  gameActions,
  useProfile,
  useSettings,
  type HeatSource,
  type Species,
  type Units,
} from '@/game';
import { formatLongDate } from '@/lib/format';
import { Button, Chip, Input, Modal, Segmented, Select, type SelectOption } from '@/ui';
import { COPY, listDays } from '../copy';
import { SettingRow, SettingsGroup } from './SettingRow';

const SPECIES_OPTIONS = (Object.keys(COPY.settings.species.options) as Species[]).map((value) => ({
  value,
  label: COPY.settings.species.options[value],
}));

const HEAT_OPTIONS: SelectOption[] = (Object.keys(COPY.settings.heat.options) as HeatSource[]).map(
  (value) => ({ value, label: COPY.settings.heat.options[value] }),
);

const UNIT_OPTIONS = (Object.keys(COPY.settings.units.options) as Units[]).map((value) => ({
  value,
  label: COPY.settings.units.options[value],
}));

/** The world first, then the places people pick most, then the rest by name. */
const REGION_OPTIONS: SelectOption[] = [...GRID]
  .sort((a, b) => {
    if (a.id === 'WORLD') return -1;
    if (b.id === 'WORLD') return 1;
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  })
  .map((region) => ({ value: region.id, label: region.name }));

/** A text setting that saves when you leave the box or press Enter, and says why when it cannot. */
function TextSetting({
  title,
  hint,
  value,
  max,
  placeholder,
  onCommit,
}: {
  title: string;
  hint: string;
  value: string;
  max: number;
  placeholder?: string;
  onCommit: (next: string) => { ok: true } | { ok: false; message: string };
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    if (draft.trim() === value) {
      setDraft(null);
      setError(null);
      return;
    }
    const result = onCommit(draft);
    if (result.ok) {
      setDraft(null);
      setError(null);
    } else {
      setError(result.message);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      setDraft(null);
      setError(null);
    }
  };

  return (
    <SettingRow
      title={title}
      hint={hint}
      message={error ? <span className="text-tomato-deep">{error}</span> : null}
    >
      {(labelId) => (
        <Input
          aria-labelledby={labelId}
          value={draft ?? value}
          maxLength={max}
          placeholder={placeholder}
          invalid={error !== null}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-full sm:w-64"
        />
      )}
    </SettingRow>
  );
}

function HiddenActions() {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const hidden = settings.hiddenActions;

  return (
    <SettingRow
      title={COPY.settings.hidden.label}
      hint={
        hidden.length === 0 ? COPY.settings.hidden.none : COPY.settings.hidden.count(hidden.length)
      }
    >
      {() => (
        <>
          <Button
            variant="neutral"
            size="sm"
            disabled={hidden.length === 0}
            onClick={() => setOpen(true)}
          >
            {COPY.settings.hidden.manage}
          </Button>
          <Modal
            open={open && hidden.length > 0}
            onOpenChange={setOpen}
            title={COPY.settings.hidden.title}
            description={COPY.settings.hidden.lead}
            size="sm"
            footer={
              <Button variant="neutral" onClick={() => setOpen(false)}>
                {COPY.settings.hidden.close}
              </Button>
            }
          >
            <ul className="grid gap-2">
              {hidden.map((id) => {
                const title = ACTION_BY_ID.get(id)?.title ?? id;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-sm border-2 border-ink bg-card px-3 py-2"
                  >
                    <span className="min-w-0 text-body font-semibold break-words">{title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={COPY.settings.hidden.unhideOne(title)}
                      onClick={() => gameActions.unhideAction(id)}
                    >
                      {COPY.settings.hidden.unhide}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Modal>
        </>
      )}
    </SettingRow>
  );
}

/** Name, tree, species, focus, region, heating, units, rest days and hidden actions. */
export function TreeSettings() {
  const profile = useProfile();
  const settings = useSettings();
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const [speciesNote, setSpeciesNote] = useState<string | null>(null);
  const [restNote, setRestNote] = useState<string | null>(null);

  const toggleFocus = (id: CategoryId) => {
    const has = profile.focus.includes(id);
    if (has && profile.focus.length === 1) {
      setFocusNote(COPY.settings.focus.atLeastOne);
      return;
    }
    if (!has && profile.focus.length >= 3) {
      setFocusNote(COPY.settings.focus.full);
      return;
    }
    const next = has ? profile.focus.filter((entry) => entry !== id) : [...profile.focus, id];
    const result = gameActions.updateProfile({ focus: next });
    setFocusNote(result.ok ? null : result.message);
  };

  const planned = settings.restDaysPending ?? settings.restDays;
  const toggleRest = (day: number) => {
    const has = planned.includes(day);
    if (!has && planned.length >= 3) {
      setRestNote(COPY.settings.rest.full);
      return;
    }
    setRestNote(null);
    gameActions.updateSettings({
      restDays: has ? planned.filter((entry) => entry !== day) : [...planned, day],
    });
  };
  const restLine =
    settings.restDaysPending && settings.restDaysFrom
      ? settings.restDaysPending.length === 0
        ? COPY.settings.rest.pendingNone(formatLongDate(settings.restDaysFrom))
        : COPY.settings.rest.pending(
            listDays(settings.restDaysPending),
            formatLongDate(settings.restDaysFrom),
          )
      : settings.restDays.length === 0
        ? COPY.settings.rest.none
        : COPY.settings.rest.current(listDays(settings.restDays));

  return (
    <SettingsGroup title={COPY.settings.you.heading} label={COPY.settings.you.label}>
      <TextSetting
        title={COPY.settings.name.label}
        hint={COPY.settings.name.hint}
        value={profile.name}
        max={20}
        placeholder={COPY.settings.name.placeholder}
        onCommit={(next) => {
          const result = gameActions.updateProfile({ name: next });
          return result.ok ? { ok: true } : { ok: false, message: result.message };
        }}
      />
      <TextSetting
        title={COPY.settings.treeName.label}
        hint={COPY.settings.treeName.hint}
        value={profile.treeName}
        max={16}
        onCommit={(next) => {
          const result = gameActions.updateProfile({ treeName: next });
          return result.ok ? { ok: true } : { ok: false, message: result.message };
        }}
      />
      <SettingRow
        title={COPY.settings.species.label}
        hint={COPY.settings.species.hint}
        message={speciesNote}
      >
        {(labelId) => (
          <div role="group" aria-labelledby={labelId}>
            <Segmented<Species>
              aria-label={COPY.settings.species.label}
              value={profile.species}
              options={SPECIES_OPTIONS}
              onValueChange={(species) => {
                const result = gameActions.updateProfile({ species });
                setSpeciesNote(
                  result.ok
                    ? COPY.settings.species.done(COPY.settings.species.options[species])
                    : result.message,
                );
              }}
            />
          </div>
        )}
      </SettingRow>
      <SettingRow
        title={COPY.settings.focus.label}
        hint={COPY.settings.focus.hint}
        message={focusNote}
        stack
      >
        {(labelId) => (
          <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Chip
                key={category.id}
                selected={profile.focus.includes(category.id)}
                onSelectedChange={() => toggleFocus(category.id)}
              >
                {category.label}
              </Chip>
            ))}
          </div>
        )}
      </SettingRow>
      <SettingRow title={COPY.settings.region.label} hint={COPY.settings.region.hint}>
        {() => (
          <Select
            aria-label={COPY.settings.region.label}
            value={profile.region}
            options={REGION_OPTIONS}
            onValueChange={(region) => gameActions.updateProfile({ region })}
            className="w-full sm:w-64"
          />
        )}
      </SettingRow>
      <SettingRow title={COPY.settings.heat.label} hint={COPY.settings.heat.hint}>
        {() => (
          <Select
            aria-label={COPY.settings.heat.label}
            value={profile.heat}
            options={HEAT_OPTIONS}
            onValueChange={(value) => gameActions.updateProfile({ heat: value as HeatSource })}
            className="w-full sm:w-64"
          />
        )}
      </SettingRow>
      <SettingRow title={COPY.settings.units.label}>
        {() => (
          <Segmented<Units>
            aria-label={COPY.settings.units.label}
            value={profile.units}
            options={UNIT_OPTIONS}
            onValueChange={(units) => gameActions.updateProfile({ units })}
          />
        )}
      </SettingRow>
      <SettingRow
        title={COPY.settings.rest.label}
        hint={COPY.settings.rest.hint}
        message={
          <span className={restNote ? 'text-tomato-deep' : 'text-ink-2'}>
            {restNote ?? restLine}
          </span>
        }
        stack
      >
        {(labelId) => (
          <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
            {COPY.settings.rest.daysFull.map((name, day) => (
              <Chip
                key={name}
                selected={planned.includes(day)}
                onSelectedChange={() => toggleRest(day)}
                aria-label={name}
              >
                {COPY.settings.rest.days[day]}
              </Chip>
            ))}
          </div>
        )}
      </SettingRow>
      <HiddenActions />
    </SettingsGroup>
  );
}
