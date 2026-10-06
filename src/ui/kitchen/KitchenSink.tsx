'use client';

import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { ColorBar, LeafMark, Lettering, SkipLink, Toaster } from '..';
import { ActionsSection } from './ActionsSection';
import { DataSection } from './DataSection';
import { InputsSection } from './InputsSection';
import { OverlaysSection } from './OverlaysSection';
import { RecipesSection } from './RecipesSection';
import { MotionSection, ProseSection, ScenesSection } from './ScenesSection';
import { HeadingsSection, StatesSection } from './StatesSection';
import { StickersSection } from './StickersSection';
import { SurfacesSection } from './SurfacesSection';
import { TokensSection } from './TokensSection';

const CHAPTERS = [
  { id: 'tokens', label: 'Tokens', Section: TokensSection },
  { id: 'recipes', label: 'Recipes', Section: RecipesSection },
  { id: 'actions', label: 'Actions', Section: ActionsSection },
  { id: 'surfaces', label: 'Surfaces', Section: SurfacesSection },
  { id: 'stickers', label: 'Stickers', Section: StickersSection },
  { id: 'inputs', label: 'Inputs', Section: InputsSection },
  { id: 'overlays', label: 'Overlays', Section: OverlaysSection },
  { id: 'data', label: 'Data', Section: DataSection },
  { id: 'states', label: 'States', Section: StatesSection },
  { id: 'headings', label: 'Headings', Section: HeadingsSection },
  { id: 'scenes', label: 'Backgrounds', Section: ScenesSection },
  { id: 'motion', label: 'Motion', Section: MotionSection },
  { id: 'prose', label: 'Prose', Section: ProseSection },
] as const;

/** Highlights the chapter that is currently under the sticky index. */
function useActiveChapter(): string {
  const [active, setActive] = useState<string>(CHAPTERS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-15% 0px -75% 0px' },
    );
    for (const chapter of CHAPTERS) {
      const node = document.getElementById(chapter.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

/**
 * The kitchen sink (`/__ui`, development builds only): every design-system component in every
 * variant and state, on the real backgrounds. It is the living reference for the page teams.
 */
export function KitchenSink() {
  const active = useActiveChapter();

  // The index scrolls sideways on small screens: keep the current chapter's chip in view.
  useEffect(() => {
    const list = document.getElementById('kit-chapters');
    const chip = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !chip) return;
    const target = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target) });
  }, [active]);

  return (
    <div className="min-h-dvh graph-paper text-ink">
      <SkipLink targetId="kit" />
      <header className="mx-auto max-w-(--content-max) pt-8 px-gutter pb-6 md:pt-12">
        <div className="flex items-center gap-2.5">
          <span className="grid size-[38px] -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1">
            <LeafMark size={24} />
          </span>
          <span className="text-h3">{BRAND.name}</span>
          <ColorBar className="ml-auto" />
        </div>
        <p className="mt-8 type-slug text-ink-3">Design system · living reference · dev only</p>
        <h1 className="mt-3 text-display-lg">
          <Lettering fill="green" hoverTilt>
            UI kit
          </Lettering>
        </h1>
        <p className="mt-4 max-w-[60ch] text-lead text-ink-2">
          Every component from the design bible, in every variant and state, on the mat, on paper
          and on the sky. Import from{' '}
          <code className="font-mono text-data font-semibold">@/ui</code>. If it is not here, it is
          not in the system yet.
        </p>
      </header>

      <nav
        aria-label="Chapters"
        className="sticky top-0 z-(--z-sticky) border-y-[1.5px] border-ink bg-mat"
      >
        <div className="mx-auto max-w-(--content-max) py-2 px-gutter">
          <ul id="kit-chapters" className="scroll-row gap-1.5">
            {CHAPTERS.map((chapter, index) => {
              const current = active === chapter.id;
              return (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    aria-current={current ? 'location' : undefined}
                    className={
                      current
                        ? 'inline-flex h-9 -rotate-[1.5deg] items-center gap-1.5 rounded-ctl border-3 border-ink bg-yellow px-3 text-label font-bold flat-2 focus-inset'
                        : 'inline-flex h-9 items-center gap-1.5 rounded-ctl border-3 border-transparent px-3 text-label focus-inset fine:hover:bg-mat-deep'
                    }
                  >
                    <span className="type-tick text-ink-3">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {chapter.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <main
        id="kit"
        tabIndex={-1}
        className="mx-auto grid max-w-(--content-max) gap-14 pt-8 px-gutter pb-24 outline-hidden"
      >
        {CHAPTERS.map(({ id, Section }, index) => (
          <Section key={id} index={index + 1} />
        ))}
      </main>

      <footer className="mx-auto flex max-w-(--content-max) items-center gap-3 border-t-3 border-ink py-6 px-gutter">
        <ColorBar />
        <p className="type-tick text-ink-3">
          End of the kit · follow the design bible where this page is silent
        </p>
      </footer>
      <Toaster />
    </div>
  );
}
