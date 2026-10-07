// By file, not through `@/app/shell`: that barrel also carries the app's header and, with
// it, the grove's stage, which a reading page never shows.
import { PageHeading } from '@/app/page/PageHeading';
import { PageSection, PageStack } from '@/app/page/PageSection';
import { ROUTES } from '@/app/routes';
import { GRID } from '@/data/catalogue';
import {
  CANNOT_CLAIM,
  CAN_CLAIM,
  CONFIDENCE_LEVELS,
  FACTORS_CHANGELOG,
  FACTORS_DATE,
  FACTORS_VERSION,
  METHODOLOGY_SECTIONS,
  WORDING_RULES,
  type MethodologySection,
} from '@/data/content';
import { ReadingFrame } from '@/features/system/ReadingFrame';
import { formatNumber } from '@/lib/format';
import { Approx, Card, HonestyMark, Tag, TextLink, Ticket, TicketStub, type Hue } from '@/ui';
import { Blocks } from './components/Blocks';
import { FactorTable } from './components/FactorTable';
import { Fold } from './components/Fold';
import { HashOpener } from './components/HashOpener';
import { ListCard } from './components/ListCard';
import { SourceItem, SourceList } from './components/SourceList';
import { CONTENTS, METHODOLOGY_COPY, PLANET_FIGURES } from './copy';
import { contentOnlySourceRows, demoEstimate, factorRows, sourceListRows } from './model';

const CONFIDENCE_TONE = {
  high: 'green',
  medium: 'yellow',
  low: 'pink',
  not_quantified: 'paper',
} as const;

const CONFIDENCE_TAG: Record<string, Hue | 'white'> = {
  high: 'green',
  medium: 'yellow',
  low: 'pink',
  not_quantified: 'white',
};

/** A card of running text stops at a comfortable width instead of stretching across the page. */
const PROSE_CARD = 'lg:max-w-3xl';

function section(id: string): MethodologySection {
  const found = METHODOLOGY_SECTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`methodology: the content has no "${id}" section`);
  return found;
}

function SubHeading({ children }: { children: string }) {
  return <h3 className="mt-7 mb-1 text-h4 first:mt-0">{children}</h3>;
}

/** A real catalogue figure with the honesty mark on it, so a reader can try the mark before reading on. */
function TryIt() {
  const demo = demoEstimate();
  return (
    <Card tone="yellow" className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:gap-x-10">
      <div className="min-w-0 flex-1 basis-64">
        <p className="type-slug text-ink-2">Try it</p>
        <h2 className="mt-1 text-h4">{METHODOLOGY_COPY.tryTitle}</h2>
        <p className="mt-1 max-w-[56ch] text-body-sm text-ink-2">{METHODOLOGY_COPY.tryBody}</p>
      </div>
      <div className="flex min-w-0 items-center gap-4 rounded-md border-3 border-ink bg-card px-4 py-3 shadow-2">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold">{demo.title}</p>
          <p className="text-caption text-ink-2">{demo.quantity}</p>
        </div>
        <p className="flex items-center gap-2 font-mono text-h4 font-bold whitespace-nowrap">
          <span>
            <Approx weight="mono" />
            {demo.kg}
          </span>
          <HonestyMark source={demo.source} />
        </p>
      </div>
    </Card>
  );
}

