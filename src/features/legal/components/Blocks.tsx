import { Info } from 'lucide-react';
import type { MethodologyBlock, PrivacyBlock } from '@/data/content';
import { cn } from '@/lib/cn';
import { Prose } from '@/ui';

/**
 * Renders the content modules' blocks (paragraph, list, formula, note) as running text.
 * The data owns the words; this owns how they look.
 */
export function Blocks({
  blocks,
  className,
}: {
  blocks: readonly (MethodologyBlock | PrivacyBlock)[];
  className?: string;
}) {
  return (
    <Prose className={cn('max-w-[68ch] max-md:text-[1rem]! max-md:leading-[1.55]!', className)}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'p':
            return <p key={key}>{block.text}</p>;
          case 'list':
            return (
              <ul key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case 'formula':
            return (
              <p
                key={key}
                className="not-prose my-4 rounded-ctl border-2 border-ink bg-paper px-3.5 py-3 font-mono text-data font-medium break-words"
              >
                {block.text}
              </p>
            );
          case 'note':
            return (
              <aside
                key={key}
                className="not-prose my-4 flex items-start gap-3 rounded-ctl border-3 border-ink bg-yellow-tint px-3.5 py-3 text-body-sm font-medium"
              >
                <Info size={18} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
                <p>{block.text}</p>
              </aside>
            );
        }
      })}
    </Prose>
  );
}
