'use client';

import { Copy, Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  gameActions,
  useImpact,
  useLevelInfo,
  usePassport,
  useProfile,
  useStreak,
  useTreeStatus,
} from '@/game';
import { useReducedMotion } from '@/lib/hooks';
import { Button, Card, Segmented, Skeleton, Switch, TiltCard } from '@/ui';
import { COMMUNITY_COPY } from '../copy';
import {
  buildLayout,
  canDrawPng,
  captureWorldImage,
  ensureCardFonts,
  exportCard,
  renderSvg,
  svgDataUrl,
  type ExportOutcome,
} from '../model/cardExport';
import {
  DEFAULT_CARD_OPTIONS,
  cardAlt,
  cardCaption,
  drawCard,
  readPalette,
  type CardFacts,
  type CardFormat,
  type CardImage,
  type CardOptions,
} from '../model/shareCard';

const COPY = COMMUNITY_COPY.share;
const PREVIEW_SCALE = 0.5;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const FORMATS = [
  { value: 'story', label: COPY.story },
  { value: 'square', label: COPY.square },
] as const;

/** What goes on the card, read from the same sources as the rest of the app. */
function useCardFacts(): CardFacts {
  const tree = useTreeStatus();
  const passport = usePassport();
  const level = useLevelInfo();
  const streak = useStreak();
  const impact = useImpact();
  const profile = useProfile();
  return useMemo(
    () => ({
      treeName: tree.name,
      species: tree.species,
      speciesLabel: passport.speciesLabel,
      stage: tree.stage,
      growth: tree.growth,
      rings: tree.rings,
      level: level.level,
      levelTitle: level.title,
      streak: streak.current,
      kg: impact.kg,
      week: streak.week.map((day) => ({ letter: LETTERS[day.index] ?? '', mark: day.mark })),
      name: profile.name,
      host: typeof window === 'undefined' ? '' : window.location.host,
    }),
    [tree, passport.speciesLabel, level, streak, impact.kg, profile.name],
  );
}

type Images = Partial<Record<CardFormat, CardImage | null>>;

/**
 * Share your tree: the card drawn on this device, shown exactly as it will export. The 3D world
 * is photographed for it when the browser can; otherwise a drawn tree of the same size stands in.
 */
export function ShareStudio() {
  const facts = useCardFacts();
  const reduced = useReducedMotion();
  const [format, setFormat] = useState<CardFormat>('story');
  const [options, setOptions] = useState<CardOptions>(DEFAULT_CARD_OPTIONS);
  const [images, setImages] = useState<Images>({});
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; ok: boolean } | null>(null);
  const [captionNote, setCaptionNote] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const requested = useRef(new Set<CardFormat>());

  useEffect(() => {
    let live = true;
    void ensureCardFonts().then(() => {
      if (live) setFontsReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (requested.current.has(format)) return;
    requested.current.add(format);
    void captureWorldImage(format).then((image) => {
      setImages((current) => ({ ...current, [format]: image }));
    });
  }, [format]);

  const image = images[format] ?? null;
  const pngPossible = fontsReady ? canDrawPng() : true;
  const layout = useMemo(
    // `fontsReady` is a dependency on purpose: chips are measured with the real fonts once they load.
    () => (fontsReady ? buildLayout(facts, options, format, image) : null),
    [facts, options, format, image, fontsReady],
  );

  useEffect(() => {
    const target = canvas.current;
    if (!layout || !target) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    drawCard(ctx, layout, readPalette(), image, PREVIEW_SCALE);
  }, [layout, image]);

  const svgPreview = useMemo(
    () => (layout && !pngPossible ? svgDataUrl(renderSvg(layout)) : null),
    [layout, pngPossible],
  );

  const shape = format === 'story' ? { w: 1080, h: 1920 } : { w: 1080, h: 1080 };
  const caption = cardCaption(facts);
  const alt = cardAlt(facts, options);
  const toggle = (key: keyof CardOptions) => (value: boolean) =>
    setOptions((current) => ({ ...current, [key]: value }));
  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  const doExport = async () => {
    if (!layout || busy) return;
    setBusy(true);
    setOutcome(null);
    const result: ExportOutcome = await exportCard(layout, image, format, facts);
    setBusy(false);
    if (result.ok) {
      gameActions.recordShareExport();
      setOutcome({ text: COPY.done[result.how], ok: true });
    } else if (result.reason === 'failed') {
      setOutcome({ text: COPY.failed, ok: false });
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionNote(COPY.captionCopied);
    } catch {
      setCaptionNote(COPY.captionFailed);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] @3xl:gap-8">
      <div className="mx-auto grid w-full max-w-72 grid-cols-1 gap-3 @3xl:mx-0 @3xl:max-w-none">
        <TiltCard disabled={reduced} className="w-full">
          <div
            className="relative w-full overflow-hidden rounded-md border-3 border-ink bg-paper shadow-3"
            style={{ aspectRatio: `${shape.w} / ${shape.h}` }}
          >
            {layout ? (
              svgPreview ? (
                <img src={svgPreview} alt={alt} className="size-full object-cover" />
              ) : (
                <canvas
                  ref={canvas}
                  role="img"
                  aria-label={alt}
                  width={Math.round(layout.width * PREVIEW_SCALE)}
                  height={Math.round(layout.height * PREVIEW_SCALE)}
                  className="block size-full"
                />
              )
            ) : (
              <Skeleton className="size-full rounded-none" />
            )}
          </div>
        </TiltCard>
        {!pngPossible ? <p className="text-caption text-ink-3">{COPY.noWorldNote}</p> : null}
      </div>

      <Card className="grid grid-cols-1 gap-5">
        <Segmented
          value={format}
          onValueChange={setFormat}
          options={FORMATS}
          aria-label={COPY.formatLabel}
          fullWidth
        />

        <fieldset className="grid grid-cols-1 gap-1">
          <legend className="mb-1 text-label text-ink">{COPY.showLabel}</legend>
          <Switch label={COPY.streak} checked={options.streak} onCheckedChange={toggle('streak')} />
          <Switch
            label={COPY.kg}
            description={COPY.kgHint}
            checked={options.kg}
            onCheckedChange={toggle('kg')}
          />
          <Switch label={COPY.week} checked={options.week} onCheckedChange={toggle('week')} />
          <Switch
            label={COPY.name}
            description={COPY.nameHint}
            checked={options.name}
            onCheckedChange={toggle('name')}
          />
        </fieldset>

        <div className="flex flex-wrap gap-3 border-t-[1.5px] border-ink pt-4">
          <Button
            variant="primary"
            icon={canShare ? Share2 : Download}
            onClick={doExport}
            loading={busy}
            disabledReason={layout ? undefined : COPY.previewLoading}
          >
            {busy ? COPY.exporting : canShare ? COPY.exportShare : COPY.exportDownload}
          </Button>
          <Button variant="neutral" icon={Copy} onClick={copyCaption}>
            {COPY.copyCaption}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <p className="text-caption text-ink-3">
            {COPY.captionLabel}: <span className="text-ink-2">{caption}</span>
          </p>
          <p role="status" aria-live="polite" className="min-h-5 text-body-sm text-ink-2">
            {outcome?.text ?? captionNote ?? ''}
          </p>
        </div>
      </Card>
    </div>
  );
}