function ConfidenceTiles() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Confidence levels">
      {CONFIDENCE_LEVELS.map((level) => (
        <li key={level.id} className="grid">
          <Card tone={CONFIDENCE_TONE[level.id]} className="grid content-start gap-2">
            <Tag hue={CONFIDENCE_TAG[level.id]} className="justify-self-start">
              {level.label}
            </Tag>
            <p className="text-body-sm">{level.meaning}</p>
            <p className="font-mono text-caption font-semibold">{level.typicalRange}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function MethodologyPage() {
  const rows = factorRows();
  const sources = sourceListRows();
  const contentOnly = contentOnlySourceRows();
  const idea = section('what-it-is');
  const comparison = section('counterfactuals');
  const ranges = section('ranges');
  const regional = section('regional');
  const baseline = section('baseline');
  const customAi = section('custom-ai');
  const equivalences = section('equivalences');
  const doubleCounting = section('double-counting');
  const gaps = section('gaps');
  const wording = section('wording');
  const versions = section('versions');

  return (
    <ReadingFrame contents={CONTENTS}>
      <HashOpener />
      <PageHeading
        slug={`FACTORS ${FACTORS_VERSION} · ${FACTORS_DATE}`}
        title={METHODOLOGY_COPY.title}
        lead={METHODOLOGY_COPY.lead}
        fill="yellow"
      />
      <PageStack>
        <div className="grid gap-4">
          <Ticket surface="mat" label="This page at a glance">
            <TicketStub label="ACTIONS" value={formatNumber(rows.length)} />
            <TicketStub label="SOURCES" value={formatNumber(sources.length)} />
            <TicketStub label="REGIONS" value={formatNumber(GRID.length)} />
          </Ticket>
          <TryIt />
        </div>

        <PageSection id="idea" title={idea.heading} lead={idea.summary} className="scroll-mt-24">
          <Card className={PROSE_CARD}>
            <Blocks blocks={idea.blocks} />
            <SubHeading>{comparison.heading}</SubHeading>
            <Blocks blocks={comparison.blocks} />
          </Card>
        </PageSection>

        <PageSection
          id="confidence"
          title={ranges.heading}
          lead={ranges.summary}
          className="scroll-mt-24"
        >
          <ConfidenceTiles />
          <Card className={PROSE_CARD}>
            <Blocks blocks={ranges.blocks.filter((block) => block.kind !== 'list')} />
          </Card>
        </PageSection>

        <PageSection
          id="regions"
          title={regional.heading}
          lead={regional.summary}
          className="scroll-mt-24"
        >
          <Card className={PROSE_CARD}>
            <Blocks blocks={regional.blocks} />
          </Card>
        </PageSection>

        <PageSection
          id="factors"
          title="Every factor"
          lead="One row for every action you can log: the value, how far it could be off, what it is compared with and where it comes from."
          className="scroll-mt-24"
        >
          <FactorTable rows={rows} />
        </PageSection>

        <PageSection
          id="sources"
          title="Sources"
          lead={`${formatNumber(sources.length)} published sources behind the factors. Each name opens the publisher's page.`}
          className="scroll-mt-24"
        >
          <SourceList rows={sources} />
          {contentOnly.length > 0 ? (
            <Fold
              id="content-sources"
              title="Sources behind Learn, Impact and community posts"
              summary="Lessons, facts and the charts on Impact cite these as well."
              meta={`${formatNumber(contentOnly.length)} SOURCES`}
            >
              <ol className="grid gap-3 xl:grid-cols-2" aria-label="Sources of lessons and charts">
                {contentOnly.map((row) => (
                  <SourceItem
                    key={row.key}
                    anchor={row.anchor}
                    title={row.title}
                    publisher={row.publisher}
                    year={row.year}
                    url={row.url}
                  />
                ))}
              </ol>
            </Fold>
          ) : null}
        </PageSection>

        <PageSection
          id="other-numbers"
          title="The other numbers"
          lead="The starting line, estimates for things we did not list, equivalences, and the world figures on Impact."
          className="scroll-mt-24"
        >
          <div className="grid gap-3">
            {[baseline, customAi, equivalences].map((item) => (
              <Fold
                key={item.id}
                id={item.id}
                title={item.heading}
                summary={item.summary}
                className={PROSE_CARD}
              >
                <Blocks blocks={item.blocks} />
              </Fold>
            ))}
            <Fold
              className={PROSE_CARD}
              id={PLANET_FIGURES.id}
              title={PLANET_FIGURES.heading}
              summary={PLANET_FIGURES.summary}
            >
              <div className="prose-eco prose max-w-[68ch]">
                {PLANET_FIGURES.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {PLANET_FIGURES.items.map((item) => (
                  <li key={item.what} className="rounded-md border-3 border-ink bg-paper p-3.5">
                    <p className="text-label font-bold">{item.what}</p>
                    <p className="mt-1 text-body-sm text-ink-2">{item.detail}</p>
                    <p className="mt-2 text-caption">
                      <TextLink href={item.url} target="_blank" rel="noreferrer">
                        {item.source}
                      </TextLink>
                    </p>
                  </li>
                ))}
              </ul>
            </Fold>
          </div>
        </PageSection>

        <PageSection
          id="limits"
          title="What we do not claim"
          lead="The honest limits of a self-reported estimate, and the habits that keep it honest."
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard title="We can claim" items={CAN_CLAIM} mark="yes" tone="green" />
            <ListCard title="We cannot claim" items={CANNOT_CLAIM} mark="no" tone="pink" />
          </div>
          <Fold
            className={PROSE_CARD}
            id={doubleCounting.id}
            title={doubleCounting.heading}
            summary={doubleCounting.summary}
          >
            <Blocks blocks={doubleCounting.blocks} />
          </Fold>
          <Fold
            className={PROSE_CARD}
            id={gaps.id}
            title={gaps.heading}
            summary={gaps.summary}
            defaultOpen
          >
            <Blocks blocks={gaps.blocks} />
          </Fold>
        </PageSection>

        <PageSection
          id="wording"
          title={wording.heading}
          lead={wording.summary}
          className="scroll-mt-24"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard title="Always" items={WORDING_RULES.always} mark="yes" tone="card" />
            <ListCard title="Never" items={WORDING_RULES.never} mark="no" tone="card" />
          </div>
        </PageSection>

        <PageSection
          id="versions"
          title={versions.heading}
          lead={versions.summary}
          className="scroll-mt-24"
        >
          <Card className={PROSE_CARD}>
            <Blocks blocks={versions.blocks} />
            <SubHeading>Changelog</SubHeading>
            <ol className="mt-2 grid gap-4">
              {FACTORS_CHANGELOG.map((entry) => (
                <li key={entry.version} className="grid gap-1.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <Tag hue="yellow">{entry.version}</Tag>
                    <span className="type-slug text-ink-3">{entry.date}</span>
                  </p>
                  <ul className="grid max-w-[68ch] list-disc gap-1.5 pl-5 text-body">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
          <p className="text-body-sm text-ink-2">
            Next:{' '}
            <TextLink href={ROUTES.privacy}>
              what Touch Grass stores and what leaves your device
            </TextLink>
            .
          </p>
        </PageSection>
      </PageStack>
    </ReadingFrame>
  );
}
