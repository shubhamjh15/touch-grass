'use client';

import {
  BookOpen,
  ChartColumn,
  Download,
  Ellipsis,
  Info,
  Leaf,
  Pencil,
  Sprout,
  Target,
  Timer,
  Trash2,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Approx } from '../Approx';
import { Button } from '../Button';
import { Co2e } from '../Co2e';
import { DropdownMenu } from '../DropdownMenu';
import { Field } from '../Field';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Kbd } from '../Kbd';
import { ConfirmDialog } from '../misc';
import { Modal } from '../Modal';
import { Popover } from '../Popover';
import { Sheet } from '../Sheet';
import { Sticker } from '../Sticker';
import { Tag } from '../Tag';
import { toast } from '../toast';
import { ToastCard } from '../ToastCard';
import { Tooltip } from '../Tooltip';
import { Demo, Section } from './parts';

const palette = () => import('../command');
const CommandPalette = lazy(() => palette().then((module) => ({ default: module.CommandPalette })));
const CommandGroup = lazy(() => palette().then((module) => ({ default: module.CommandGroup })));
const CommandItem = lazy(() => palette().then((module) => ({ default: module.CommandItem })));

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="neutral" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <CommandPalette open={open} onOpenChange={setOpen} query={query} onQueryChange={setQuery}>
            <CommandGroup heading="Log">
              <CommandItem
                value="Cycled instead of driving 5 km"
                onSelect={close}
                leading={<Sticker category="move" size={32} rotate={0} className="scale-75" />}
                trailing={
                  <>
                    <span>
                      <Approx weight="mono" />
                      0.86 kg
                    </span>
                    <Tag hue="yellow">MOVE-02</Tag>
                  </>
                }
              >
                Cycled instead of driving · 5 km
              </CommandItem>
              <CommandItem
                value="Veggie meal"
                onSelect={close}
                leading={<Sticker category="eat" size={32} rotate={0} className="scale-75" />}
                trailing={<Tag hue="yellow">EAT-01</Tag>}
              >
                Veggie meal
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Go to">
              <CommandItem
                value="Today"
                onSelect={close}
                leading={<Sprout size={20} strokeWidth={2.25} aria-hidden="true" />}
                trailing={
                  <>
                    <Kbd>G</Kbd>
                    <Kbd>T</Kbd>
                  </>
                }
              >
                Today
              </CommandItem>
              <CommandItem
                value="Quests"
                onSelect={close}
                leading={<Target size={20} strokeWidth={2.25} aria-hidden="true" />}
                trailing={
                  <>
                    <Kbd>G</Kbd>
                    <Kbd>Q</Kbd>
                  </>
                }
              >
                Quests
              </CommandItem>
              <CommandItem
                value="Learn"
                onSelect={close}
                leading={<BookOpen size={20} strokeWidth={2.25} aria-hidden="true" />}
              >
                Learn
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Data">
              <CommandItem
                value="Export my data"
                onSelect={close}
                leading={<Download size={20} strokeWidth={2.25} aria-hidden="true" />}
              >
                Export my data
              </CommandItem>
            </CommandGroup>
          </CommandPalette>
        </Suspense>
      ) : null}
    </>
  );
}

