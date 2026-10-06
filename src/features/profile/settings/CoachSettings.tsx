'use client';

import { useEffect, useState } from 'react';
import { getAiStatus, useCoachStore, type ClientAiStatus } from '@/ai';
import { openCoach } from '@/app/shell';
import { gameActions, useSettings } from '@/game';
import { useOnlineStatus } from '@/lib/hooks';
import { Button, ColorBar, ConfirmDialog, Switch, Tag, toast } from '@/ui';
import { COPY } from '../copy';
import { SettingRow, SettingsGroup } from './SettingRow';

type Status = { kind: 'checking' } | { kind: 'known'; status: ClientAiStatus };

/** Which coach is on, whether it may see the week's stats, and clearing the chat. */
export function CoachSettings() {
  const settings = useSettings();
  const online = useOnlineStatus();
  const messages = useCoachStore((state) => state.messages.length);
  const [state, setState] = useState<Status>({ kind: 'checking' });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    getAiStatus()
      .then((status) => {
        if (alive) setState({ kind: 'known', status });
      })
      .catch(() => {
        if (alive) {
          setState({
            kind: 'known',
            status: { configured: false, provider: null, model: null, reason: 'offline' },
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [online]);

  const live = state.kind === 'known' && state.status.configured && online;
  const line =
    state.kind === 'checking'
      ? COPY.settings.coachStatus.checking
      : !online || state.status.reason === 'offline'
        ? COPY.settings.coachStatus.offline
        : live
          ? COPY.settings.coachStatus.live(state.status.provider ?? '')
          : COPY.settings.coachStatus.builtIn;

  return (
    <SettingsGroup title={COPY.settings.coach.heading} label={COPY.settings.coach.label}>
      <SettingRow
        title={COPY.settings.coachStatus.label}
        message={<span className="text-ink-2">{line}</span>}
      >
        {() => (
          <div className="flex flex-wrap items-center gap-3">
            {state.kind === 'checking' ? (
              <ColorBar loading size="xs" label="" />
            ) : (
              <Tag hue={live ? 'green' : 'yellow'}>{live ? 'Live' : 'Built-in'}</Tag>
            )}
            <Button variant="neutral" size="sm" onClick={() => openCoach()}>
              {COPY.settings.coachStatus.open}
            </Button>
          </div>
        )}
      </SettingRow>
      <li className="bg-card px-4 py-1.5">
        <Switch
          checked={settings.shareStatsWithCoach}
          onCheckedChange={(shareStatsWithCoach) =>
            gameActions.updateSettings({ shareStatsWithCoach })
          }
          label={COPY.settings.share.label}
          description={COPY.settings.share.hint}
        />
      </li>
      <SettingRow title={COPY.settings.clearChat.label} hint={COPY.settings.clearChat.hint}>
        {() => (
          <>
            <Button
              variant="neutral"
              size="sm"
              disabled={messages === 0}
              onClick={() => setConfirm(true)}
            >
              {COPY.settings.clearChat.action}
            </Button>
            <ConfirmDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={COPY.settings.clearChat.title}
              description={COPY.settings.clearChat.body}
              confirmLabel={COPY.settings.clearChat.confirm}
              destructive
              onConfirm={() => {
                useCoachStore.getState().clear();
                toast({ title: COPY.settings.clearChat.done });
              }}
            />
          </>
        )}
      </SettingRow>
    </SettingsGroup>
  );
}
