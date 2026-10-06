## Inspiration

Personal climate action fails for a boring reason: there is no feedback. A skipped 4 km drive avoids about 0.8 kg of CO2e, and nothing in the world tells you so. Footprint calculators answer once and go quiet, habit trackers know nothing about carbon, and most climate content is a countdown that makes people close the tab. Without numbers, effort is also badly aimed: thorough recycling saves about 0.2 t CO2e a year, living car-free about 2.4 t (Wynes and Nicholas, 2017). We asked what would happen if every real action got an immediate, honest answer, and if that answer was a place you could watch grow instead of a chart.

## What Touch Grass Does

Touch Grass is not just a carbon tracker - it is a living 3D world that your real-world habits grow. It converts an abstract problem, grams of a gas nobody can see, into three concrete things: an honest estimate with its source, a game that rewards showing up, and an island that changes in front of you. You plant a tree in about a minute with no account, log what you did in a few seconds, and the tree answers.

### 🌳 1. Procedural Living World

One WebGL scene, generated entirely in code, is the product's main interface.

- **Seeded, continuously growing tree**
  - A skeleton (branches, foliage clumps, accents) is generated once per seed and species. A generator version is mixed into every random stream, so a saved tree never changes shape.
  - A pure pose function reveals that skeleton for any growth value from 0 to 1 into preallocated typed arrays. It is monotonic by construction: wood only extends and thickens.
  - Three species (oak, cherry, pine) each have their own growth routine and proportion sheet, and all produce the same skeleton format.
- **Wind and mood in the stock lit material**
  - Crown puffs, leaf cards, blossoms and grass are instanced meshes.
  - One sway function of world position is patched into three.js's Lambert vertex shader, so trunk, leaves and grass lean together and stay lit, shadowed and tone-mapped by the engine's own code.
  - The same patch grades greens by vitality: straw-yellow when thirsty, grey-blue when dormant.
- **Light from the user's clock**: sky and key light are a pure function of the local hour, blended between keyframes in OKLab.
- **A typed pulse contract**: eight pulse kinds (grow, ring, water, level-up, badge, streak, plant, celebrate) run scheduler scripts that write named channels. The scene applies them to transforms and shader uniforms each frame, next to a pooled, instanced particle system.
- **Interaction**: orbit with inertia, one ray per pointer move against invisible hit proxies, props that say what earned them, and a full-screen Explore mode.

👉 The tree a user sees is a deterministic function of their seed, species, growth, health and clock, so it always looks like their own.

### ⚡ 2. A Frame Budget Built for Integrated Graphics

Many people open a web app on a laptop with integrated graphics, so that is the machine we designed for.

- **One WebGL context, moved through the DOM**: the canvas node is re-parented into whichever stage is active, so native compositor scrolling moves it. Layout is read only when the stage changes, and nothing is drawn while the stage is off screen or the tab is hidden.
- **Tier by GPU class**: the unmasked renderer string is classified as software, integrated, mobile, discrete or Apple silicon. Only the last two start on the high tier.
- **Tiers as pixel budgets**: 1.1, 1.5 and 2.6 megapixels. The medium tier redraws its 1024 px shadow map on change, otherwise every third frame. Ambient occlusion, bloom and vignette run on the high tier only.
- **A frame-pacing governor**: it learns the display's interval, judges windows of 30 frames, treats a frame as late at 1.4 intervals, and after two slow windows lowers resolution before it lowers the tier. It gives a step back after 40 clean windows, at most twice per session.

👉 Measured on an integrated Radeon laptop in a production build: 58 to 60 frames per second idle, dragging and scrolling, median frame 16.7 ms, zero pixels of canvas drift. The high tier has not yet been measured on a discrete card.

### 🎮 3. Deterministic Game Engine

All rules live in a pure TypeScript module with no interface code in it.

- **One transaction function**: `transact(state, now, operation)` settles the calendar, runs the operation on a draft, reconciles badges, quests and progression, and returns the next state plus an ordered list of events. The same state, clock and operation always give the same result.
- **One mutation path**: the store funnels every change through a single function, so each is atomic and reported as events.
- **Three currencies that never convert**: XP for effort (level thresholds follow 60 x (L - 1)^1.8), growth points for the tree (a piecewise curve with an asymptotic tail that never completes), and kilograms for impact.
- **Anti-farming**
  - Scoring counts acts, not log entries: acts 1 to 6 of a day pay full XP, 7 to 12 half, later ones nothing.
  - Daily caps of 150 XP from logging and 30 growth points, and nine overlap groups that share a cap, so a vegetarian day and its individual meals cannot both be counted.
- **Kind streaks**: a rain bank covers missed days and refills weekly, the tree turns thirsty, then dormant after seven days, and nothing earned is ever taken away.
- **Content**: 32 daily, 24 weekly and 12 epic quests, 33 badges and 16 island props.
- **Persistence**: saved state passes a runtime schema check that reports the first bad field by path, unreadable saves are kept in a recovery slot, exports carry a SHA-256 checksum, and imports are validated before they replace anything.

