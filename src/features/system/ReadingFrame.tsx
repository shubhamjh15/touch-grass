import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContentsItem {
  id: string;
  label: string;
}

/**
 * The column every public reading page sits in: the site's 1392 px frame, an optional contents
 * list pinned beside the text on a laptop, and the same contents as a fold above it on a phone.
 * Pure markup, so the page is fully server-rendered and works with no script.
 */
export function ReadingFrame({
  contents,
  contentsLabel = 'On this page',
  children,
  className,
}: {
  contents?: readonly ContentsItem[];
  contentsLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1392px] pt-4 px-gutter pb-14 lg:px-6 lg:pt-2 lg:pb-20">
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
        {contents ? (
          <>
            <aside className="hidden lg:col-span-3 lg:block print:hidden">
              <nav aria-label={contentsLabel} className="sticky top-28">
                <p className="mb-3 type-slug text-ink-3">{contentsLabel}</p>
                <ol className="grid gap-0.5 border-l-3 border-ink">
                  {contents.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="-ml-[3px] flex min-h-10 items-center border-l-3 border-transparent py-1.5 pr-2 pl-3.5 text-body-sm font-semibold text-ink-2 outline-offset-2 fine:hover:border-ink fine:hover:bg-yellow-tint fine:hover:text-ink"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
            <details className="group rounded-md border-3 border-ink bg-card shadow-2 lg:hidden print:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-label font-bold [&::-webkit-details-marker]:hidden">
                {contentsLabel}
                <span
                  aria-hidden="true"
                  className="type-slug text-ink-3 group-open:hidden after:content-['SHOW']"
                />
                <span
                  aria-hidden="true"
                  className="hidden type-slug text-ink-3 group-open:inline after:content-['HIDE']"
                />
              </summary>
              <nav aria-label={contentsLabel} className="border-t-2 border-dashed border-ink-4 p-2">
                <ol className="grid sm:grid-cols-2">
                  {contents.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="flex min-h-11 items-center rounded-xs px-2.5 text-body-sm font-semibold active:bg-yellow-tint"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          </>
        ) : null}
        <div className={cn('min-w-0', contents ? 'lg:col-span-9' : 'lg:col-span-12', className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
