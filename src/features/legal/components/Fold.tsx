import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A native disclosure in the sticker style: findable with the browser's search, works with no
 * script and keeps its place in the print layout (which opens every fold, see `print:` rules).
 */
export function Fold({
  title,
  meta,
  summary,
  defaultOpen = false,
  id,
  children,
  className,
}: {
  title: ReactNode;
  /** A mono slug at the right of the title: "55 SOURCES". */
  meta?: ReactNode;
  /** One quiet line under the title, visible while the fold is closed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        'group/fold scroll-mt-24 rounded-md border-3 border-ink bg-card shadow-2 target:bg-yellow-tint md:rounded-lg md:border-4 md:shadow-3',
        className,
      )}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[inherit] px-4 py-3 text-left outline-offset-2 md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-h4 font-bold">{title}</span>
          {summary ? <span className="text-body-sm text-ink-2">{summary}</span> : null}
        </span>
        {meta ? <span className="type-slug text-ink-3 max-sm:hidden">{meta}</span> : null}
        <ChevronDown
          size={22}
          strokeWidth={2.5}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-(--dur-fast) ease-out group-open/fold:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="border-t-2 border-dashed border-ink-4 p-4 md:p-5">{children}</div>
    </details>
  );
}
