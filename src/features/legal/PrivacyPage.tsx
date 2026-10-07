import type { ReactNode } from 'react';
// By file, not through `@/app/shell`: that barrel also carries the app's header and, with
// it, the grove's stage, which a reading page never shows.
import { PageHeading } from '@/app/page/PageHeading';
import { PageSection, PageStack } from '@/app/page/PageSection';
import { ROUTES } from '@/app/routes';
import {
  PRIVACY_DELETE,
  PRIVACY_EXPORT,
  PRIVACY_LEAVES,
  PRIVACY_NEVER_SENT,
  PRIVACY_NOT_USED,
  PRIVACY_SECTIONS,
  PRIVACY_STORED,
  type ExportStep,
  type PrivacySection,
} from '@/data/content';
import { ReadingFrame } from '@/features/system/ReadingFrame';
import { Card, Prose, Tag, TextLink, Ticket } from '@/ui';
import { Blocks } from './components/Blocks';
import { Fold } from './components/Fold';
import { ListCard } from './components/ListCard';
import { YourDataSlot } from './components/YourDataSlot';
import { LEAVES_NAMES, PRIVACY_COPY, STORED_NAMES } from './copy';

/** Running text stops at a comfortable width instead of stretching across the page. */
const PROSE_CARD = 'lg:max-w-3xl';

function section(id: string): PrivacySection {
  const found = PRIVACY_SECTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`privacy: the content has no "${id}" section`);
  return found;
}

function Summary() {
  return (
    <Ticket surface="mat" label="Privacy in three lines">
      {PRIVACY_COPY.summary.map((stub) => (
        <div key={stub.label} className="min-w-0 flex-1 px-3 py-3 not-first:perf-l lg:px-5 lg:py-4">
          <p className="type-slug text-ink-3">{stub.label}</p>
          <p className="mt-1 text-h4 leading-tight">{stub.value}</p>
          <p className="mt-1 text-caption text-ink-2">{stub.note}</p>
        </div>
      ))}
    </Ticket>
  );
}

function Steps({ steps }: { steps: ExportStep }) {
  return (
    <Card className="grid content-start gap-3">
      <h3 className="text-h4">{steps.title}</h3>
      <ol className="grid max-w-[56ch] list-decimal gap-2.5 pl-5 text-body marker:font-bold">
        {steps.steps.map((step) => (
          <li key={step} className="pl-1">
            {step}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
      <dt className="type-slug text-ink-3">{label}</dt>
      <dd className="min-w-0 text-body">{children}</dd>
    </div>
  );
}

export default function PrivacyPage() {
  const shortVersion = section('short-version');
  const stored = section('stored');
  const leaves = section('leaves');
  const links = section('links-and-cards');
  const ai = section('ai-answers');

  return (
    <ReadingFrame contents={PRIVACY_COPY.contents}>
      <PageHeading slug="PRIVACY" title={PRIVACY_COPY.title} lead={PRIVACY_COPY.lead} fill="pink" />
      <PageStack>
        <Summary />

        <PageSection
          id="your-data"
          title="Your data, in your hands"
          lead={shortVersion.summary}
          className="scroll-mt-24"
        >
          <YourDataSlot />
          <Card tone="paper" className={PROSE_CARD}>
            <Blocks blocks={shortVersion.blocks} />
          </Card>
        </PageSection>

        <PageSection
          id="stored"
          title={stored.heading}
          lead={stored.summary}
          className="scroll-mt-24"
        >
          <p className="max-w-[68ch] text-body text-ink-2">
            {stored.blocks[0]?.kind === 'p' ? stored.blocks[0].text : null}
          </p>
          <div className="grid gap-3">
            {PRIVACY_STORED.map((item) => (
              <Fold
                key={item.id}
                id={`stored-${item.id}`}
                title={STORED_NAMES[item.id] ?? item.id}
                summary={
                  item.key ? (
                    <span className="font-mono text-caption">{item.key}</span>
                  ) : (
                    <span>{item.area === 'cacheStorage' ? 'Browser cache' : 'This tab only'}</span>
                  )
                }
                meta={
                  item.area === 'localStorage'
                    ? 'SAVED'
                    : item.area === 'sessionStorage'
                      ? 'THIS TAB'
                      : 'CACHE'
                }
                className={PROSE_CARD}
              >
                <dl className="grid gap-3">
                  <Detail label="Holds">
                    <ul className="grid list-disc gap-1.5 pl-5">
                      {item.holds.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </Detail>
                  <Detail label="Leaves the device">No. It is only read by this app.</Detail>
                  <Detail label="To remove it">{item.howToDelete}</Detail>
                </dl>
              </Fold>
            ))}
          </div>
        </PageSection>

        <PageSection
          id="leaves"
          title={leaves.heading}
          lead={leaves.summary}
          className="scroll-mt-24"
        >
          <p className="max-w-[68ch] text-body text-ink-2">
            {leaves.blocks[0]?.kind === 'p' ? leaves.blocks[0].text : null}
          </p>
          <ol className="grid gap-4 lg:grid-cols-3">
            {PRIVACY_LEAVES.map((item, index) => (
              <li key={item.id} className="grid">
                <Card className="grid content-start gap-3">
                  <Tag hue={index === 2 ? 'white' : 'yellow'} className="justify-self-start">
                    {index === 2 ? 'ALWAYS' : 'ONLY IF YOU ASK'}
                  </Tag>
                  <h3 className="text-h4">{LEAVES_NAMES[item.id] ?? item.id}</h3>
                  <dl className="grid gap-3 text-body-sm">
                    <div>
                      <dt className="type-slug text-ink-3">When</dt>
                      <dd>{item.when}</dd>
                    </div>
                    <div>
                      <dt className="type-slug text-ink-3">What is sent</dt>
                      <dd>
                        <ul className="mt-1 grid list-disc gap-1.5 pl-5">
                          {item.sends.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="type-slug text-ink-3">Where it goes</dt>
                      <dd>{item.to}</dd>
                    </div>
                    <div>
                      <dt className="type-slug text-ink-3">Your control</dt>
                      <dd>{item.control}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection
          id="promises"
          title="What we never do"
          lead="Even when the live coach is on."
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard
              title="Never sent, even to the coach"
              items={PRIVACY_NEVER_SENT}
              mark="no"
              tone="card"
            />
            <ListCard
              title="What Touch Grass does not do"
              items={PRIVACY_NOT_USED}
              mark="yes"
              tone="green"
            />
          </div>
        </PageSection>

        <PageSection
          id="how-to"
          title="Export and delete"
          lead="The buttons above do this in one tap. These are the same steps from the Me screen."
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Steps steps={PRIVACY_EXPORT} />
            <Steps steps={PRIVACY_DELETE} />
          </div>
        </PageSection>

        <PageSection
          id="more"
          title="Cards, links and the coach"
          lead="Two more places your data might travel, and how they are handled."
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {[links, ai].map((item) => (
              <Card key={item.id} tone="paper">
                <h3 className="text-h4">{item.heading}</h3>
                <Prose className="mt-2 max-md:text-[1rem]! max-md:leading-[1.55]!">
                  {item.blocks.map((block) =>
                    block.kind === 'p' ? <p key={block.text}>{block.text}</p> : null,
                  )}
                </Prose>
              </Card>
            ))}
          </div>
          <p className="text-body-sm text-ink-2">
            Next:{' '}
            <TextLink href={ROUTES.methodology}>
              how every figure is calculated and sourced
            </TextLink>
            .
          </p>
        </PageSection>
      </PageStack>
    </ReadingFrame>
  );
}
