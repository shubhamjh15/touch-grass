'use client';

import { gameActions, useSettings } from '@/game';
import { Segmented, Select, Switch, type SegmentedOption, type SelectOption } from '@/ui';
import { useWorldStore, type WorldMotion, type WorldPreference } from '@/world';
import { COPY } from '../copy';
import { SettingRow, SettingsGroup } from './SettingRow';

const MOTION: readonly SegmentedOption<WorldMotion>[] = (
  ['system', 'reduced', 'full'] as const
).map((value) => ({ value, label: COPY.settings.motion.options[value] }));

const GRAPHICS: SelectOption[] = (['auto', 'high', 'medium', 'low', 'off'] as const).map(
  (value) => ({ value, label: COPY.settings.graphics.options[value] }),
);

const SKY: readonly SegmentedOption<'local' | 'day'>[] = (['local', 'day'] as const).map(
  (value) => ({ value, label: COPY.settings.sky.options[value] }),
);

const CELEBRATIONS: readonly SegmentedOption<'full' | 'subtle'>[] = (
  ['full', 'subtle'] as const
).map((value) => ({ value, label: COPY.settings.celebrations.options[value] }));

function isGraphics(value: string): value is WorldPreference {
  return GRAPHICS.some((option) => option.value === value);
}

/**
 * Sound, haptics, motion, 3D quality, sky and celebrations. Each applies the moment it changes:
 * the shell's world bridge reads these settings, so the grove beside the page is the preview.
 */
export function ExperienceSettings() {
  const settings = useSettings();
  // The browser has no WebGL, whatever the setting says.
  const noWebgl =
    useWorldStore((state) => state.status === 'fallback') && settings.graphics !== 'off';

  return (
    <SettingsGroup title={COPY.settings.experience.heading} label={COPY.settings.experience.label}>
      <li className="bg-card px-4 py-1.5">
        <Switch
          checked={settings.sound}
          onCheckedChange={(sound) => gameActions.updateSettings({ sound })}
          label={COPY.settings.sound.label}
          description={COPY.settings.sound.hint}
        />
      </li>
      <li className="bg-card px-4 py-1.5">
        <Switch
          checked={settings.haptics}
          onCheckedChange={(haptics) => gameActions.updateSettings({ haptics })}
          label={COPY.settings.haptics.label}
          description={COPY.settings.haptics.hint}
        />
      </li>
      <SettingRow title={COPY.settings.motion.label} hint={COPY.settings.motion.hint}>
        {() => (
          <Segmented<WorldMotion>
            aria-label={COPY.settings.motion.label}
            value={settings.motion}
            options={MOTION}
            onValueChange={(motion) => gameActions.updateSettings({ motion })}
          />
        )}
      </SettingRow>
      <SettingRow
        title={COPY.settings.graphics.label}
        hint={COPY.settings.graphics.hint}
        message={
          noWebgl ? <span className="text-ink-2">{COPY.settings.graphics.noWebgl}</span> : null
        }
      >
        {() => (
          <Select
            aria-label={COPY.settings.graphics.label}
            value={settings.graphics}
            options={GRAPHICS}
            onValueChange={(value) => {
              if (isGraphics(value)) gameActions.updateSettings({ graphics: value });
            }}
            className="w-full sm:w-56"
          />
        )}
      </SettingRow>
      <SettingRow title={COPY.settings.sky.label} hint={COPY.settings.sky.hint}>
        {() => (
          <Segmented<'local' | 'day'>
            aria-label={COPY.settings.sky.label}
            value={settings.sky}
            options={SKY}
            onValueChange={(sky) => gameActions.updateSettings({ sky })}
          />
        )}
      </SettingRow>
      <SettingRow title={COPY.settings.celebrations.label} hint={COPY.settings.celebrations.hint}>
        {() => (
          <Segmented<'full' | 'subtle'>
            aria-label={COPY.settings.celebrations.label}
            value={settings.celebrations}
            options={CELEBRATIONS}
            onValueChange={(celebrations) => gameActions.updateSettings({ celebrations })}
          />
        )}
      </SettingRow>
    </SettingsGroup>
  );
}
