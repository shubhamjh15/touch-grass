'use client';

import { cn } from '@/lib/cn';
import { UiLink } from '@/ui';
import type { RouteId } from '../routes';
import { TAB_ITEMS, type NavItem } from './navItems';

function Tab({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  return (
    <UiLink
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-16 flex-col items-center justify-center gap-0.5 rounded-ctl text-body-sm',
        current ? 'font-bold text-ink' : 'text-ink-3',
      )}
    >
      <span
        className={cn('grid h-7 w-12 place-items-center rounded-pill', current && 'bg-mat-deep')}
      >
        <Icon size={20} strokeWidth={current ? 2.25 : 1.75} aria-hidden="true" />
      </span>
      {item.label}
    </UiLink>
  );
}

/** The centre tab: the one green thing in the bar, raised a little so the thumb finds it. */
function LogTab({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  return (
    <UiLink
      href={item.href}
      aria-label="Log an action"
      aria-current={current ? 'page' : undefined}
      className="group flex h-16 flex-col items-center justify-end gap-0.5 rounded-ctl pb-1.5 text-body-sm font-bold text-ink"
    >
      <span className="-mt-5 grid size-14 place-items-center rounded-full border-2 border-ink bg-green shadow-2 transition-transform duration-(--dur-press) group-active:translate-x-[3px] group-active:translate-y-[3px] group-active:shadow-none">
        <Icon size={26} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span aria-hidden="true">{item.label}</span>
    </UiLink>
  );
}

/** The navigation of the phone layout: Today, Quests, Log, Learn, Me. */
export function TabBar({ section }: { section: RouteId }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-(--z-nav) border-t-2 border-line bg-white px-[max(4px,var(--safe-l))] pb-(--safe-b)"
    >
      <ul className="mx-auto grid h-16 max-w-[520px] grid-cols-5">
        {TAB_ITEMS.map((item) => (
          <li key={item.id} className="min-w-0">
            {item.id === 'log' ? (
              <LogTab item={item} current={section === 'log'} />
            ) : (
              <Tab item={item} current={item.id === section} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
