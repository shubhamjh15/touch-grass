'use client';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ROUTES } from '@/app/shell';
import { Button, Lettering, Meter, Panel, Tag, UiLink } from '@/ui';
import { COPY } from './copy';
import { LEAVE_PARAM, cancelDemoStart, exitDemo, startDemo } from './demo';
import { useDemoStore } from './demoStore';
import { DEMO_DAYS } from './model/demoWorld';

/**
 * The door of the demo world. Opening `/demo` grows the world, switches the game into its
 * sandbox and lands on Today; `/demo?leave=…` does the reverse. Both happen here, on a route
 * no guard watches, so nothing can redirect half-way through the switch.
 */
export default function DemoEntryPage() {
  const router = useRouter();
  const phase = useDemoStore((state) => state.phase);
  const day = useDemoStore((state) => state.day);
  const leaving =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(LEAVE_PARAM);

  useEffect(() => {
    const leave = new URLSearchParams(window.location.search).get(LEAVE_PARAM);
    if (leave !== null) {
      const { hasOwnTree } = exitDemo();
      const without = leave === 'start' ? ROUTES.start : ROUTES.landing;
      router.replace(hasOwnTree ? ROUTES.today : without);
      return undefined;
    }
    let current = true;
    void startDemo().then((showing) => {
      if (showing && current) router.replace(ROUTES.today);
    });
    return () => {
      current = false;
      cancelDemoStart();
    };
  }, [router]);

  const retry = () => {
    void startDemo().then((showing) => {
      if (showing) router.replace(ROUTES.today);
    });
  };

  return (
    <div className="grid min-h-dvh place-items-center graph-paper py-10 px-gutter">
      <Panel variant="paper" className="relative w-full max-w-[26rem] p-6 sm:p-8">
        <Tag hue="yellow" className="mb-4">
          {COPY.entry.slug}
        </Tag>
        {phase === 'failed' ? (
          <>
            <h1 className="text-h2">{COPY.entry.failedTitle}</h1>
            <p className="mt-3 text-body text-ink-2">{COPY.entry.failedBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" onClick={retry}>
                {COPY.entry.retry}
              </Button>
              <Button asChild variant="neutral" iconRight={ArrowRight}>
                <UiLink href={ROUTES.landing}>{COPY.entry.home}</UiLink>
              </Button>
            </div>
          </>
        ) : leaving ? (
          <h1 className="text-h2" aria-busy="true">
            {COPY.entry.leaving}
          </h1>
        ) : (
          <>
            <h1>
              <Lettering fill="green" tilt="none" className="text-display-sm sm:text-display-md">
                {COPY.entry.title}
              </Lettering>
            </h1>
            <p className="mt-4 text-body text-ink-2">{COPY.entry.lead}</p>
            <div className="mt-6">
              <p className="mb-2 flex items-baseline justify-between gap-3">
                <span className="type-slug text-ink-3">{COPY.entry.progressLabel}</span>
                <span className="font-mono text-data text-ink tabular-nums" aria-hidden="true">
                  {COPY.entry.day(Math.max(day, 1), DEMO_DAYS)}
                </span>
              </p>
              <Meter
                value={day}
                max={DEMO_DAYS}
                tone="green"
                size="lg"
                label={COPY.entry.progressLabel}
                valueText={COPY.entry.day(Math.max(day, 1), DEMO_DAYS)}
              />
            </div>
            <p className="mt-6 flex items-start gap-2.5 border-t-2 border-dashed border-ink-4 pt-4 text-body-sm text-ink-2">
              <ShieldCheck
                size={18}
                strokeWidth={2.25}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              {COPY.entry.promise}
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
