'use client';

import { EVIDENCE_META } from '@/data/catalogue';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { Card, ColorBar, IconTile, Sheet } from '@/ui';
import type { RouteId } from '../routes';
import { openCoach, openPalette, useShellStore } from '../shellStore';
import { MORE_ENTRIES, type MoreEntry } from './navItems';

/* Under 360 px two columns leave about 70 px for words beside the icon: the icon sits above them instead. */
const TILE =
  'flex min-h-[72px] w-full items-center gap-3 p-3 text-left max-[359px]:flex-col max-[359px]:items-start max-[359px]:gap-2';

function MoreTile({
  entry,
  current,
  onDone,
}: {
  entry: MoreEntry;
  current: boolean;
  onDone: () => void;
}) {
  const Icon = entry.icon;
  const body = (
    <>
      <IconTile hue={entry.tone === 'yellow' ? 'yellow' : 'green'} className="size-8">
        <Icon size={18} strokeWidth={2.4} />
      </IconTile>
      <span className="grid min-w-0">
        <span className="truncate text-label">{entry.label}</span>
        <span className="line-clamp-2 text-caption text-ink-3">{entry.hint}</span>
      </span>
    </>
  );
  const tone = entry.tone === 'yellow' ? 'yellow' : current ? 'green' : 'card';

  if (entry.href) {
    return (
      <Card
        interactive
        padded={false}
        tone={tone}
        href={entry.href}
        aria-current={current ? 'page' : undefined}
        onClick={onDone}
        className={TILE}
      >
        {body}
      </Card>
    );
  }
  return (
    <Card
      interactive
      padded={false}
      tone={tone}
      onClick={() => {
        onDone();
        if (entry.command === 'coach') openCoach();
        else openPalette();
      }}
      className={cn(TILE, 'cursor-pointer')}
    >
      {body}
    </Card>
  );
}

/** The More sheet of the tab bar: everything that has no tab of its own. */
export function MoreSheet({ section }: { section: RouteId }) {
  const open = useShellStore((state) => state.moreOpen);
  const setOpen = useShellStore((state) => state.setMoreOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen} title="More">
      <nav aria-label="More pages">
        <ul className="grid grid-cols-2 gap-3">
          {MORE_ENTRIES.map((entry) => (
            <li key={entry.id} className="min-w-0">
              <MoreTile
                entry={entry}
                current={entry.id === section}
                onDone={() => setOpen(false)}
              />
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-5 mb-1 flex items-center justify-between gap-3 type-tick text-ink-3">
        <ColorBar size="xs" />
        <span>
          {BRAND.name} · factors v{EVIDENCE_META.factorsVersion}
        </span>
      </p>
    </Sheet>
  );
}
