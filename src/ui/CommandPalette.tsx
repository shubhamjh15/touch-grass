'use client';

import { Command } from 'cmdk';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { Kbd } from './Kbd';
import { Sheet } from './Sheet';
import { useFocusReturn } from './useFocusReturn';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Controlled search text. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Accessible name of the dialog and the input. */
  label?: string;
  placeholder?: string;
  /** Shown when nothing matches. */
  emptyMessage?: ReactNode;
  /** Set false when the caller filters and ranks the items itself (quantity parsing). */
  shouldFilter?: boolean;
  /** `CommandGroup`s of `CommandItem`s. */
  children: ReactNode;
}

function PaletteBody({
  query,
  onQueryChange,
  label,
  placeholder,
  emptyMessage,
  shouldFilter,
  desktop,
  children,
}: Omit<CommandPaletteProps, 'open' | 'onOpenChange'> & { desktop: boolean }) {
  return (
    <Command
      label={label}
      shouldFilter={shouldFilter}
      loop
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b-[1.5px] border-ink px-4">
        <Search size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-ink-3" />
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-lead shadow-none outline-hidden placeholder:text-ink-4"
        />
        {desktop ? <Kbd>Esc</Kbd> : null}
      </div>
      <Command.List
        className={cn(
          'min-h-0 flex-1 [scroll-padding-block:8px] overflow-y-auto overscroll-contain p-2',
          desktop && 'max-h-[min(52dvh,420px)]',
        )}
      >
        <Command.Empty className="px-3 py-8 text-center text-body-sm text-ink-2">
          {emptyMessage}
        </Command.Empty>
        {children}
      </Command.List>
      {desktop ? (
        <div className="flex h-10 shrink-0 items-center gap-4 border-t-[1.5px] border-ink px-4 type-slug text-ink-3">
          <span className="flex items-center gap-1.5">
            <Kbd aria-label="Up arrow">
              <ArrowUp size={12} strokeWidth={2.5} aria-hidden="true" />
            </Kbd>
            <Kbd aria-label="Down arrow">
              <ArrowDown size={12} strokeWidth={2.5} aria-hidden="true" />
            </Kbd>
            Move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd>
            Run
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            Close
          </span>
        </div>
      ) : null}
    </Command>
  );
}

/**
 * The command palette shell: cmdk inside a Radix Dialog at `lg` and up, a full-height bottom Sheet
 * below. The shell supplies groups, items and what they do. Import it from `@/ui/command` and load it
 * lazily on first open, so cmdk stays out of the main bundle.
 */
export function CommandPalette({
  open,
  onOpenChange,
  label = 'Search and commands',
  placeholder = 'Search actions, pages, settings…',
  emptyMessage = 'No match. Press Enter to ask Moss.',
  ...body
}: CommandPaletteProps) {
  const desktop = useBreakpoint('lg');
  const focusReturn = useFocusReturn();

  if (!desktop) {
    return (
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={label}
        tall
        bodyClassName="flex flex-col px-0 pt-0 pb-0"
      >
        <PaletteBody
          label={label}
          placeholder={placeholder}
          emptyMessage={emptyMessage}
          desktop={false}
          {...body}
        />
      </Sheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-palette) scrim data-[state=closed]:animate-scrim-out data-[state=open]:animate-scrim-in" />
        <Dialog.Content
          {...focusReturn}
          aria-describedby={undefined}
          className="fixed top-[18vh] left-1/2 z-(--z-palette) flex w-[min(100vw-32px,640px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border-4 border-ink bg-card text-ink shadow-5 outline-hidden data-[state=closed]:animate-peel data-[state=open]:animate-stick"
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <PaletteBody
            label={label}
            placeholder={placeholder}
            emptyMessage={emptyMessage}
            desktop
            {...body}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type CommandGroupProps = Omit<ComponentProps<typeof Command.Group>, 'heading'> & {
  /** Mono group heading: "LOG", "GO TO". */
  heading: string;
};

export function CommandGroup({ heading, className, ...rest }: CommandGroupProps) {
  return (
    <Command.Group
      heading={heading}
      className={cn(
        '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:type-slug [&_[cmdk-group-heading]]:text-ink-3',
        className,
      )}
      {...rest}
    />
  );
}

export type CommandItemProps = Omit<ComponentProps<typeof Command.Item>, 'children'> & {
  /** A 24 px sticker or a 20 px icon. */
  leading?: ReactNode;
  /** Mono value, `Tag` or `Kbd` hints on the right. */
  trailing?: ReactNode;
  children: ReactNode;
};

/** One result row. Selected = yellow tint, bold, and a 4 px ink bar on the left (never colour alone). */
export function CommandItem({ leading, trailing, className, children, ...rest }: CommandItemProps) {
  return (
    <Command.Item
      className={cn(
        'relative flex h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-body text-ink select-none before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-pill before:bg-ink before:opacity-0 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-ink-4 data-[selected=true]:bg-yellow-tint data-[selected=true]:font-bold data-[selected=true]:before:opacity-100',
        className,
      )}
      {...rest}
    >
      {leading ? <span className="grid w-6 shrink-0 place-items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-data font-medium text-ink-2">
          {trailing}
        </span>
      ) : null}
    </Command.Item>
  );
}
