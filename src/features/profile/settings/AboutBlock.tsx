'use client';

import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { ROUTES, demoLeaveLink } from '@/app/shell';
import { useGameState, useIsSandbox } from '@/game';
import { BRAND } from '@/lib/brand';
import { Button, ColorBar, Modal, TextLink, UiLink } from '@/ui';
import { APP_VERSION, COPY } from '../copy';
import { SettingRow, SettingsGroup } from './SettingRow';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 type-slug text-ink-3">{label}</dt>
      <span
        aria-hidden="true"
        className="min-w-3 flex-1 -translate-y-0.5 border-b-2 border-dotted border-ink-4"
      />
      <dd className="text-right font-mono text-data font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Versions, the two honesty pages, the open-source credits and a way to report a problem. */
export function AboutBlock() {
  const content = useGameState((game) => game.contentVersion);
  const factors = useGameState((game) => game.factorsVersion);
  const [credits, setCredits] = useState(false);
  const inDemo = useIsSandbox();

  return (
    <SettingsGroup title={COPY.settings.about.heading} label={COPY.settings.about.label}>
      <li className="grid gap-4 bg-card px-4 py-4">
        <div>
          <p className="text-body font-bold text-ink">{BRAND.name}</p>
          <p className="text-body-sm text-ink-2">{BRAND.tagline}</p>
        </div>
        <dl className="grid gap-2">
          <Fact label={COPY.settings.about.app} value={`v${APP_VERSION}`} />
          <Fact label={COPY.settings.about.content} value={content} />
          <Fact label={COPY.settings.about.factors} value={factors} />
        </dl>
        <nav aria-label={COPY.settings.about.label} className="flex flex-wrap gap-x-5 gap-y-1">
          <TextLink
            href={ROUTES.methodology}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold"
          >
            {COPY.settings.about.methodology}
          </TextLink>
          <TextLink
            href={ROUTES.privacy}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold"
          >
            {COPY.settings.about.privacy}
          </TextLink>
          <button
            type="button"
            onClick={() => setCredits(true)}
            className="inline-flex min-h-11 items-center link text-body-sm font-semibold"
          >
            {COPY.settings.about.licences}
          </button>
          <a
            href={COPY.settings.about.reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 link text-body-sm font-semibold"
          >
            {COPY.settings.about.report}
            <ExternalLink size={14} strokeWidth={2.25} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
        <ColorBar size="sm" />
      </li>
      <SettingRow
        title={COPY.settings.about.demo.title}
        hint={inDemo ? COPY.settings.about.demo.inside : COPY.settings.about.demo.hint}
      >
        {(labelId) => (
          <Button asChild variant="neutral" size="sm" aria-describedby={labelId}>
            <UiLink href={inDemo ? demoLeaveLink('home') : ROUTES.demo}>
              {inDemo ? COPY.settings.about.demo.exit : COPY.settings.about.demo.open}
            </UiLink>
          </Button>
        )}
      </SettingRow>
      <Modal
        open={credits}
        onOpenChange={setCredits}
        title={COPY.settings.about.credits.title}
        description={COPY.settings.about.credits.lead}
        size="sm"
        footer={
          <Button variant="neutral" onClick={() => setCredits(false)}>
            {COPY.settings.about.credits.close}
          </Button>
        }
      >
        <ul className="grid gap-2">
          {COPY.settings.about.credits.items.map(([name, licence]) => (
            <li
              key={name}
              className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-line pb-2 text-body-sm"
            >
              <span className="font-semibold text-ink">{name}</span>
              <span className="shrink-0 type-slug text-ink-3">{licence}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </SettingsGroup>
  );
}
