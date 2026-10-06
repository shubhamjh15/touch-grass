'use client';

import { Ellipsis, Info, Maximize2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { gameActions, useSettings } from '@/game';
import { ColorBar, DropdownMenu, IconButton, Popover, Switch, Tag, type MenuItem } from '@/ui';
import type { PanelVariant } from '../coachUi';
import { COACH_COPY, KNOWS_COPY, STATUS_TAG } from '../copy';
import { describeContext } from '../model/knows';
import { readCoachContext, type CoachStatus } from '../useCoachSession';

/** LIVE or BUILT-IN: the words differ, so the colour is never the only signal. */
export function StatusTag({ status }: { status: CoachStatus }) {
  if (status.kind === 'checking') {
    return (
      <Tag hue="white">
        <ColorBar loading size="xs" label="" />
        {STATUS_TAG.checking}
      </Tag>
    );
  }
  return status.kind === 'live' ? (
    <Tag hue="green">{STATUS_TAG.live}</Tag>
  ) : (
    <Tag hue="yellow">{STATUS_TAG.builtIn}</Tag>
  );
}

/**
 * "What Moss knows": the context of the next request, line by line, read from the same
 * function the request uses. Also where sharing stats is switched on and off.
 */
function KnowsPanel({ status, onNavigate }: { status: CoachStatus; onNavigate?: () => void }) {
  const settings = useSettings();
  // Rebuilt when sharing is toggled, so the list always matches the switch.
  const lines = useMemo(
    () => describeContext(readCoachContext()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.shareStatsWithCoach],
  );
  const live = status.kind === 'live';

  return (
    <div className="text-ink">
      <p className="text-body-sm font-semibold">
        {live ? KNOWS_COPY.liveLead(status.provider) : KNOWS_COPY.builtInLead}
      </p>
      <dl className="mt-2.5 grid gap-1.5">
        {live ? (
          <div className="grid grid-cols-[6.5rem_1fr] gap-x-3">
            <dt className="pt-0.5 type-slug text-ink-3">This chat</dt>
            <dd className="text-body-sm">your message and the last few turns</dd>
          </div>
        ) : null}
        {lines.map((line) => (
          <div key={line.label} className="grid grid-cols-[6.5rem_1fr] gap-x-3">
            <dt className="pt-0.5 type-slug text-ink-3">{line.label}</dt>
            <dd className="min-w-0 text-body-sm break-words">{line.value}</dd>
          </div>
        ))}
      </dl>
      {live ? <p className="mt-2 text-caption text-ink-2">{KNOWS_COPY.nothingStored}</p> : null}

      <p className="mt-4 type-slug text-ink-3">{KNOWS_COPY.neverLead}</p>
      <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-body-sm">
        {KNOWS_COPY.never.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-4 border-t-[1.5px] border-ink pt-3">
        <Switch
          checked={settings.shareStatsWithCoach}
          onCheckedChange={(checked) =>
            gameActions.updateSettings({ shareStatsWithCoach: checked })
          }
          label={KNOWS_COPY.shareLabel}
          description={KNOWS_COPY.shareHint}
        />
      </div>
      <Link
        href={ROUTES.privacy}
        onClick={onNavigate}
        className="mt-2 inline-flex min-h-11 items-center link text-body-sm"
      >
        {KNOWS_COPY.privacy}
      </Link>
    </div>
  );
}

export interface StatusControlsProps {
  status: CoachStatus;
  variant: PanelVariant;
  canClear: boolean;
  onClear: () => void;
  onNavigate?: () => void;
}

/** The status tag, the "What Moss knows" button and the chat's small menu. */
export function StatusControls({
  status,
  variant,
  canClear,
  onClear,
  onNavigate,
}: StatusControlsProps) {
  const [knowsOpen, setKnowsOpen] = useState(false);
  const items: MenuItem[] = [
    ...(variant === 'drawer'
      ? [{ label: COACH_COPY.openPage, icon: Maximize2, href: ROUTES.coach, onSelect: onNavigate }]
      : []),
    {
      label: COACH_COPY.clearChat,
      icon: Trash2,
      danger: true,
      disabled: !canClear,
      onSelect: onClear,
    },
  ];

  return (
    <div className="flex shrink-0 items-center gap-2">
      <StatusTag status={status} />
      <Popover
        open={knowsOpen}
        onOpenChange={setKnowsOpen}
        tone="paper"
        width={340}
        align="end"
        sheetTitle={KNOWS_COPY.title}
        label={KNOWS_COPY.title}
        trigger={<IconButton label={KNOWS_COPY.open} icon={Info} size="sm" />}
      >
        <KnowsPanel
          status={status}
          onNavigate={() => {
            setKnowsOpen(false);
            onNavigate?.();
          }}
        />
      </Popover>
      <DropdownMenu
        label={COACH_COPY.menuLabel}
        trigger={<IconButton label={COACH_COPY.menuLabel} icon={Ellipsis} size="sm" />}
        items={items}
      />
    </div>
  );
}
