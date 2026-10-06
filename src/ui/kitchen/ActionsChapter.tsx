'use client';

import { ArrowRight, MessageCircle, Plus, RotateCcw, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { Fab } from '../Fab';
import { IconButton } from '../IconButton';
import { TextLink } from '../Link';
import { CATEGORY, CATEGORY_IDS, type CategoryId } from '../tokens';
import { CATEGORY_ICON } from '../categoryIcons';
import { Chapter, Demo } from './parts';

function SuccessButton() {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="reward"
      success={done}
      onClick={() => {
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? 'Claimed' : 'Claim 40 XP'}
    </Button>
  );
}

function CategoryChips() {
  const [selected, setSelected] = useState<CategoryId | 'all'>('all');
  return (
    <div role="group" aria-label="Category" className="scroll-row max-w-full gap-2">
      <Chip selected={selected === 'all'} onSelectedChange={() => setSelected('all')}>
        All
      </Chip>
      {CATEGORY_IDS.map((id) => (
        <Chip
          key={id}
          icon={CATEGORY_ICON[id]}
          selected={selected === id}
          onSelectedChange={() => setSelected(id)}
        >
          {CATEGORY[id].label}
        </Chip>
      ))}
    </div>
  );
}

export function ActionsChapter() {
  return (
    <Chapter
      id="actions"
      title="Buttons"
      rule="Three levels. One green primary per screen, quiet secondaries, and text links for everything else. A label says what happens."
    >
      <Demo title="The three levels" className="items-center">
        <Button variant="primary">Log it</Button>
        <Button>Not now</Button>
        <Button variant="link">See all</Button>
      </Demo>

      <Demo
        title="Sizes"
        note="48 px by default. 56 px for the one main call to action of a screen. 36 px inside rows and toasts."
        className="items-center"
      >
        <Button variant="primary" size="lg" iconRight={ArrowRight}>
          Log an action
        </Button>
        <Button variant="primary" icon={Plus}>
          Log it
        </Button>
        <Button size="sm" icon={Undo2}>
          Undo
        </Button>
      </Demo>

      <Demo title="States" className="items-center">
        <Button variant="primary" loading>
          Log it
        </Button>
        <Button variant="primary" disabled>
          Log it
        </Button>
        <Button disabledReason="Pick an amount first">Log it</Button>
        <SuccessButton />
      </Demo>

      <Demo
        title="Special cases"
        note="A claim is yellow. Tomato appears only on a destructive confirmation."
        className="items-center"
      >
        <Button variant="reward">Claim 40 XP</Button>
        <Button variant="danger">Reset data</Button>
        <Button variant="ink">Try again</Button>
      </Demo>

      <Demo
        title="Icon buttons"
        note="Always named, always a 44 px target."
        className="items-center"
      >
        <IconButton label="Undo" icon={RotateCcw} />
        <IconButton label="Close" icon={X} variant="ghost" />
        <IconButton label="Add one" icon={Plus} shape="square" />
        <IconButton label="Remove" icon={X} disabledReason="Nothing to remove" />
      </Demo>

      <Demo title="Links">
        <p className="measure text-body">
          Every figure is an estimate. <TextLink href="#foundations">Read the methodology</TextLink>{' '}
          to see how each one is made.
        </p>
      </Demo>

      <Demo
        title="Floating button"
        note="One per screen, for the thing that is always within reach. It pins to the bottom-right corner, above the tab bar on phones; shown in place here."
        className="items-center"
      >
        <Fab label="Ask Moss" icon={MessageCircle} placement="inline" />
        <Fab label="Log an action" icon={Plus} variant="primary" placement="inline" />
        <Fab label="Ask Moss" icon={MessageCircle} iconOnly placement="inline" />
      </Demo>

      <Demo
        title="Filter chips"
        note="The one thing that scrolls sideways on a phone. Selected is the inverse: ink fill, white text."
      >
        <CategoryChips />
      </Demo>
    </Chapter>
  );
}
