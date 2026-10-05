'use client';

import {
  ArrowUp,
  Bike,
  Bus,
  Droplets,
  Flame,
  Footprints,
  Lightbulb,
  Salad,
  Scissors,
  ShowerHead,
  Sprout,
  TreePine,
  Trophy,
  WashingMachine,
} from 'lucide-react';
import { useState } from 'react';
import { Approx } from '../Approx';
import { Avatar } from '../Avatar';
import { BadgeMedal } from '../BadgeMedal';
import { Chip } from '../Chip';
import { Co2e } from '../Co2e';
import { ColorBar } from '../ColorBar';
import { CloudGlyph, LeafMark, MossFace, SproutGlyph, TreeGlyph } from '../glyphs';
import { Kbd } from '../Kbd';
import { Stamp } from '../Stamp';
import { Sticker } from '../Sticker';
import { StickerPill } from '../StickerPill';
import { STICKER_SHAPES } from '../stickerShapes';
import { Tag } from '../Tag';
import { CATEGORY, CATEGORY_IDS, type CategoryId } from '../tokens';
import { Demo, Section, Spec } from './parts';

const QUICK: { category: CategoryId; label: string; icon?: typeof Bike }[] = [
  { category: 'move', label: 'Bike it' },
  { category: 'eat', label: 'Veggie meal', icon: Salad },
  { category: 'power', label: 'Cold wash', icon: WashingMachine },
  { category: 'water', label: 'Short shower', icon: ShowerHead },
  { category: 'stuff', label: 'Thrifted' },
  { category: 'waste', label: 'Refilled' },
  { category: 'nature', label: 'Planted', icon: Sprout },
];

function StickerRow() {
  const [picked, setPicked] = useState<string | null>('Veggie meal');
  return (
    <div className="scroll-row gap-3">
      {QUICK.map((item) => (
        <Sticker
          key={item.label}
          category={item.category}
          icon={item.icon}
          label={item.label}
          selected={picked === item.label}
          onClick={() => setPicked((current) => (current === item.label ? null : item.label))}
        />
      ))}
      <Sticker category="move" icon={Bus} label="Bus it" disabled onClick={() => undefined} />
      <Sticker
        category="power"
        icon={Lightbulb}
        label="Lights off"
        onClick={() => undefined}
        badge={<Tag hue="green">Maxed</Tag>}
      />
    </div>
  );
}

function FilterChips() {
  const [filter, setFilter] = useState('all');
  const options = [
    { id: 'all', label: 'All', count: 42 },
    { id: 'daily', label: 'Daily', count: 3 },
    { id: 'weekly', label: 'Weekly', count: 3 },
    { id: 'epic', label: 'Epic', count: 5 },
  ];
  return (
    <div className="scroll-row gap-2" role="group" aria-label="Filter quests">
      {options.map((option) => (
        <Chip
          key={option.id}
          selected={filter === option.id}
          count={option.count}
          onSelectedChange={() => setFilter(option.id)}
        >
          {option.label}
        </Chip>
      ))}
      <Chip icon={Flame}>On a streak</Chip>
      <Chip as="span">Static chip</Chip>
    </div>
  );
}

