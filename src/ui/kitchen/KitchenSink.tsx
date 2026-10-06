'use client';

import { BRAND } from '@/lib/brand';
import { PageHeader } from '../headings';
import { SkipLink } from '../misc';
import { PageContainer } from '../PageContainer';
import { Toaster } from '../Toaster';
import { ActionsChapter } from './ActionsChapter';
import { DataChapter } from './DataChapter';
import { FoundationsChapter } from './FoundationsChapter';
import { InputsChapter } from './InputsChapter';
import { OverlaysChapter } from './OverlaysChapter';
import { PageChapter } from './PageChapter';
import { SurfacesChapter } from './SurfacesChapter';

const CHAPTERS = [
  { id: 'foundations', label: 'Foundations', Chapter: FoundationsChapter },
  { id: 'actions', label: 'Buttons', Chapter: ActionsChapter },
  { id: 'surfaces', label: 'Surfaces', Chapter: SurfacesChapter },
  { id: 'inputs', label: 'Inputs', Chapter: InputsChapter },
  { id: 'overlays', label: 'Overlays', Chapter: OverlaysChapter },
  { id: 'data', label: 'Numbers', Chapter: DataChapter },
  { id: 'page', label: 'Pages', Chapter: PageChapter },
] as const;

/**
 * The workbench at `/__ui` (development builds only): the calm system on one page, each part in its
 * default form. Page owners compose from these; if something is not here, it is not in the system.
 */
export function KitchenSink() {
  return (
    <div className="min-h-dvh bg-mat text-ink">
      <SkipLink targetId="kit" />
      <PageContainer as="main" id="kit" tabIndex={-1} sections className="pb-24 outline-hidden">
        <div>
          <PageHeader
            size="display"
            title={`${BRAND.name} UI kit`}
            lead="The calm system: a plain mint page, one card, three button levels and plenty of air. Import everything from @/ui."
          />
          <nav aria-label="Chapters" className="mt-6">
            <ul className="scroll-row gap-2">
              {CHAPTERS.map((chapter) => (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    className="inline-flex h-11 items-center rounded-pill border-2 border-ink bg-white px-4 text-body-sm font-semibold fine:hover:bg-mat-deep"
                  >
                    {chapter.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {CHAPTERS.map(({ id, Chapter }) => (
          <Chapter key={id} />
        ))}
      </PageContainer>
      <Toaster />
    </div>
  );
}
