'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Kbd, Modal } from '@/ui';
import { NAV_ITEMS } from '../nav/navItems';
import { ROUTES } from '../routes';
import { openCoach, useShellStore } from '../shellStore';
import { isTypingTarget } from './commands';

// cmdk and the catalogue search stay out of the first load: the chunk arrives on first open.
const CommandMenu = dynamic(() => import('./CommandMenu'), { ssr: false });

/** How long `G` waits for its second key. */
const GO_WINDOW_MS = 1200;

const anyDialogOpen = () =>
  document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]') !== null;

const SHORTCUTS: readonly { keys: readonly string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'Search and commands (⌘ K on a Mac)' },
  { keys: ['/'], label: 'Search and commands' },
  { keys: ['L'], label: 'Log an action' },
  { keys: ['C'], label: 'Ask Moss' },
  ...NAV_ITEMS.map((item) => ({
    keys: ['G', item.key.toUpperCase()],
    label: `Go to ${item.label}`,
  })),
  { keys: ['F6'], label: 'Move between the page and the coach drawer' },
  { keys: ['Esc'], label: 'Close a sheet, or skip a celebration' },
  { keys: ['?'], label: 'This list' },
];

function ShortcutsSheet() {
  const open = useShellStore((state) => state.shortcutsOpen);
  const setOpen = useShellStore((state) => state.setShortcutsOpen);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Keyboard shortcuts"
      description="Single keys work whenever you are not typing in a field."
      size="sm"
    >
      <dl className="grid gap-0 divide-y-[1.5px] divide-line">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={`${shortcut.keys.join('+')}-${shortcut.label}`}
            className="flex min-h-10 items-center justify-between gap-4 py-1.5"
          >
            <dt className="text-body-sm">{shortcut.label}</dt>
            <dd className="flex shrink-0 items-center gap-1">
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

/**
 * The keyboard layer of the app shell and the palette it opens (bible 4.10): Ctrl or Cmd + K
 * and "/" for the palette, `L` to log, `C` for the coach, `G` then a letter to go somewhere,
 * `?` for the list. Single keys are ignored while typing and while a dialog is open.
 */
export function Shortcuts() {
  const router = useRouter();
  const paletteOpen = useShellStore((state) => state.paletteOpen);
  // Once opened, the palette stays mounted so its exit can play and reopening is instant.
  const [paletteLoaded, setPaletteLoaded] = useState(false);
  if (paletteOpen && !paletteLoaded) setPaletteLoaded(true);
  const goArmedUntil = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const shell = useShellStore.getState();

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key === 'k') {
        event.preventDefault();
        shell.setPaletteOpen(!shell.paletteOpen);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || anyDialogOpen()) return;

      const armed = event.timeStamp < goArmedUntil.current;
      goArmedUntil.current = 0;
      if (armed) {
        const destination = NAV_ITEMS.find((item) => item.key === key);
        if (destination) {
          event.preventDefault();
          router.push(destination.href);
        }
        return;
      }

      switch (key) {
        case '/':
          event.preventDefault();
          shell.setPaletteOpen(true);
          break;
        case '?':
          event.preventDefault();
          shell.setShortcutsOpen(true);
          break;
        case 'g':
          goArmedUntil.current = event.timeStamp + GO_WINDOW_MS;
          break;
        case 'l':
          event.preventDefault();
          router.push(ROUTES.log);
          break;
        case 'c':
          event.preventDefault();
          openCoach();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <>
      {paletteLoaded ? <CommandMenu /> : null}
      <ShortcutsSheet />
    </>
  );
}
