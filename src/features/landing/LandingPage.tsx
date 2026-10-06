import { ChevronDown, Plus, Scale, Sprout, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/app/routes';
import { Approx, Button } from '@/ui';
import { FAQ, FINAL, HERO, HONEST, HOW } from './copy';
import { HeroTree } from './HeroTree';
import { TryIt } from './TryIt';

const STEP_ICON: Record<(typeof HOW.steps)[number]['id'], LucideIcon> = {
  log: Plus,
  see: Scale,
  grow: Sprout,
};

function PlantButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button asChild variant="primary" size="lg" className={className}>
      <Link href={ROUTES.start}>{label}</Link>
    </Button>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-x-14 gap-y-8 lg:grid-cols-2"
    >
      <div>
        <h1 id="hero-title" className="font-display text-display-hero">
          {HERO.title}
        </h1>
        <p className="mt-4 max-w-136 text-lead text-ink-2">{HERO.sub}</p>
        <PlantButton label={HERO.action} className="mt-7 max-sm:w-full" />
      </div>
      <HeroTree />
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24">
      <h2 id="how-title" className="text-h1">
        {HOW.title}
      </h2>
      <ol className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
        {HOW.steps.map((step, index) => {
          const Icon = STEP_ICON[step.id];
          return (
            <li key={step.id} className="flex gap-4 md:flex-col">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-md border-2 border-ink bg-green-tint"
              >
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-h2">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-body text-ink-2">{step.line}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HonestNumbers() {
  return (
    <section aria-labelledby="honest-title" className="grid gap-x-14 gap-y-4 lg:grid-cols-2">
      <h2 id="honest-title" className="text-h1">
        {HONEST.title}
      </h2>
      <div className="max-w-160">
        <p className="text-body text-ink-2">
          {HONEST.bodyLead}{' '}
          <span className="mx-0.5 inline-grid size-5.5 place-items-center rounded-full border-2 border-ink bg-yellow-tint align-middle text-[1.2rem] text-ink">
            <Approx spoken={false} className="mr-0 align-baseline" />
          </span>
          <span className="sr-only">{HONEST.markSpoken}</span> {HONEST.bodyTail}
        </p>
        <Link href={ROUTES.methodology} className="mt-3 inline-flex min-h-11 items-center link">
          {HONEST.link}
        </Link>
      </div>
    </section>
  );
}

/**
 * Four questions, dressed like the kit's accordion but built from native disclosures. The kit's
 * one leaves closed answers out of the document; on this pre-rendered page the answers belong
 * in the HTML, where find-in-page and search engines reach them and no JavaScript is needed.
 */
function Questions() {
  return (
    <section aria-labelledby="faq-title" className="grid gap-x-14 gap-y-4 lg:grid-cols-2">
      <h2 id="faq-title" className="text-h1">
        {FAQ.title}
      </h2>
      <div className="max-w-160 divide-y divide-line overflow-hidden rounded-lg border-2 border-ink bg-card">
        {FAQ.items.map((item) => (
          <details key={item.id} name="landing-faq" className="group/faq">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-inset fine:hover:bg-mat [&::-webkit-details-marker]:hidden">
              <h3 className="min-w-0 text-body font-semibold">{item.question}</h3>
              <ChevronDown
                size={20}
                strokeWidth={1.75}
                aria-hidden="true"
                className="shrink-0 text-ink-3 transition-transform duration-(--dur-fast) ease-out group-open/faq:rotate-180"
              />
            </summary>
            <p className="px-5 pb-5 text-body text-ink-2 group-open/faq:animate-fade-in">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section
      aria-labelledby="final-title"
      className="rounded-lg border-2 border-ink bg-card px-5 py-10 text-center md:py-14"
    >
      <h2 id="final-title" className="text-h1">
        {FINAL.title}
      </h2>
      <p className="mt-2 text-body text-ink-2">{FINAL.body}</p>
      <PlantButton label={FINAL.action} className="mt-6 max-sm:w-full" />
    </section>
  );
}

/**
 * The public landing page: six short sections, one idea each. It is a server component, so
 * the words are in the HTML; only the two trees and the demo hydrate. Nothing on this page
 * reads or writes saved game state.
 */
export default function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-280 flex-col gap-14 pt-8 px-gutter pb-14 lg:gap-20 lg:pt-16 lg:pb-20">
      <Hero />
      <HowItWorks />
      <TryIt />
      <HonestNumbers />
      <Questions />
      <FinalCta />
    </div>
  );
}
