'use client';

import {
  Download,
  FileText,
  Gauge,
  Keyboard,
  MessageCircle,
  Monitor,
  Search,
  ShieldCheck,
  Sprout,
  Timer,
  Volume2,
  VolumeX,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATEGORY_BY_ID } from '@/data/catalogue';
import { gameActions, useActionStates, useProfile, useSettings, type ActionState } from '@/game';
import { formatCo2Parts, formatDecimal } from '@/lib/format';
import { play } from '@/lib/sfx';
import { Approx, CATEGORY_ICON, Kbd } from '@/ui';
import { CommandGroup, CommandItem, CommandPalette } from '@/ui/command';
import { NAV_ITEMS } from '../nav/navItems';
import { logLink, normalizePath, ROUTES, TOUCH_GRASS_LINK } from '../routes';
import { openCoach, useShellStore } from '../shellStore';
import { filterEntries, parseQuery, searchWords, usableQty, type Searchable } from './commands';

const LOG_RESULTS = 6;
const LOG_SUGGESTIONS = 4;

interface Command extends Searchable {
  label: string;
  icon: LucideIcon;
  trailing?: ReactNode;
  run: () => void;
}

interface LogCommand extends Searchable {
  state: ActionState;
}

/** Search words beyond the title live with the Log page; the palette borrows them when it opens. */
function useActionSynonyms(): ReadonlyMap<string, string> {
  const [synonyms, setSynonyms] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    let cancelled = false;
    import('@/features/log/model/actionMeta')
      .then(({ ACTION_META }) => {
        if (cancelled) return;
        setSynonyms(
          new Map(
            Object.entries(ACTION_META).map(([id, meta]) => [
              id,
              `${meta.label} ${meta.synonyms.join(' ')}`,
            ]),
          ),
        );
      })
      // Titles and categories still match without them.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return synonyms;
}

function LeadingIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={18} strokeWidth={2.3} aria-hidden="true" />;
}

function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

/**
 * The command palette: go anywhere, prefill a log ("bike 5"), ask Moss, flip a setting. It is
 * its own chunk (cmdk comes with it) and is loaded the first time it opens.
 */
