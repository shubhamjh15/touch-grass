'use client';

import { useState } from 'react';
import { Checkbox, RadioGroup } from '../Checkbox';
import { Field } from '../Field';
import { Input, SearchInput, Textarea } from '../Input';
import { Segmented } from '../Segmented';
import { Select } from '../Select';
import { Slider } from '../Slider';
import { Switch } from '../Switch';
import { TabPanel, Tabs } from '../Tabs';
import { Chapter, Demo } from './parts';

const REGIONS = [
  { value: 'world', label: 'World average' },
  { value: 'eu', label: 'Europe' },
  { value: 'in', label: 'India' },
  { value: 'us', label: 'United States' },
];

const PRESETS = [
  { value: '2', label: '2 km' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
] as const;

const MOTION = [
  { value: 'system', label: 'Match my device' },
  { value: 'full', label: 'On' },
  { value: 'reduced', label: 'Reduced', description: 'Cross-fades only.' },
];

const QUEST_TABS = [
  { value: 'today', label: 'Today', count: 3 },
  { value: 'week', label: 'This week', count: 2 },
  { value: 'big', label: 'Big quests' },
] as const;

type QuestTab = (typeof QUEST_TABS)[number]['value'];
type Preset = (typeof PRESETS)[number]['value'];

export function InputsChapter() {
  const [name, setName] = useState('Sam');
  const [treeName, setTreeName] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | undefined>('world');
  const [sound, setSound] = useState(false);
  const [preview, setPreview] = useState(false);
  const [agree, setAgree] = useState(true);
  const [motion, setMotion] = useState<string | undefined>('system');
  const [preset, setPreset] = useState<Preset>('5');
  const [distance, setDistance] = useState(5);
  const [tab, setTab] = useState<QuestTab>('today');

  return (
    <Chapter
      id="inputs"
      title="Inputs"
      rule="Every control has a visible label. Errors are plain sentences beside the field, never colour alone."
    >
      <Demo title="Text" className="gap-x-6">
        <Field label="Your name" hint="Only you see it." className="w-full max-w-xs">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field
          label="Your tree's name"
          required
          error={treeName.trim() ? undefined : 'Give your tree a name.'}
          className="w-full max-w-xs"
        >
          <Input
            value={treeName}
            placeholder="Fern"
            onChange={(event) => setTreeName(event.target.value)}
          />
        </Field>
        <Field label="Distance" className="w-full max-w-40">
          <Input inputMode="decimal" defaultValue="5" suffix="km" />
        </Field>
        <Field label="Disabled" className="w-full max-w-40">
          <Input defaultValue="Oak" disabled />
        </Field>
      </Demo>

      <Demo title="Search and long text" className="gap-x-6">
        <SearchInput
          label="Search actions"
          placeholder="Search actions"
          value={query}
          onValueChange={setQuery}
          resultCount={query ? 3 : undefined}
          className="w-full max-w-xs"
        />
        <Field label="A note for your journal" className="w-full max-w-xs">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </Demo>

      <Demo title="Choosing" className="gap-x-8">
        <Field label="Region" className="w-full max-w-xs">
          <Select value={region} onValueChange={setRegion} options={REGIONS} />
        </Field>
        <div>
          <p className="mb-2 text-label">How far?</p>
          <Segmented
            aria-label="How far?"
            value={preset}
            onValueChange={setPreset}
            options={PRESETS}
          />
        </div>
        <div>
          <p className="mb-2 text-label">Motion</p>
          <RadioGroup
            aria-label="Motion"
            value={motion}
            onValueChange={setMotion}
            options={MOTION}
          />
        </div>
      </Demo>

      <Demo title="Switches and checks" className="flex-col gap-y-1">
        <Switch
          label="Sound"
          description="Short sounds when you log and claim."
          checked={sound}
          onCheckedChange={setSound}
          className="w-full max-w-md"
        />
        <Switch
          label="3D preview (beta)"
          description="Off by default. The illustrated tree is lighter."
          checked={preview}
          onCheckedChange={setPreview}
          className="w-full max-w-md"
        />
        <Checkbox
          label="I understand this deletes my tree"
          checked={agree}
          onCheckedChange={setAgree}
        />
      </Demo>

      <Demo title="Slider">
        <Slider
          label="Distance"
          min={1}
          max={30}
          value={distance}
          onValueChange={setDistance}
          format={(value) => `${value} km`}
          className="w-full max-w-sm"
        />
      </Demo>

      <Demo
        title="Tabs"
        note="For switching views of the same thing. Sections that all matter are stacked instead."
      >
        <Tabs
          aria-label="Quests"
          value={tab}
          onValueChange={setTab}
          tabs={QUEST_TABS}
          className="w-full max-w-xl"
        >
          <TabPanel value="today">
            <p className="text-body text-ink-2">Three quests reset at midnight.</p>
          </TabPanel>
          <TabPanel value="week">
            <p className="text-body text-ink-2">Two quests run until Sunday.</p>
          </TabPanel>
          <TabPanel value="big">
            <p className="text-body text-ink-2">Big quests take a month or more.</p>
          </TabPanel>
        </Tabs>
      </Demo>
    </Chapter>
  );
}
