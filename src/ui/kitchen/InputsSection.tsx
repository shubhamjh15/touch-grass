'use client';

import { Bike, Calendar, Footprints, Mail, Sprout, TrainFront, User } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../Card';
import { Checkbox, RadioGroup } from '../Checkbox';
import { Field } from '../Field';
import { Input, SearchInput, Textarea } from '../Input';
import { Ledger, ListRow } from '../Ledger';
import { Segmented } from '../Segmented';
import { Select } from '../Select';
import { Slider } from '../Slider';
import { Switch } from '../Switch';
import { TabPanel, Tabs } from '../Tabs';
import { Demo, Section } from './parts';

const ACTIONS = [
  'Bike it',
  'Bus it',
  'Veggie meal',
  'Cold wash',
  'Short shower',
  'Thrifted',
  'Refilled',
];

const SPECIES = [
  { value: 'oak', label: 'Oak' },
  { value: 'cherry', label: 'Cherry blossom' },
  { value: 'pine', label: 'Pine' },
];

const REGIONS = [
  { value: 'world', label: 'World average' },
  { value: 'eu', label: 'European Union' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'us', label: 'United States' },
  { value: 'in', label: 'India' },
  { value: 'other', label: 'Somewhere else', disabled: true },
];

export function InputsSection({ index }: { index: number }) {
  const [name, setName] = useState('Fern');
  const [distance, setDistance] = useState('250');
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<string | undefined>('oak');
  const [region, setRegion] = useState<string | undefined>(undefined);
  const [sound, setSound] = useState(true);
  const [patterns, setPatterns] = useState(false);
  const [weekly, setWeekly] = useState(true);
  const [shortcuts, setShortcuts] = useState(false);
  const [motion, setMotion] = useState('system');
  const [preset, setPreset] = useState('5');
  const [mode, setMode] = useState('bike');
  const [tab, setTab] = useState('daily');
  const [minutes, setMinutes] = useState(20);
  const matches = ACTIONS.filter((action) => action.toLowerCase().includes(query.toLowerCase()));

  return (
    <Section
      id="inputs"
      index={index}
      title="Inputs"
      note="Sunk things are filled · every field has a visible label · 16 px text"
    >
      <Demo label="Field, Input, Textarea" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Name your tree" hint="You can rename it any time." required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            icon={Sprout}
            maxLength={24}
          />
        </Field>
        <Field label="Distance" error="That's more than a day can hold. Typo?">
          <Input
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
            inputMode="decimal"
            suffix="km"
          />
        </Field>
        <Field label="Your name" hint="Only used to greet you. It stays on this device.">
          <Input placeholder="Sam" icon={User} autoComplete="given-name" />
        </Field>
        <Field label="Email a friend" hint="Disabled: no backend in this release.">
          <Input placeholder="friend@example.org" icon={Mail} disabled />
        </Field>
        <Field label="Date">
          <Input type="date" icon={Calendar} defaultValue="2026-10-06" />
        </Field>
        <Field label="Journal note" hint="Markdown is fine. Emoji welcome here.">
          <Textarea placeholder="Rode to the market. Tailwind both ways, somehow." />
        </Field>
      </Demo>

      <Demo
        label="SearchInput"
        note="A clear button appears with text; the result count is announced politely."
      >
        <div className="w-full max-w-md">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            label="Search 42 actions"
            resultCount={matches.length}
          />
          <p className="mt-2 type-slug leading-[1.6] text-ink-3">
            {query
              ? `${matches.length} of ${ACTIONS.length} · ${matches.join(' · ') || 'no match'}`
              : 'Type to filter'}
          </p>
        </div>
      </Demo>

      <Demo label="Select" className="grid gap-5 md:grid-cols-3">
        <Field label="Species">
          <Select value={species} onValueChange={setSpecies} options={SPECIES} />
        </Field>
        <Field label="Region" hint="Sets the grid and diet factors.">
          <Select
            value={region}
            onValueChange={setRegion}
            options={REGIONS}
            placeholder="Choose a region"
          />
        </Field>
        <Field label="Graphics">
          <Select
            value="auto"
            onValueChange={() => undefined}
            options={[{ value: 'auto', label: 'Auto' }]}
            disabled
          />
        </Field>
      </Demo>

      <Demo
        label="Switch"
        note="State is position plus a check, never colour alone. The whole row is the target."
      >
        <Card className="w-full max-w-md">
          <div className="grid divide-y-[1.5px] divide-ink">
            <Switch
              checked={sound}
              onCheckedChange={setSound}
              label="Sound"
              description="Paper sounds: peel, stick, stamp, tear."
            />
            <Switch checked={patterns} onCheckedChange={setPatterns} label="Patterns in charts" />
            <Switch
              checked={false}
              onCheckedChange={() => undefined}
              label="Sync"
              description="No account exists yet."
              disabled
            />
          </div>
        </Card>
        <Ledger aria-label="Settings rows" cardClassName="w-full max-w-md">
          <ListRow
            title="Weekly recap"
            description="A summary every Monday."
            trailing={
              <Switch checked={weekly} onCheckedChange={setWeekly} label="Weekly recap" hideLabel />
            }
          />
          <ListRow
            title="Single-key shortcuts"
            description="L to log, C for Moss."
            trailing={
              <Switch
                checked={shortcuts}
                onCheckedChange={setShortcuts}
                label="Single-key shortcuts"
                hideLabel
              />
            }
          />
        </Ledger>
      </Demo>

      <Demo label="Checkbox and RadioGroup" className="gap-x-12">
        <div className="w-full max-w-xs">
          <Checkbox checked={weekly} onCheckedChange={setWeekly} label="Remind me on Mondays" />
          <Checkbox
            checked={shortcuts}
            onCheckedChange={setShortcuts}
            label="I walk or cycle most days"
            description="Shapes your first quests."
          />
          <Checkbox
            checked
            onCheckedChange={() => undefined}
            label="Local-first (always on)"
            disabled
          />
        </div>
        <RadioGroup
          aria-label="Motion"
          value={motion}
          onValueChange={setMotion}
          className="w-full max-w-xs"
          options={[
            { value: 'system', label: 'System', description: 'Follows your device setting.' },
            { value: 'reduced', label: 'Reduced', description: 'Cross-fades only.' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Demo>

      <Demo
        label="Segmented"
        note="Picks one value. Quantity presets are always a Segmented. Arrow keys move."
      >
        <Segmented
          aria-label="Distance"
          value={preset}
          onValueChange={setPreset}
          options={[
            { value: '1', label: '1 km' },
            { value: '5', label: '5 km' },
            { value: '10', label: '10 km' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <Segmented
          aria-label="How did you travel?"
          value={mode}
          onValueChange={setMode}
          size="sm"
          options={[
            { value: 'walk', label: 'Walk', icon: Footprints },
            { value: 'bike', label: 'Bike', icon: Bike },
            { value: 'train', label: 'Train', icon: TrainFront, disabled: true },
          ]}
        />
        <div className="w-full max-w-sm">
          <Segmented
            aria-label="Motion"
            value={motion}
            onValueChange={setMotion}
            fullWidth
            options={[
              { value: 'system', label: 'System' },
              { value: 'reduced', label: 'Reduced' },
              { value: 'full', label: 'Full' },
            ]}
          />
        </div>
      </Demo>

      <Demo
        label="Tabs"
        note="Index tabs standing on a card: they swap what the panel contains. Arrow keys, Home, End."
      >
        <Tabs
          aria-label="Quests"
          value={tab}
          onValueChange={setTab}
          className="w-full max-w-xl"
          tabs={[
            { value: 'daily', label: 'Daily', count: 3 },
            { value: 'weekly', label: 'Weekly', count: 3 },
            { value: 'epic', label: 'Epics', count: 5 },
            { value: 'done', label: 'Done', disabled: true },
          ]}
        >
          <TabPanel value="daily">
            <p className="text-body-sm text-ink-2">
              Three quests a day, tracked from what you log. Resets at 03:00.
            </p>
          </TabPanel>
          <TabPanel value="weekly">
            <p className="text-body-sm text-ink-2">
              Three bigger quests. They rotate every Monday.
            </p>
          </TabPanel>
          <TabPanel value="epic">
            <p className="text-body-sm text-ink-2">Long projects in the real world. No timer.</p>
          </TabPanel>
          <TabPanel value="done">
            <p className="text-body-sm text-ink-2">Everything you have claimed.</p>
          </TabPanel>
        </Tabs>
      </Demo>

      <Demo label="Slider" note="Arrows ±1 step, PageUp/PageDown ±10, Home/End.">
        <div className="w-full max-w-md">
          <Slider
            label="Break length"
            value={minutes}
            onValueChange={setMinutes}
            min={5}
            max={60}
            step={5}
            marks={[5, 20, 40, 60]}
            format={(value) => `${value} min`}
          />
        </div>
      </Demo>
    </Section>
  );
}