export function StickersSection({ index }: { index: number }) {
  return (
    <Section
      id="stickers"
      index={index}
      title="Stickers, tags, marks"
      note="Category = shape + icon + colour · die-cut what you can pick up"
    >
      <Demo
        label="Sticker: the seven categories"
        note="Each has its own silhouette, so colour is never the only signal."
      >
        {CATEGORY_IDS.map((id) => (
          <Spec key={id} name={`${id} · ${STICKER_SHAPES[id].name}`} className="w-[92px]">
            <Sticker category={id} label={`${CATEGORY[id].label} sticker`} rotate={0} />
          </Spec>
        ))}
      </Demo>

      <Demo label="Sizes, ghost and rotation" className="items-end gap-x-7">
        <Spec name="32">
          <Sticker category="move" size={32} rotate={-4} />
        </Spec>
        <Spec name="44">
          <Sticker category="eat" size={44} rotate={3} />
        </Spec>
        <Spec name="66">
          <Sticker category="power" size={66} rotate={-3} />
        </Spec>
        <Spec name="96">
          <Sticker category="nature" size={96} rotate={4} icon={TreePine} />
        </Spec>
        <Spec name="ghost · empty slot">
          <Sticker category="waste" ghost />
        </Spec>
        <Spec name="ghost · Nº 07">
          <Sticker
            category="water"
            ghost
            badge={<span className="type-tick text-ink-3">Nº 07</span>}
          />
        </Spec>
        <Spec name="custom icon">
          <Sticker category="move" icon={Footprints} rotate={2} />
        </Spec>
        <Spec name="custom icon">
          <Sticker category="water" icon={Droplets} rotate={-2} />
        </Spec>
      </Demo>

      <Demo
        label="Sticker as a button"
        note="Hover turns it upright and lifts it; press moves the body onto its shadow. Selected adds a check disc."
      >
        <StickerRow />
      </Demo>

      <Demo
        label="StickerPill"
        note="Expressive, never interactive, at most two per viewport."
        className="gap-x-8 py-2"
      >
        <StickerPill hue="yellow">Hey Earthling!</StickerPill>
        <StickerPill hue="pink" rotate={1}>
          No doomscrolling allowed.
        </StickerPill>
        <StickerPill hue="yellow" icon={Flame} margin={3} rotate={-3}>
          <span className="type-figure text-[1.125rem]">12</span>
        </StickerPill>
        <StickerPill hue="green" rotate={2}>
          7 days running
        </StickerPill>
        <StickerPill hue="white" rotate={-1} margin={6}>
          Local mode
        </StickerPill>
        <StickerPill hue="blue" rotate={3}>
          New lesson
        </StickerPill>
      </Demo>

      <Demo
        label="Chip"
        note="Filter pills are toggle buttons. Selected = yellow + a hard shadow + a −2° turn."
      >
        <FilterChips />
      </Demo>

      <Demo label="Tag" note="Printed, so no shadow, never interactive.">
        <Tag hue="blue">Daily</Tag>
        <Tag hue="yellow">Weekly</Tag>
        <Tag hue="pink">Epic</Tag>
        <Tag>+50 XP</Tag>
        <Tag hue="green">Live</Tag>
        <Tag hue="yellow">Built-in</Tag>
        <Tag hue="white" icon={Flame}>
          12 days
        </Tag>
        <Tag hue="ink">Nº 0012</Tag>
        <Tag hue="paper">Sample</Tag>
        <Tag hue="yellow" misreg>
          Context, not your data
        </Tag>
        {CATEGORY_IDS.map((id) => (
          <Tag key={id} category={id} />
        ))}
      </Demo>

      <Demo
        label="Tag: specimen"
        note="The tree's hang tag. With href it becomes a link to the passport."
        className="gap-x-10 py-3"
      >
        <Tag variant="specimen" title="Fern" meta="Oak · young tree · day 12 · thriving" />
        <Tag variant="specimen" title="Sakura" meta="Cherry · sapling · day 4" href="#stickers" />
      </Demo>

      <Demo
        label="Stamp"
        note="Uneven inking, a deep hue on paper or card. The words always also exist as text nearby."
        className="gap-x-10 py-3"
      >
        <Stamp label="Touched grass" date="06 Oct 2026" />
        <Stamp label="Planted" hue="green" shape="round" rotate={4} />
        <Stamp label="Claimed" hue="violet" rotate={-3} />
        <Stamp label="Logged" date="14:32" hue="blue" rotate={5} />
        <Stamp label="Sample" hue="tomato" rotate={-8} />
      </Demo>

      <Demo
        label="BadgeMedal"
        note="Earned = a stamp impression. Locked = a numbered slot with a progress arc. No padlocks."
      >
        <BadgeMedal
          name="First leaf"
          icon={Sprout}
          hue="green"
          state="earned"
          earnedOn="24 Sep 2026"
          onOpen={() => undefined}
        />
        <BadgeMedal
          name="Week one"
          icon={Flame}
          hue="pink"
          tier={2}
          state="earned"
          earnedOn="01 Oct 2026"
        />
        <BadgeMedal
          name="Pedal power"
          icon={Bike}
          hue="violet"
          tier={3}
          state="earned"
          earnedOn="05 Oct 2026"
        />
        <BadgeMedal
          name="Fifty logs"
          icon={Trophy}
          hue="blue"
          state="locked"
          slot={7}
          progress={{ value: 34, max: 50, unit: 'logs' }}
        />
        <BadgeMedal name="Mender" icon={Scissors} hue="pink" state="locked" slot={8} />
        <BadgeMedal
          name="Secret"
          icon={Trophy}
          hue="yellow"
          state="secret"
          slot={12}
          hint="Awake before the birds."
        />
        <BadgeMedal
          name="First leaf"
          icon={Sprout}
          hue="green"
          state="earned"
          earnedOn="24 Sep 2026"
          size={72}
        />
        <BadgeMedal
          name="Pedal power"
          icon={Bike}
          hue="violet"
          tier={3}
          state="earned"
          earnedOn="05 Oct 2026"
          size={160}
        />
      </Demo>

      <Demo label="Avatar" note="No photos anywhere: a tree, Moss, or one letter.">
        <Spec name="tree · 42 + level">
          <Avatar kind="tree" size={42} badge={5} label="Fern, level 5" />
        </Spec>
        <Spec name="oak">
          <Avatar kind="tree" species="oak" label="An oak" />
        </Spec>
        <Spec name="cherry">
          <Avatar kind="tree" species="cherry" label="A cherry" />
        </Spec>
        <Spec name="pine · 64">
          <Avatar kind="tree" species="pine" size={64} label="A pine" />
        </Spec>
        <Spec name="moss · button">
          <Avatar kind="moss" label="Ask Moss" onClick={() => undefined} />
        </Spec>
        <Spec name="moss · thinking">
          <Avatar kind="moss" mood="thinking" size={64} label="Moss is thinking" />
        </Spec>
        <Spec name="moss · 32">
          <Avatar kind="moss" size={32} label="Moss" />
        </Spec>
        <Spec name="initial">
          <Avatar kind="initial" name="Sam" label="Sam" />
        </Spec>
        <Spec name="link">
          <Avatar kind="tree" species="oak" href="#stickers" label="Open the passport" />
        </Spec>
      </Demo>

      <Demo
        label="Drawn glyphs"
        note="Hand-drawn where lucide or emoji would not do."
        className="items-end"
      >
        <Spec name="MossFace">
          <MossFace size={56} title="Moss" />
        </Spec>
        <Spec name="thinking">
          <MossFace size={56} mood="thinking" />
        </Spec>
        <Spec name="sleepy">
          <MossFace size={56} mood="sleepy" />
        </Spec>
        <Spec name="TreeGlyph">
          <span className="flex gap-2 text-green-deep">
            <TreeGlyph species="oak" size={32} />
            <TreeGlyph species="cherry" size={32} />
            <TreeGlyph species="pine" size={32} />
          </span>
        </Spec>
        <Spec name="SproutGlyph">
          <SproutGlyph size={32} className="text-green-deep" />
        </Spec>
        <Spec name="LeafMark">
          <span className="grid size-[38px] -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1">
            <LeafMark size={24} />
          </span>
        </Spec>
        <Spec name="CloudGlyph">
          <CloudGlyph size={84} />
        </Spec>
      </Demo>

      <Demo label="Approx, Co2e, Kbd, ColorBar" className="items-center gap-x-8">
        <Spec name="display ≈">
          <span className="type-figure text-display-md">
            <Approx />
            2.4
          </span>
        </Spec>
        <Spec name="mono ≈">
          <span className="font-mono text-data-lg">
            <Approx weight="mono" />
            1.02&nbsp;kg <Co2e explain />
          </span>
        </Spec>
        <Spec name="Kbd">
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
            <Kbd aria-label="Up arrow">
              <ArrowUp size={12} strokeWidth={2.5} aria-hidden="true" />
            </Kbd>
            <Kbd>Esc</Kbd>
          </span>
        </Spec>
        <Spec name="ColorBar">
          <ColorBar />
        </Spec>
        <Spec name="loading">
          <ColorBar loading />
        </Spec>
        <Spec name="stepper 2 / 5">
          <ColorBar step={2} steps={5} />
        </Spec>
        <Spec name="sm">
          <ColorBar size="sm" />
        </Spec>
      </Demo>
    </Section>
  );
}
