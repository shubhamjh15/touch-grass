'use client';

import { ArrowRight, Github } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useGameHydrated, useIsOnboarded, useTreeStatus } from '@/game';
import { BRAND } from '@/lib/brand';
import { Button, LeafMark, Lettering, TextLink, UiLink } from '@/ui';
import { WorldStage } from '@/world';

/** Where "Back to the grove" goes: the app for someone with a tree, the front door for everyone else. */
function useWayHome(): { href: string; label: string } {
  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  return hydrated && onboarded
    ? { href: ROUTES.today, label: 'Back to the grove' }
    : { href: ROUTES.landing, label: 'Back to the start' };
}

/**
 * The 404. It never redirects: a mistyped address says so plainly and offers one way back. It
 * brings its own small frame (a logo bar and the two credibility links) because an unknown path
 * belongs to neither the app shell nor the public one.
 */
export default function NotFoundPage() {
  const home = useWayHome();
  const tree = useTreeStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[calc(64px+var(--safe-t))] items-center px-[max(16px,var(--safe-l))] pt-(--safe-t) lg:px-6">
        <UiLink
          href={ROUTES.landing}
          aria-label={`${BRAND.name}, home`}
          className="flex items-center gap-2.5 rounded-ctl"
        >
          <span className="grid size-[38px] -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1">
            <LeafMark size={22} />
          </span>
          <span className="text-h3 whitespace-nowrap">{BRAND.name}</span>
        </UiLink>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-center py-6 px-gutter outline-hidden"
      >
        <div className="mx-auto grid w-full max-w-[1100px] items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <WorldStage
            mode="companion"
            label={tree.sceneLabel}
            className="mx-auto h-60 w-full max-w-[22rem] lg:h-[26rem] lg:max-w-none"
          />
          <div className="grid justify-items-center gap-4 text-center lg:justify-items-start lg:text-left">
            <p className="type-slug text-ink-3">ERROR 404</p>
            <Lettering as="h1" fill="yellow" className="text-display-xl">
              Lost?
            </Lettering>
            <p className="max-w-[34ch] text-reading text-ink-2">
              This path leads nowhere. The grove is that way.
            </p>
            <Button asChild size="lg" variant="primary" iconRight={ArrowRight}>
              <UiLink href={home.href}>{home.label}</UiLink>
            </Button>
            <p className="text-body-sm text-ink-2">
              Or read <TextLink href={ROUTES.methodology}>how the numbers work</TextLink> and{' '}
              <TextLink href={ROUTES.privacy}>what stays on your device</TextLink>.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t-3 border-ink bg-white py-5 px-gutter pb-[max(20px,var(--safe-b))]">
        <p className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 text-body-sm">
          <span className="text-ink-2">
            Estimates, not measurements. Every figure links to its source.
          </span>
          <TextLink
            href={BRAND.repoUrl}
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
          >
            <Github size={16} strokeWidth={2.4} aria-hidden="true" />
            GitHub
          </TextLink>
        </p>
      </footer>
    </div>
  );
}