export function OverlaysSection({ index }: { index: number }) {
  const [modal, setModal] = useState(false);
  const [bottom, setBottom] = useState(false);
  const [right, setRight] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [treeName, setTreeName] = useState('Fern');

  return (
    <Section
      id="overlays"
      index={index}
      title="Overlays"
      note="Pressed onto the page over a halftone scrim · Esc closes everything · focus returns"
    >
      <Demo
        label="Modal, Sheet, ConfirmDialog"
        note="Below md every Modal renders as a bottom Sheet. Sheets drag down by their header; the close button is always there."
      >
        <Button variant="neutral" onClick={() => setModal(true)}>
          Open a modal
        </Button>
        <Button variant="neutral" onClick={() => setBottom(true)}>
          Open a bottom sheet
        </Button>
        <Button variant="neutral" onClick={() => setRight(true)}>
          Open the drawer
        </Button>
        <Button variant="neutral" icon={Trash2} onClick={() => setConfirm(true)}>
          Reset data
        </Button>

        <Modal
          open={modal}
          onOpenChange={setModal}
          title="Rename your tree"
          description="It keeps every ring. Only the name on the tag changes."
          size="sm"
          footer={
            <>
              <Button variant="neutral" onClick={() => setModal(false)}>
                Keep it
              </Button>
              <Button variant="primary" icon={Pencil} onClick={() => setModal(false)}>
                Rename
              </Button>
            </>
          }
        >
          <Field label="Name" hint="Up to 24 characters.">
            <Input
              value={treeName}
              onChange={(event) => setTreeName(event.target.value)}
              maxLength={24}
            />
          </Field>
        </Modal>

        <Sheet
          open={bottom}
          onOpenChange={setBottom}
          title="More"
          footer={
            <>
              <Button variant="primary" fullWidth onClick={() => setBottom(false)}>
                Done
              </Button>
              <Button variant="neutral" fullWidth onClick={() => setBottom(false)}>
                Not now
              </Button>
            </>
          }
        >
          <ul className="grid grid-cols-2 gap-3">
            {[
              { label: 'Impact', icon: ChartColumn },
              { label: 'Community', icon: Users },
              { label: 'Touch grass', icon: Timer },
              { label: 'Methodology', icon: Leaf },
            ].map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex h-[72px] items-center gap-3 rounded-md border-3 border-ink p-3"
              >
                <Icon size={24} strokeWidth={2.25} aria-hidden="true" />
                <span className="text-label">{label}</span>
              </li>
            ))}
          </ul>
        </Sheet>

        <Sheet
          open={right}
          onOpenChange={setRight}
          side="right"
          modal={false}
          title="Moss"
          headerExtra={<Tag hue="yellow">Built-in</Tag>}
          description="A non-modal drawer: the page stays usable, Esc closes, F6 moves between page and drawer."
        >
          <div className="max-w-[88%] rounded-md rounded-tl-paper border-2 border-ink p-3">
            <p className="type-slug text-ink-3">Moss · 14:32</p>
            <p className="mt-1.5 text-body">
              Two short rides this week already. Want an easy third?
            </p>
          </div>
        </Sheet>

        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Reset everything?"
          description="This removes your tree, logs and badges from this device. Export first if you want a copy."
          confirmLabel="Reset data"
          destructive
          onConfirm={() =>
            toast({ title: 'Nothing was reset. This is the kitchen sink.', tone: 'info' })
          }
        />
      </Demo>

      <Demo label="Tooltip, Popover, DropdownMenu" className="items-center">
        <Tooltip content="Opens after 400 ms. Never essential content.">
          <Button variant="neutral">Hover or focus me</Button>
        </Tooltip>
        <Popover
          trigger={<Button variant="neutral">Open a popover</Button>}
          label="What Moss knows"
        >
          <p className="type-slug text-ink-3">What Moss knows</p>
          <p className="mt-2 text-body-sm">
            Your level, your streak and this week&rsquo;s totals. Never your notes, never your name.
          </p>
        </Popover>
        <Popover
          trigger={<IconButton label="What Moss knows" icon={Info} size="sm" />}
          tone="paper"
          width={260}
        >
          <p className="type-slug text-ink-3">Printed matter</p>
          <p className="mt-2 font-mono text-data">
            5 km × 0.171 kg/km = <Approx weight="mono" />
            0.86 kg <Co2e />
          </p>
        </Popover>
        <DropdownMenu
          label="More pages"
          trigger={
            <Button variant="neutral" icon={Ellipsis}>
              More
            </Button>
          }
          items={[
            { label: 'Impact', icon: ChartColumn, href: '#data', current: true },
            { label: 'Community', icon: Users, href: '#surfaces' },
            {
              label: 'Export my data',
              icon: Download,
              onSelect: () => toast({ title: 'Export is a demo here.' }),
            },
            { label: 'Sync', icon: Leaf, disabled: true },
            { label: 'Reset data', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
      </Demo>

      <Demo
        label="Toast"
        note="A mini receipt. 4 s; 8 s with Undo (a stepping timer bar); errors stay until dismissed."
      >
        <Button
          variant="primary"
          onClick={() =>
            toast({
              title: 'Stuck. Fern grew 6 leaves.',
              category: 'move',
              meta: (
                <>
                  <Approx weight="mono" />
                  1.02 kg <Co2e /> · +30 XP
                </>
              ),
              action: {
                label: 'Undo',
                onClick: () => toast({ title: 'Peeled off. Back to how it was.' }),
              },
            })
          }
        >
          Log toast
        </Button>
        <Button
          variant="neutral"
          onClick={() => toast({ title: 'Fireflies arrived.', tone: 'success' })}
        >
          Success
        </Button>
        <Button
          variant="neutral"
          onClick={() => toast({ title: 'Update ready. Reload when you like.', tone: 'info' })}
        >
          Info
        </Button>
        <Button
          variant="neutral"
          onClick={() =>
            toast({
              title: "Couldn't reach Moss.",
              meta: 'Your message is still in the box.',
              tone: 'danger',
            })
          }
        >
          Error
        </Button>
        <div className="grid w-full gap-3 pt-2">
          <ToastCard
            title="Stuck. Fern grew 6 leaves."
            category="move"
            meta={
              <>
                <Approx weight="mono" />
                1.02 kg <Co2e /> · +30 XP
              </>
            }
            action={{ label: 'Undo', onClick: () => undefined }}
          />
          <ToastCard title="Claimed. +50 XP" tone="success" />
          <ToastCard
            title="Couldn't reach Moss."
            meta="Your message is still in the box."
            tone="danger"
          />
        </div>
      </Demo>

      <Demo
        label="CommandPalette"
        note="cmdk inside a Radix Dialog; a full-height sheet below lg. Lazy: imported from @/ui/command on first open."
      >
        <PaletteDemo />
      </Demo>
    </Section>
  );
}