export default function CommandMenu() {
  const router = useRouter();
  const pathname = normalizePath(usePathname() ?? '/');
  const open = useShellStore((state) => state.paletteOpen);
  const query = useShellStore((state) => state.paletteQuery);
  const setOpen = useShellStore((state) => state.setPaletteOpen);
  const setQuery = useShellStore((state) => state.setPaletteQuery);
  const actionStates = useActionStates();
  const settings = useSettings();
  const profile = useProfile();
  const synonyms = useActionSynonyms();

  const parsed = useMemo(() => parseQuery(query), [query]);
  const words = useMemo(() => searchWords(parsed.text), [parsed.text]);

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const logEntries = useMemo<LogCommand[]>(
    () =>
      actionStates
        .filter((state) => !state.hidden)
        .map((state) => ({
          id: state.action.id,
          state,
          keywords: `${state.action.title} ${synonyms.get(state.action.id) ?? ''} ${CATEGORY_BY_ID[state.action.category]?.label ?? state.action.category} ${state.action.unit}`,
        })),
    [actionStates, synonyms],
  );

  const logResults = useMemo(() => {
    if (words.length > 0) return filterEntries(logEntries, words, LOG_RESULTS);
    // Nothing typed: the user's own regulars, then their focus areas.
    return [...logEntries]
      .sort(
        (a, b) =>
          b.state.recentLogs - a.state.recentLogs ||
          Number(b.state.inFocus) - Number(a.state.inFocus),
      )
      .slice(0, LOG_SUGGESTIONS);
  }, [logEntries, words]);

  const treeName = profile.treeName || 'Your tree';
  const tree = treeName.toLowerCase();

  const goTo: Command[] = [
    ...NAV_ITEMS.map((item) => ({
      id: `go-${item.id}`,
      label: item.label,
      icon: item.icon,
      keywords: `${item.label} ${item.hint} ${item.id}`,
      trailing: <Keys keys={['G', item.key.toUpperCase()]} />,
      run: () => go(item.href),
    })),
    {
      id: 'go-methodology',
      label: 'Methodology',
      icon: FileText,
      keywords: 'methodology sources factors how we estimate',
      run: () => go(ROUTES.methodology),
    },
    {
      id: 'go-privacy',
      label: 'Privacy',
      icon: ShieldCheck,
      keywords: 'privacy data device trackers',
      run: () => go(ROUTES.privacy),
    },
  ];

  const treeCommands: Command[] = [
    {
      id: 'tree-passport',
      label: `${treeName}: passport and badges`,
      icon: Sprout,
      keywords: `${tree} tree passport badges rename species rings`,
      run: () => go(ROUTES.me),
    },
    {
      id: 'tree-island',
      label: 'Explore the island',
      icon: Sprout,
      keywords: `${tree} tree grove island explore landmarks`,
      run: () => go(ROUTES.today),
    },
    {
      id: 'touch-grass',
      label: 'Take a Touch grass break',
      icon: Timer,
      keywords: 'touch grass break timer outside walk rest',
      run: () => go(TOUCH_GRASS_LINK),
    },
  ];

  const setMotion = (motion: typeof settings.motion) => {
    gameActions.updateSettings({ motion });
    close();
  };

  const settingCommands: Command[] = [
    {
      id: 'setting-sound',
      label: settings.sound ? 'Turn sound off' : 'Turn sound on',
      icon: settings.sound ? VolumeX : Volume2,
      keywords: 'sound audio mute unmute volume sfx settings',
      trailing: (
        <span className="font-mono text-data-sm text-ink-3">{settings.sound ? 'ON' : 'OFF'}</span>
      ),
      run: () => {
        const sound = !settings.sound;
        gameActions.updateSettings({ sound });
        // The setting reaches the synth on the next render: let it land before the tick.
        if (sound) window.setTimeout(() => play('toggle', { on: true }), 0);
      },
    },
    ...(settings.motion === 'reduced'
      ? []
      : [
          {
            id: 'setting-motion-reduced',
            label: 'Reduce motion',
            icon: Wind,
            keywords: 'motion reduce animation calm settings accessibility',
            run: () => setMotion('reduced'),
          },
        ]),
    ...(settings.motion === 'full'
      ? []
      : [
          {
            id: 'setting-motion-full',
            label: 'Use full motion',
            icon: Wind,
            keywords: 'motion full animation settings',
            run: () => setMotion('full'),
          },
        ]),
    ...(settings.motion === 'system'
      ? []
      : [
          {
            id: 'setting-motion-system',
            label: 'Let motion follow this device',
            icon: Monitor,
            keywords: 'motion system device default animation settings',
            run: () => setMotion('system'),
          },
        ]),
    {
      id: 'setting-graphics',
      label: settings.graphics === 'off' ? 'Turn the 3D grove on' : 'Turn the 3D grove off',
      icon: Gauge,
      keywords: 'graphics 3d webgl grove quality battery illustrated settings',
      run: () => {
        gameActions.updateSettings({ graphics: settings.graphics === 'off' ? 'auto' : 'off' });
        close();
      },
    },
    {
      id: 'data-export',
      label: 'Export or import your data',
      icon: Download,
      keywords: 'data export import backup json csv download reset',
      run: () => go(`${ROUTES.me}#data`),
    },
    {
      id: 'help-shortcuts',
      label: 'Keyboard shortcuts',
      icon: Keyboard,
      keywords: 'keyboard shortcuts help keys',
      trailing: <Keys keys={['?']} />,
      run: () => {
        close();
        useShellStore.getState().setShortcutsOpen(true);
      },
    },
  ];

  const askMoss = () => {
    const question = query.trim();
    close();
    if (pathname === ROUTES.coach) {
      // The conversation is the page here: hand the question to its composer.
      if (question) router.replace(`${ROUTES.coach}?q=${encodeURIComponent(question)}`);
      else openCoach();
      return;
    }
    openCoach(question || undefined);
  };

  const groups: { heading: string; commands: Command[] }[] = [
    { heading: 'Go to', commands: filterEntries(goTo, words) },
    { heading: 'Tree', commands: filterEntries(treeCommands, words) },
    { heading: 'Settings and data', commands: filterEntries(settingCommands, words) },
  ];

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => setOpen(next)}
      query={query}
      onQueryChange={setQuery}
      shouldFilter={false}
    >
      {logResults.length > 0 ? (
        <CommandGroup heading="Log">
          {logResults.map(({ state }) => {
            const { action } = state;
            const qty = usableQty(parsed.qty, action) ?? state.quickQty;
            const kg = state.kgPerUnit === null ? null : state.kgPerUnit * qty;
            const Icon = CATEGORY_ICON[action.category];
            return (
              <CommandItem
                key={action.id}
                value={`log-${action.id}`}
                onSelect={() => go(logLink(action.id, qty))}
                leading={<Icon size={18} strokeWidth={2.3} aria-hidden="true" />}
                trailing={
                  kg !== null && kg > 0 ? (
                    <span className="font-mono text-data-sm text-ink-2">
                      <Approx weight="mono" />
                      {formatCo2Parts(kg).value} {formatCo2Parts(kg).unit}
                    </span>
                  ) : undefined
                }
              >
                {action.title}
                <span className="font-normal text-ink-3">
                  {' '}
                  · {formatDecimal(qty, action.decimals)} {action.unit}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ) : null}

      {groups.map((group) =>
        group.commands.length > 0 ? (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.commands.map((command) => (
              <CommandItem
                key={command.id}
                value={command.id}
                onSelect={command.run}
                leading={<LeadingIcon icon={command.icon} />}
                trailing={command.trailing}
              >
                {command.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null,
      )}

      <CommandGroup heading="Coach">
        <CommandItem
          value="ask-moss"
          onSelect={askMoss}
          leading={<LeadingIcon icon={query.trim() ? MessageCircle : Search} />}
          trailing={query.trim() ? undefined : <Keys keys={['C']} />}
        >
          {query.trim() ? `Ask Moss: ${query.trim()}` : 'Ask Moss'}
        </CommandItem>
      </CommandGroup>
    </CommandPalette>
  );
}
