# Touch Grass

**Grow a living tree by shrinking your footprint.**

Touch Grass is a climate-habit companion. You log the small real-world actions you already take (a bus instead of a
car, a plant-based meal, a shorter shower), you get an honest estimate of the CO2e avoided, and a living 3D tree on
its own floating island grows with you. No account, no feed, no doomscrolling: everything stays on your device.

## What is in it

- **A living world.** One WebGL island, rendered with three.js and React Three Fiber, that follows your clock (dawn,
  day, golden hour, a moonlit night) and your tree's health. Seven growth stages, three species, props and landmarks
  that arrive as you earn badges, creatures, an Explore mode with a photo button. Where WebGL is not available an
  illustrated tree takes its place.
- **Logging in seconds.** 51 catalogued actions in seven kinds, custom actions, and "say it in your own words".
  Every log prints a receipt with Undo.
- **Honest numbers.** Every figure is an estimate, shown as "≈" to two significant figures, with the comparison it
  was made against, a likely range and its source. The whole factor table and all 55 sources are on `/methodology`.
- **A game that is kind.** Daily rings, streaks that rest instead of breaking, quests that track themselves, 33
  badges, levels. A missed day makes it rain; it never kills the tree.
- **Impact, yours and the planet's.** Your savings by category and over time, next to live readings fetched by our
  own server from public sources: global temperature (NASA GISTEMP), atmospheric CO2, methane and nitrous oxide
  (NOAA), and CO2 per person by country (World Bank). A reading is marked "Live" only when the server fetched it
  within 36 hours; otherwise it says "Snapshot from" and the date.
- **A coach that works without a key.** Moss answers from a built-in offline coach. With one free API key it becomes
  a live model that can turn a sentence into logged actions.
- **Learn.** Ten short lessons with three-question quizzes, ten myth-busters and a daily fact, all sourced.
- **Your data.** Stored in the browser only. Export as JSON or CSV, import, or delete everything from `/me` or
  `/privacy`.
- **A demo world.** "See day 200" on the landing page opens a grown island in a sandbox that never touches your own
  data, with a four-step tour.

## Run it

Requires Node 20.19 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

The app is complete without any configuration. To switch the coach from the built-in one to a live model, copy
`.env.example` to `.env.local` and fill in one key (a free Groq key is enough). Keys are read on the server only.

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest (unit and component tests)
npm run build      # production build
npm run start      # serve the production build
```

## How it is built

| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript in strict mode |
| Styling | Tailwind CSS 4 with design tokens in `src/styles/index.css`, Radix primitives, Framer Motion |
| 3D | three.js, React Three Fiber, drei; loaded as a separate lazy chunk after first paint |
| State | Zustand, persisted to `localStorage`; a pure rules engine under `src/game` |
| Charts | Recharts, loaded only on Impact |
| Server | Route handlers under `app/api`: the coach (`chat`, `estimate`, `status`) and `climate` |
| Tests | Vitest and Testing Library; Playwright for end-to-end |

```
app/             routes, layouts, API route handlers
server/          the code behind the API routes (AI providers, climate sources)
src/app/         the shell: navigation, HUD, feedback for game events, command palette
src/features/    one folder per page
src/game/        rules engine, store, selectors, events
src/world/       the 3D island, its stage component and the illustrated fallback
src/ui/          the component kit
src/data/        action catalogue, lessons, sources, bundled datasets
src/ai/          browser client for the coach and the offline coach
scripts/         screenshot, responsive-audit and frame-time tools, state fixtures
```

Useful when working on it:

```bash
node scripts/shot.mjs --route today --state day200 --device mobile --out today.png
node scripts/responsive-audit.mjs --full --state day200
node scripts/world-perf.mjs --route today --state day45
```

In a development build, `window.__game.help()` in the browser console lists time travel and other QA helpers, and
`/__ui` and `/__world` open the component and world workbenches.

## What the numbers are, and are not

The figures are estimates of emissions avoided against a stated alternative, good for scale and for ranking
actions. They are not measurements, not offsets and not carbon accounting. The method, the confidence levels, the
regional factors and the known gaps are written up on `/methodology`; what is stored and what can leave the device
is on `/privacy`.

## Credits

Climate data: NASA Goddard Institute for Space Studies, NOAA Global Monitoring Laboratory, the World Bank. Emission
factors: the sources listed on `/methodology`. The island's models are generated in code; see
`public/models/CREDITS.md`. Fonts: Space Grotesk, Tilt Warp and Martian Mono, self-hosted.
