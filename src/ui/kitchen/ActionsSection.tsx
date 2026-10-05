'use client';

import {
  ArrowRight,
  Check,
  Download,
  Plus,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, type ButtonVariant } from '../Button';
import { IconButton } from '../IconButton';
import { TextLink } from '../Link';
import { Demo, Section, Spec } from './parts';

const VARIANTS: { variant: ButtonVariant; label: string }[] = [
  { variant: 'primary', label: 'Stick it on' },
  { variant: 'reward', label: 'Claim +50' },
  { variant: 'neutral', label: 'How it works' },
  { variant: 'info', label: 'Start lesson' },
  { variant: 'ink', label: 'Plant your tree' },
  { variant: 'danger', label: 'Reset data' },
  { variant: 'ghost', label: 'Why?' },
];

function SuccessBeat() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), 600);
    return () => window.clearTimeout(timer);
  }, [done]);
  return (
    <Button variant="neutral" icon={Plus} success={done} onClick={() => setDone(true)}>
      Stick it on
    </Button>
  );
}

function LoadingToggle() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="primary" icon={Plus} loading={loading}>
        Stick it on
      </Button>
      <Button variant="neutral" loading={loading}>
        Export my data
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setLoading((value) => !value)}>
        {loading ? 'Stop loading' : 'Start loading'}
      </Button>
    </div>
  );
}

export function ActionsSection({ index }: { index: number }) {
  return (
    <Section
      id="actions"
      index={index}
      title="Actions"
      note="Verb first · at most three words · one primary per view"
    >
      <Demo
        label="Button variants"
        note="Hover lifts 1 px, press travels the full lift into the shadow in 80 ms."
      >
        {VARIANTS.map(({ variant, label }) => (
          <Spec key={variant} name={variant}>
            <Button variant={variant} iconRight={variant === 'ink' ? ArrowRight : undefined}>
              {label}
            </Button>
          </Spec>
        ))}
      </Demo>

      <Demo label="Sizes and icons">
        <Spec name="sm · 36">
          <Button size="sm" variant="neutral" icon={Undo2}>
            Undo
          </Button>
        </Spec>
        <Spec name="md · 48">
          <Button size="md" variant="primary" icon={Plus}>
            Stick it on
          </Button>
        </Spec>
        <Spec name="lg · 56">
          <Button size="lg" variant="primary" iconRight={ArrowRight}>
            Plant your tree
          </Button>
        </Spec>
        <Spec name="reward · sm">
          <Button size="sm" variant="reward" icon={Timer}>
            Touch grass
          </Button>
        </Spec>
        <Spec name="as a link">
          <Button asChild variant="neutral" iconRight={ArrowRight}>
            <a href="#tokens">See the tokens</a>
          </Button>
        </Spec>
      </Demo>

      <Demo label="States">
        <Spec name="rest">
          <Button variant="primary">Plant your tree</Button>
        </Spec>
        <Spec name="pressed · stuck">
          <Button variant="primary" data-pressed="true">
            Plant your tree
          </Button>
        </Spec>
        <Spec name="disabled · die line">
          <Button variant="primary" disabled>
            Plant your tree
          </Button>
        </Spec>
        <Spec name="aria-disabled + reason">
          <Button variant="primary" disabledReason="Name your tree first.">
            Plant your tree
          </Button>
        </Spec>
        <Spec name="success beat (press it)">
          <SuccessBeat />
        </Spec>
        <Spec name="ghost disabled">
          <Button variant="ghost" disabled>
            Why?
          </Button>
        </Spec>
      </Demo>

      <Demo
        label="Loading"
        note="Held halfway. The leading icon becomes the colour bar; label and width never change."
      >
        <LoadingToggle />
      </Demo>

      <Demo label="Full width">
        <div className="grid w-full max-w-sm gap-3">
          <Button variant="primary" fullWidth icon={Check}>
            Stick it on
          </Button>
          <Button variant="neutral" fullWidth>
            Not now
          </Button>
        </div>
      </Demo>

      <Demo
        label="IconButton"
        note="Always named; the label is also the tooltip. 44 px target even when drawn at 36."
      >
        <Spec name="neutral · round">
          <IconButton label="Search" icon={Search} />
        </Spec>
        <Spec name="primary">
          <IconButton label="Log an action" icon={Plus} variant="primary" />
        </Spec>
        <Spec name="reward">
          <IconButton label="Start a break" icon={Timer} variant="reward" />
        </Spec>
        <Spec name="info · square">
          <IconButton label="Export my data" icon={Download} variant="info" shape="square" />
        </Spec>
        <Spec name="sm · undo">
          <IconButton label="Undo" icon={RotateCcw} size="sm" />
        </Spec>
        <Spec name="sm · square">
          <IconButton label="Close" icon={X} size="sm" shape="square" />
        </Spec>
        <Spec name="danger">
          <IconButton label="Delete entry" icon={Trash2} variant="danger" size="sm" />
        </Spec>
        <Spec name="disabled">
          <IconButton label="Undo" icon={RotateCcw} disabled />
        </Spec>
        <Spec name="with a reason">
          <IconButton label="Undo" icon={RotateCcw} disabledReason="Nothing to undo yet." />
        </Spec>
      </Demo>

      <Demo
        label="Inline link"
        note="The one coloured text in running copy: blue-deep, always underlined."
      >
        <p className="max-w-prose text-body">
          Every estimate is explained on the <TextLink href="#data">methodology page</TextLink>,
          with the formula, the comparison and the source.
        </p>
      </Demo>
    </Section>
  );
}
