'use client';

import {
  Bike,
  ChartColumn,
  ChevronRight,
  Flame,
  Leaf,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { formatCo2Parts } from '@/lib/format';
import { Accordion, Disclosure } from '../Accordion';
import { Approx } from '../Approx';
import { Avatar } from '../Avatar';
import { BadgeMedal } from '../BadgeMedal';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { Card } from '../Card';
import { Co2e } from '../Co2e';
import { HonestyMark } from '../HonestyMark';
import { IconTile, Ledger, ListRow } from '../Ledger';
import { TextLink } from '../Link';
import { Panel } from '../Panel';
import { Sticker } from '../Sticker';
import { Tag } from '../Tag';
import { CATEGORY, CATEGORY_IDS, type CategoryId } from '../tokens';
import { Chapter, Demo, Spec } from './parts';
import { SAMPLE_SOURCE } from './sample';

const QUESTIONS = [
  {
    id: 'numbers',
    title: 'How accurate are the numbers?',
    content:
      'They are estimates built from published factors. Each one shows its formula and its likely range.',
  },
  {
    id: 'account',
    title: 'Do I need an account?',
    content: 'No. Everything stays on this device, and you can export it at any time.',
  },
  {
    id: 'cost',
    title: 'Does it cost anything?',
    content: 'No. There is nothing to buy and nothing to unlock with money.',
  },
];

function BannerDemo() {
  const [shown, setShown] = useState(true);
  if (!shown) {
    return (
      <Button size="sm" onClick={() => setShown(true)}>
        Show the banner again
      </Button>
    );
  }
  const week = formatCo2Parts(4.2);
  return (
    <Banner
      title="Your week is in"
      tone="success"
      icon={Sparkles}
      className="w-full max-w-xl"
      action={<TextLink href="#data">See your impact</TextLink>}
      onDismiss={() => setShown(false)}
    >
      Nine actions,{' '}
      <span className="whitespace-nowrap">
        <Approx />
        {week.value} {week.unit} <Co2e />
      </span>{' '}
      avoided.
    </Banner>
  );
}

function StickerPicker() {
  const [picked, setPicked] = useState<CategoryId | null>('move');
  return (
    <>
      {CATEGORY_IDS.map((id) => (
        <Sticker
          key={id}
          category={id}
          label={CATEGORY[id].label}
          selected={picked === id}
          onClick={() => setPicked(picked === id ? null : id)}
        />
      ))}
    </>
  );
}

export function SurfacesChapter() {
  const trip = formatCo2Parts(0.86);
  return (
    <Chapter
      id="surfaces"
      title="Surfaces"
      rule="A screen shows the first thing a person needs. The rest waits behind a row, an accordion or a sheet."
    >
      <Demo title="Cards" note="One tinted card per screen at most.">
        <Card className="w-full max-w-xs">
          <Card.Header title="Fact of the day" />
          <Card.Body>
            <p className="text-body text-ink-2">
              A short trip by bike instead of by car is one of the simplest swaps there is.
            </p>
          </Card.Body>
        </Card>
        <Card tone="yellow" className="w-full max-w-xs">
          <Card.Header title="A tinted card" />
          <Card.Body>
            <p className="text-body text-ink-2">
              The tint, never the fill, so text stays readable.
            </p>
          </Card.Body>
        </Card>
        <Card className="w-full max-w-xs">
          <Card.Header title="With a well" />
          <Card.Body>
            <Panel variant="well">
              <p className="text-body-sm text-ink-2">A quiet tinted area inside a card.</p>
            </Panel>
          </Card.Body>
        </Card>
      </Demo>

      <Demo title="Accordion" note="Questions, myths. Opening one closes the other.">
        <Accordion items={QUESTIONS} defaultOpen={['numbers']} className="w-full max-w-xl" />
      </Demo>

      <Demo
        title="Disclosure"
        note="One collapsed section: logged today, sources, the bigger picture."
      >
        <div className="w-full max-w-xl">
          <Disclosure title="Logged today" count={2}>
            <Ledger aria-label="Logged today">
              <ListRow
                leading={<Sticker category="move" size={32} />}
                title="Cycled to work"
                meta="08:42 · 5 km"
                value={
                  <>
                    <Approx />
                    {trip.value} {trip.unit}
                  </>
                }
              />
              <ListRow
                leading={<Sticker category="eat" size={32} />}
                title="Plant-based lunch"
                meta="13:05"
              />
            </Ledger>
          </Disclosure>
        </div>
        <Disclosure title="Sources" framed className="w-full max-w-xl">
          <p className="text-body-sm text-ink-2">Sample dataset, 2024.</p>
        </Disclosure>
      </Demo>

      <Demo
        title="Banner"
        note="One dismissible line at the top of a page, on the day it matters. Never more than one."
      >
        <BannerDemo />
      </Demo>

      <Demo title="List rows" note="One card, rows divided by hairlines. One icon per row.">
        <Ledger aria-label="More" cardClassName="w-full max-w-xl">
          <ListRow
            href="#data"
            leading={
              <IconTile hue="green">
                <ChartColumn size={20} strokeWidth={1.75} />
              </IconTile>
            }
            title="Impact"
            description="What your actions add up to"
            trailing={<ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />}
          />
          <ListRow
            href="#data"
            leading={
              <IconTile hue="blue">
                <Users size={20} strokeWidth={1.75} />
              </IconTile>
            }
            title="Community"
            description="Your journal and challenges"
            trailing={<ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />}
          />
          <ListRow
            href="#data"
            leading={
              <IconTile hue="yellow">
                <MessageCircle size={20} strokeWidth={1.75} />
              </IconTile>
            }
            title="Ask Moss"
            description="Your coach"
            trailing={<ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />}
          />
        </Ledger>
      </Demo>

      <Demo
        title="Action stickers"
        note="The die-cut look lives here, on badges and on the tree, nowhere else. Each category has its own shape, glyph and colour."
        className="gap-x-3"
      >
        <StickerPicker />
      </Demo>

      <Demo title="Sticker states" className="items-end gap-x-6">
        <Spec name="96">
          <Sticker category="nature" size={96} label="Nature" />
        </Spec>
        <Spec name="66">
          <Sticker category="move" label="Move" />
        </Spec>
        <Spec name="44">
          <Sticker category="eat" size={44} label="Eat" />
        </Spec>
        <Spec name="32">
          <Sticker category="water" size={32} label="Water" />
        </Spec>
        <Spec name="Not available">
          <Sticker category="power" label="Power" disabled onClick={() => undefined} hideLabel />
        </Spec>
        <Spec name="Empty slot">
          <Sticker category="stuff" ghost label="Empty slot" />
        </Spec>
      </Demo>

      <Demo
        title="Badges"
        note="Earned medals keep the die-cut look; locked ones are greyed and say how far along they are."
        className="gap-x-8"
      >
        <BadgeMedal
          name="First leaf"
          icon={Leaf}
          hue="green"
          state="earned"
          earnedOn="6 Oct 2026"
          onOpen={() => undefined}
        />
        <BadgeMedal
          name="Week on wheels"
          icon={Bike}
          hue="violet"
          tier={2}
          state="earned"
          earnedOn="2 Oct 2026"
        />
        <BadgeMedal
          name="Thirty-day flame"
          icon={Flame}
          hue="orange"
          state="locked"
          progress={{ value: 12, max: 30, unit: 'days' }}
        />
        <BadgeMedal
          name="Hidden"
          icon={Leaf}
          hue="pink"
          state="secret"
          hint="Something about mornings."
        />
        <BadgeMedal name="First leaf" icon={Leaf} hue="green" state="earned" size={72} />
      </Demo>

      <Demo title="Tags and avatars" className="items-center">
        <Tag>Daily</Tag>
        <Tag hue="yellow">+50 XP</Tag>
        <Tag category="move" />
        <Tag hue="green">Read</Tag>
        <Avatar kind="tree" species="oak" label="Your oak" />
        <Avatar kind="moss" label="Moss" />
        <Avatar kind="initial" name="Sam" label="Sam" badge={5} />
      </Demo>

      <Demo
        title="The honest number"
        note="Every estimate wears the drawn approximately sign, and one mark per view opens how it was made."
        className="items-center"
      >
        <p className="flex items-center gap-2 text-h2">
          <HonestyMark source={SAMPLE_SOURCE} />
          <span>
            <span className="sr-only">approximately </span>
            {trip.value} {trip.unit} <Co2e explain />
          </span>
        </p>
      </Demo>
    </Chapter>
  );
}
