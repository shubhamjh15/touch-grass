'use client';

import type { ReactNode } from 'react';
import { useGameHydrated, useIsOnboarded } from '@/game';
import { BRAND } from '@/lib/brand';
import { Button, TextLink, UiLink } from '@/ui';
import { Main } from '../Main';
import { Logo } from '../nav/Logo';
import { ROUTES } from '../routes';

const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Methodology', href: ROUTES.methodology },
  { label: 'Privacy', href: ROUTES.privacy },
  { label: 'GitHub', href: BRAND.repoUrl },
];

/** "Plant your tree" for a visitor, "Open the app" for someone who already has one. */
function useCallToAction(): { label: string; href: string } {
  // The server and the first paint cannot know: they show the visitor's button.
  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  return hydrated && onboarded
    ? { label: 'Open the app', href: ROUTES.today }
    : { label: 'Plant your tree', href: ROUTES.start };
}

function MarketingHeader() {
  const action = useCallToAction();
  return (
    <header className="pt-(--safe-t)">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-6 px-gutter lg:h-16">
        <Logo href={ROUTES.landing} />
        <Button asChild size="sm" variant="secondary" className="ml-auto">
          <UiLink href={action.href}>{action.label}</UiLink>
        </Button>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 px-gutter pb-[max(32px,var(--safe-b))]">
        <p className="text-body-sm text-ink-2">
          {BRAND.name}. No account, no trackers: what you log stays on this device.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm font-semibold">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <TextLink
                  href={link.href}
                  rel={link.href.startsWith('/') ? undefined : 'noreferrer'}
                >
                  {link.label}
                </TextLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/**
 * The public shell (landing, methodology, privacy): the logo and one button above the page,
 * three links below it. It is pre-rendered, so nothing here reads the device during render.
 * Pages lay themselves out (`PageContainer` gives them the shared gutters).
 */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <MarketingHeader />
      <Main className="flex-1">{children}</Main>
      <MarketingFooter />
    </div>
  );
}