👉 Because the engine is deterministic, the test suite plays three simulated users (lazy, typical and power) through a whole year and asserts that growth never shrinks on any day.

### ⚖️ 4. Honest Impact Estimates

Every figure is an estimate of emissions avoided against a stated alternative, and the interface says so.

- **A sourced factor table**: 51 actions in seven categories from 55 sources. Each factor has a central, low and high value, a confidence level (4 high, 26 medium, 11 low) and a written comparison.
- **Ten actions with no number**: litter picking, volunteering and similar actions have no credible figure, so they earn XP and print nothing.
- **Regional maths**: kilograms per unit = non-grid part + kWh per unit x the grid intensity of one of 45 regions, plus regional car, bus and rail factors.
- **Display rules**: an "≈" mark on every figure that opens the formula, range and source; two significant figures; never above the published high value; each log stores the factor version it was made with.
- **A starting line**: a six-question quiz gives a rough yearly footprint (about ±40%), and a pace metric projects the last four weeks against it.
- **Comparisons that cannot overclaim**: eight equivalences are phrased "roughly the CO2 from", and totals are never turned into "trees".

👉 A sceptic can open one page and check every number, comparison and source the app uses.

### 🌍 5. Live Planet Telemetry Through Our Own Server

The Impact page sets a user's totals beside the state of the planet without the browser ever calling a third party.

- **Five readings**: global temperature (NASA GISTEMP), atmospheric CO2, methane and nitrous oxide (NOAA), and CO2 per person (World Bank).
- **A fallback chain of up to four steps per reading**: the publisher's own file, a mirror, the last good answer the server holds, and a snapshot bundled with the app. Methane and nitrous oxide currently start at the mirror.
- **Validation before trust**: a reading of the wrong shape, outside a physically sensible range or too old is treated as a source that is down.
- **Caching**: upstream answers are cached for a day, failures retried after five minutes, and simultaneous requests share one round of upstream calls.
- **Truthful freshness**: a reading is marked "Live" only when its fetch time, taken from the upstream response's own date header, is under 36 hours old. Otherwise it reads "Snapshot from" and the date.

👉 The page is never empty and never claims to be live when it is not.

### 🤖 6. AI Coach With a Deterministic Fallback

Moss, the coach, works with a model and without one.

- **Server-side relay**: a route handler speaks the OpenAI-compatible chat protocol to a registry of twelve providers plus any custom endpoint, detects the provider from the key prefix, and fails over down an ordered chain while no token has reached the browser. Keys exist only on the server.
- **Streaming**: the upstream stream is re-emitted as a small, stable server-sent-event protocol with keep-alive comments.
- **Guard rails**: the system prompt is built on the server, context is sanitised, the user's name is never sent (the model writes a placeholder the browser fills in), and a token bucket limits each visitor to 30 requests an hour.
- **Action chips**: the model can end a message with tokens that name a catalogue action and quantity. A parser validates them, and the user's own tap logs through the same store operation as the Log page.
- **Built-in coach**: with no key, a deterministic intent matcher with weighted patterns answers from the same context block.
- **Say it in your own words**: a sentence is split into parts and matched by the model when one is configured, otherwise by built-in keyword rules and the catalogue's word index. Nothing is logged until the user confirms.

👉 The coach is useful with a key and still useful without one. The AI layer has 444 automated tests; the live path has been exercised against simulated providers and not yet against a real provider key.

### 🧪 7. A Demo World That Is Computed, Not Faked

Nobody can log for 200 days during a demo, so the app does it for them.

- **Replay**: 200 days of an ordinary, imperfect habit are played through the public game API by a seeded generator, in 10 ms slices so the page never freezes.
- **Sandbox**: the store redirects every read and write to a namespaced view in session storage and stops following other tabs, so the visitor's real save is never read or changed.
- **Tour as a state machine**: four steps that advance on real signals (a pointer on the island, an action-logged event, arriving on Impact, a question sent to the coach).

👉 Every number in the demo world, from its level to its kilograms avoided, was computed by the same rules a real user gets.

### 🔒 8. Local-First by Construction

Nothing in the core loop needs a server.

- **No account and no database**: state lives in the browser's localStorage, nothing is sent in the background, and the browser makes no third-party requests.
- **Your data**: export as JSON or CSV, import, or delete everything.
- **Offline**: a page that is open keeps working without a connection. There is no service worker yet, so opening the app still needs one.
- **No external assets**: geometry is generated in code, sounds are synthesised with Web Audio, and fonts are self-hosted.

👉 Privacy is a property of the architecture, not a setting.

## How We Built It

