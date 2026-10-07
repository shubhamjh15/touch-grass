'use client';

import { ArrowRight, Github } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { Button, ColorBar, LeafMark, OfflineBanner, TextLink, UiLink } from '@/ui';
import { useBootHydrated, useBootOnboarded } from '../boot/bootStore';
import { Main } from '../Main';
import { Logo } from '../nav/Logo';
import { ROUTES, routeInfo, type RouteId } from '../routes';

const HEADER_LINKS: readonly { id: RouteId; label: string; href: string }[] = [
  { id: 'landing', label: 'How it works', href: `${ROUTES.landing}#how-it-works` },
  { id: 'methodology', label: 'Methodology', href: ROUTES.methodology },
  { id: 'privacy', label: 'Privacy', href: ROUTES.privacy },
];

const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Methodology', href: ROUTES.methodology },
  { label: 'Privacy', href: ROUTES.privacy },
];

/** "Plant your tree" for a visitor, "Open the app" for someone who already has one. */
function useCallToAction(): { label: string; href: string } {
  // The server and the first paint cannot know: they show the visitor's button.
  const hydrated = useBootHydrated();
  const onboarded = useBootOnboarded();
  return hydrated && onboarded
    ? { label: 'Open the app', href: ROUTES.today }
    : { label: 'Plant your tree', href: ROUTES.start };
}

function MarketingHeader({ section }: { section: RouteId }) {
  const action = useCallToAction();
  return (
    <header className="z-(--z-nav) flex h-[calc(64px+var(--safe-t))] items-center gap-2 px-[max(16px,var(--safe-l))] pt-(--safe-t) max-lg:relative lg:fixed lg:inset-x-6 lg:top-4 lg:mx-auto lg:h-16 lg:max-w-[1392px] lg:rounded-lg lg:border-4 lg:border-ink lg:bg-white lg:px-3.5 lg:pt-0 lg:shadow-3">
      <Logo href={ROUTES.landing} className="mr-3" />
      <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
        {HEADER_LINKS.map((link) => {
          const current = link.id === section && link.id !== 'landing';
          return (
            <UiLink
              key={link.href}
              href={link.href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 items-center rounded-ctl border-3 px-3.5 text-label whitespace-nowrap',
                current
                  ? '-rotate-[1.5deg] border-ink bg-yellow font-bold flat-3'
                  : 'border-transparent fine:hover:bg-mat-deep',
              )}
            >
              {link.label}
            </UiLink>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2.5">
        <OfflineBanner className="max-md:hidden" />
        <Button asChild size="sm" variant="primary" iconRight={ArrowRight}>
          <UiLink href={action.href}>{action.label}</UiLink>
        </Button>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="relative z-(--z-content) border-t-3 border-ink bg-white">
      <div className="mx-auto grid w-full max-w-[1392px] gap-6 py-8 px-gutter pb-[max(32px,var(--safe-b))] md:grid-cols-[1fr_auto] md:items-end lg:px-6">
        <div className="grid gap-3">
          <p className="flex items-center gap-2.5">
            <span className="grid size-8 -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1">
              <LeafMark size={18} />
            </span>
            <span className="text-h4">{BRAND.name}</span>
          </p>
          <p className="max-w-[46ch] text-body-sm text-ink-2">
            {BRAND.tagline} No account, no trackers: everything you log stays on this device.
          </p>
          <ColorBar size="sm" />
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-4 text-body-sm font-semibold">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <TextLink href={link.href} className="hit-3">
                  {link.label}
                </TextLink>
              </li>
            ))}
            <li>
              <TextLink
                href={BRAND.repoUrl}
                rel="noreferrer"
                className="hit-3 inline-flex items-center gap-1.5"
              >
                <Github size={16} strokeWidth={2.4} aria-hidden="true" />
                GitHub
              </TextLink>
            </li>
          </ul>
          <p className="mt-3 type-tick text-ink-3 md:text-right">
            Estimates, not measurements. Every figure links to its source.
          </p>
        </nav>
      </div>
    </footer>
  );
}

/**
 * The public shell (landing, methodology, privacy): a header with the logo and one call to
 * action, the page, and a footer with the credibility links. It is pre-rendered, so nothing
 * here reads the device during render.
 */
export function MarketingLayout({ children }: { children: ReactNode }) {
  const info = routeInfo(usePathname() ?? '/');
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader section={info.section} />
      {/* Reading pages start below the floating bar; the landing page runs under it. */}
      <Main className={cn('flex-1', info.frame === 'reading' && 'lg:pt-28')}>{children}</Main>
      <MarketingFooter />
    </div>
  );
}
