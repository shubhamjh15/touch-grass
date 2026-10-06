'use client';

import { CircleStop, EllipsisVertical, Info, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatCo2Parts } from '@/lib/format';
import { Approx } from '../Approx';
import { Button } from '../Button';
import { Co2e } from '../Co2e';
import { DropdownMenu } from '../DropdownMenu';
import { HonestyMark } from '../HonestyMark';
import { IconButton } from '../IconButton';
import { ConfirmDialog } from '../misc';
import { Modal } from '../Modal';
import { Popover } from '../Popover';
import { Segmented } from '../Segmented';
import { BottomSheet, Sheet } from '../Sheet';
import { Sticker } from '../Sticker';
import { toast } from '../toast';
import { Tooltip } from '../Tooltip';
import { Chapter, Demo } from './parts';
import { SAMPLE_SOURCE } from './sample';

const KM = [
  { value: '2', label: '2 km' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
] as const;

type Km = (typeof KM)[number]['value'];

const KG_PER_KM = 0.171;

function LogSheetDemo() {
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState<Km>('5');
  const estimate = formatCo2Parts(Number(km) * KG_PER_KM);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>Open a bottom sheet</Button>}
      title="Cycled instead of driving"
      description="How far did you go?"
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => {
            setOpen(false);
            toast({
              title: 'Logged. +30 XP',
              category: 'move',
              action: { label: 'Undo', onClick: () => undefined },
              duration: 8000,
            });
          }}
        >
          Log it
        </Button>
      }
    >
      <div className="flex items-center gap-4">
        <Sticker category="move" size={44} />
        <Segmented aria-label="Distance" value={km} onValueChange={setKm} options={KM} fullWidth />
      </div>
      <p className="mt-5 flex items-center gap-2 text-h2">
        <HonestyMark source={SAMPLE_SOURCE} />
        <span>
          <span className="sr-only">approximately </span>
          {estimate.value} {estimate.unit} <Co2e />
        </span>
      </p>
      <p className="mt-1 text-body-sm text-ink-3">Compared with driving the same trip.</p>
    </BottomSheet>
  );
}

export function OverlaysChapter() {
  const [confirm, setConfirm] = useState(false);
  const saved = formatCo2Parts(1.02);

  return (
    <Chapter
      id="overlays"
      title="Overlays"
      rule="Secondary things open on top and close with Esc. Focus is trapped while they are open and goes back where it came from."
    >
      <Demo
        title="Bottom sheet"
        note="Rises from the bottom edge, takes its height from its content, and keeps its one button above the home indicator. Drag it down, press Esc or use the close button."
      >
        <LogSheetDemo />
        <Sheet
          side="right"
          trigger={<Button>Open a drawer</Button>}
          title="Ask Moss"
          description="A drawer sits at the right edge on desktop."
        >
          <p className="text-body text-ink-2">The coach opens here, beside the page.</p>
        </Sheet>
      </Demo>

      <Demo title="Dialog" note="Below tablet width every dialog becomes a bottom sheet.">
        <Modal
          trigger={<Button>Open a dialog</Button>}
          title="Take a Touch grass break"
          description="Two minutes outside, no phone. We will keep the time."
          footer={
            <>
              <Button>Not now</Button>
              <Button variant="primary">Start the break</Button>
            </>
          }
        />
        <Button onClick={() => setConfirm(true)}>Ask before deleting</Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Clear this chat?"
          description="The messages are removed from this device."
          confirmLabel="Clear chat"
          destructive
          onConfirm={() => toast({ title: 'Chat cleared' })}
        />
      </Demo>

      <Demo title="Menu, popover, tooltip" className="items-center">
        <DropdownMenu
          label="Chat options"
          trigger={
            <IconButton
              label="Chat options"
              icon={EllipsisVertical}
              variant="ghost"
              tooltipSide={null}
            />
          }
          items={[
            { label: 'Stop', icon: CircleStop, onSelect: () => undefined },
            { label: 'Try again', icon: RotateCcw, onSelect: () => undefined },
            { label: 'Clear chat', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
        <Popover trigger={<Button icon={Info}>Why this number?</Button>} label="About this number">
          <p className="text-body-sm text-ink-2">
            A popover holds a short explanation. Anything longer belongs in a sheet.
          </p>
        </Popover>
        <Tooltip content="Tooltips name things. They never hold the only copy of anything.">
          <Button variant="link">Hover or focus me</Button>
        </Tooltip>
      </Demo>

      <Demo
        title="Toasts"
        note="One bold line, one quiet line, one action at most. Top of the screen on phones, bottom-right on desktop."
      >
        <Button
          onClick={() =>
            toast({
              title: 'Logged. +30 XP',
              meta: (
                <>
                  <Approx />
                  {saved.value} {saved.unit} <Co2e />
                </>
              ),
              category: 'move',
              action: { label: 'Undo', onClick: () => undefined },
              duration: 8000,
            })
          }
        >
          After logging
        </Button>
        <Button onClick={() => toast({ title: 'Claimed 40 XP', tone: 'success' })}>Success</Button>
        <Button
          onClick={() =>
            toast({
              title: "Couldn't reach Moss",
              meta: 'Your message is still in the box.',
              tone: 'danger',
            })
          }
        >
          Something failed
        </Button>
      </Demo>
    </Chapter>
  );
}