- **Framework**: Next.js 16.3 (App Router) with React 19.2 and TypeScript 5.8 in strict mode. Every feature page, the 3D scene, the charts, the coach panel and the command palette load as separate lazy chunks.
- **3D**: three.js 0.186 with React Three Fiber 9 and drei 10, plus postprocessing 6 on the high tier.
- **State and rules**: Zustand 5 with its persist middleware over a pure rules engine and memoised selectors that return the same object until a slice they read changes.
- **Interface**: Tailwind CSS 4 with design tokens, Radix primitives, Framer Motion 12, Recharts 3, cmdk and sonner.
- **Server**: four route handlers (chat, estimate, status, climate) whose logic sits in platform-free modules so it can be tested without a server.
- **Quality**: Vitest 3 with Testing Library (2,141 tests in 114 files), Playwright for end-to-end tests, ESLint and Prettier.

How one logged action travels through the system:

```text
tap a sticker / confirm a coach chip / confirm a "say it" proposal
        |
        v
gameActions.logAction(input)             interface (React client components)
        |
        v
store.run(operation)                     the single mutation path (Zustand)
        |
        v
transact(state, now, operation)          pure rules engine
   1. settle the calendar: days, rain, streak, quest periods
   2. run the operation: estimate kg, score the day's acts, apply caps
   3. reconcile: badges, quest progress, level and stage changes
        |
        +--> next state --> persist middleware --> localStorage
        |                   memoised selectors --> React re-renders what changed
        |                   world snapshot { growth, vitality, props, hour }
        |
        +--> events [action-logged, ring, quest-progress, badge-unlocked, level-up]
                 |
                 +--> feedback layer: receipt toast with Undo, sound, queued celebrations
                 |
                 +--> world bridge: events --> pulses --> emitPulse({ kind: "grow" })
                                                  |
                                                  v
                          pulse scheduler --> channels --> transforms, shader uniforms, particles
```

## Challenges We Ran Into

- **863 ms of style recalculation per second.** The first build of the world ran at about 30 frames per second. Browser performance metrics showed the cause was not WebGL: a 60-second CSS transition on registered custom properties on the root element restyled the whole document every frame while the sky colour moved. It only bit while the sky colour was changing, which is why the noon test scene looked fine. Removing it took style work from 863 ms to 13 ms per second.
- **A canvas that trailed the page by 60 px.** A fixed canvas positioned from script each frame cannot keep up with compositor scrolling. We moved the canvas node into the stage itself; drift went to 0 px and per-frame layout reads disappeared.
- **The wrong tier, and grass that paid for shadows per fragment.** Choosing quality by core count gave an integrated GPU the high tier at 23 ms of GPU time per frame, and 5,400 grass blades each did a five-tap shadow lookup. Classifying the GPU and one per-vertex crown-shade term fixed both.
- **A scroll hitch on the landing page.** The time-lapse previewed a new hour per scroll step and each step restyled the document for 50 to 60 ms. Writing the previewed sky on the stage element instead of the root cut long frames while scrolling from 34 to 2.
- **Numbers we refused to print.** Ten actions have no defensible factor, and several popular statistics were cut from the lessons because we could not confirm them from a primary source.

## Accomplishments We Are Proud Of

- A world that reacts the moment you log, at about 60 frames per second on integrated graphics, in about 40 draw calls and 56,000 triangles.
- 51 actions, 55 sources and 45 grid regions, all public on one methodology page.
- 2,141 automated tests, including year-long simulations of the game economy.
- A responsive audit of every route at ten widths from 320 to 1,920 px, in four saved states, at zero issues.
- three.js and the chart library are in no route's first load.

## What We Learned

- Measure before optimising: our worst frame cost was a style rule, not a shader.
- The tier most people land on is the product, so it has to be the designed one.
- A deterministic engine turns game balance into something a test can assert.
- Honesty is a design constraint: saying "estimate" on every figure forced a clearer interface.
- Building for the device first makes the server optional, and that simplifies almost everything.

## What's Next

1. Optional accounts with backup and sync, so a tree survives a cleared browser and follows you between devices.
2. A service worker, so the app also opens with no connection.
3. Kind reminders that never guilt-trip.
4. A real community: friends, challenges that track both sides, and groups ranked by effort instead of tonnes, with moderation in place first.
5. Running the live coach against real provider keys, then your own vehicle and energy data and more languages.

## Built With

Next.js, React, TypeScript, Tailwind CSS, three.js, React Three Fiber, drei, postprocessing, WebGL, GLSL, Zustand, Recharts, Radix UI, Framer Motion, cmdk, sonner, Lucide, react-markdown, canvas-confetti, Web Audio API, Web Share API, Server-Sent Events, localStorage, Vitest, Testing Library, Playwright, ESLint, Prettier, Node.js, NASA GISTEMP, NOAA Global Monitoring Laboratory, World Bank Indicators API, OpenAI-compatible chat completions API, Groq API (optional)
