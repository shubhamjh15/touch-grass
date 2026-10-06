import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, type CardTone } from '@/ui';

const ICON: Record<'yes' | 'no', { icon: LucideIcon; label: string; tone: string }> = {
  yes: { icon: Check, label: 'Yes', tone: 'bg-green' },
  no: { icon: X, label: 'No', tone: 'bg-pink' },
};

/** A titled list of statements with a tick or a cross: what we claim and do not, what we do and never do. */
export function ListCard({
  title,
  items,
  mark,
  tone,
  className,
}: {
  title: string;
  items: readonly string[];
  mark: 'yes' | 'no';
  tone: CardTone;
  className?: string;
}) {
  const { icon: Icon, label, tone: disc } = ICON[mark];
  return (
    <Card tone={tone} className={className}>
      <h3 className="text-h4">{title}</h3>
      <ul className="mt-3 grid gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-body">
            <span
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink',
                disc,
              )}
            >
              <Icon size={12} strokeWidth={3.2} aria-hidden="true" />
              <span className="sr-only">{label}:</span>
            </span>
            <span className="max-w-[60ch] min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
