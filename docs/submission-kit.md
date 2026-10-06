# Submission kit

Everything a hackathon submission form asks for besides the long description, ready to copy. It describes Touch Grass as it is in the repository on 6 October 2026. Character counts include spaces. The last section lists what only the owner can supply.

## Project name

Touch Grass

(11 characters)

## Taglines

Three options, each at most 60 characters. The first is the line the product itself uses.

1. Grow a living tree by shrinking your footprint. (47 characters)
2. Real actions. Honest numbers. A world that grows. (49 characters)
3. Log what you did. See what it avoided. Watch it grow. (53 characters)

## Description, about 140 characters

Log real climate actions, get an honest CO2e estimate with its source, and grow a living 3D island. No account. Your data stays in your browser.

(144 characters)

## Description, about 300 characters

Touch Grass is a climate-habit companion. Log the real actions you take, from a bus ride to a plant-based meal, and get an honest estimate of the CO2e avoided, with its range and source. A living 3D tree on your own island grows with every log. No account, no feed: your data stays in your browser.

(298 characters)

## Description, about 100 words

Touch Grass turns small climate actions into something you can see. You plant a tree in about a minute, with no account, then log what you really did: tap one of 51 catalogued actions or type it in your own words. Each log returns an honest estimate of the CO2e avoided, marked as an estimate, with its comparison, range and source. Your tree grows on a 3D island you can turn, tap and explore. Daily rings, quests, short lessons and a coach keep you going, and a missed day brings rain, never a dead tree. Impact sets your totals beside live readings from NASA, NOAA and the World Bank.

(109 words, 587 characters)

## Full description

The full description, written to be pasted whole into a long description field that renders Markdown, is `docs/project-story.md`.

## Short answers

For forms that ask these questions separately with tight limits. Two to four sentences each.

### What it does

You log real climate actions, by tapping one of 51 catalogued actions or by typing a sentence, and get an honest estimate of the CO2e avoided with its comparison, range and source. A tree on your own 3D island grows with every log, and badges add props to it. Daily rings, quests, ten short lessons and a coach called Moss keep the habit going, and the Impact page sets your totals beside live readings from NASA, NOAA and the World Bank.

(438 characters)

### How we built it

Touch Grass is a Next.js 16 app in strict TypeScript with React 19 and Tailwind CSS 4. The island is one procedural WebGL scene built with three.js and React Three Fiber, loaded as a lazy chunk and tuned for integrated graphics. The rules live in a pure, deterministic engine behind a Zustand store saved to localStorage, and four server route handlers relay the AI coach and fetch the climate readings.

(403 characters)

### Challenges

The 3D world first ran at about 30 frames per second. Profiling traced it to a CSS transition on the root element that cost 863 ms of style recalculation per second, a canvas that trailed scrolling by 60 px, and a quality tier chosen by CPU cores instead of the graphics chip. The other hard part was honesty: ten of the 51 actions have no defensible number, so the app prints none for them.

(391 characters)

### Accomplishments

The world runs at about 60 frames per second on a laptop with integrated graphics. Every figure is an estimate with a public source: 51 actions, 55 sources and 45 grid regions on one methodology page. A demo world replays 200 days through the real rules in a sandbox, and the repository holds 2,141 automated tests.

(315 characters)

### What we learned

Measure before optimising: our worst frame cost was a style rule, not a shader. A deterministic rules engine lets a test suite simulate a year of play. Saying "estimate" on every figure is a design constraint that made the interface clearer.

(241 characters)

### What's next

Optional accounts with backup and sync, so a tree survives a cleared browser. A service worker so the app opens with no connection, then kind reminders. After that a real community, with groups ranked by effort instead of tonnes and moderation in place first.

(259 characters)

## Built with

Next.js, React, TypeScript, Tailwind CSS, three.js, React Three Fiber, drei, WebGL, GLSL, Zustand, Recharts, Radix UI, Framer Motion, Vitest, Testing Library, Playwright, Node.js, Web Audio API, Server-Sent Events, localStorage, NASA GISTEMP, NOAA GML, World Bank API, OpenAI-compatible API, Groq

(296 characters)

The live AI coach is optional. With no key set, none of the AI services in this list is called.

## Tracks and categories it fits

- **Sustainability and climate.** The whole product is about everyday climate action, built on a factor table of 51 actions and 55 published sources.
- **Best use of 3D, WebGL or graphics.** The interface is a procedural, interactive 3D island that holds about 60 frames per second on integrated graphics.
- **Best design or user experience.** One world, one main action per screen, and a responsive audit of every route at ten widths with zero issues.
- **AI.** A coach with provider failover and streaming, a deterministic built-in fallback, and AI estimates that are capped and labelled. Enter this track only after the live coach has been checked with a real key.
- **Social good.** Free, private and usable without an account, with rules designed to remove guilt: a missed day costs nothing permanent.
- **Education.** Ten sourced lessons with quizzes, ten myth cards and 30 daily facts sit beside the habit loop.
- **Open data or public APIs.** Live readings from NASA, NOAA and the World Bank, fetched server-side and labelled Live only when they are fresh.
- **Privacy.** No account, no cookies, no analytics, no third-party requests from the browser, and full export and delete.

## What the owner still has to supply

### 1. A live demo URL

There is no public deployment yet. Touch Grass is a standard Next.js app that needs Node 20.19 or newer, and it should deploy to Vercel as it stands. A first deploy has not been done, so allow time to try it and to click through the result.

For the coach to answer live, set one server-side key from `.env.example` in the host's environment variables, for example `AI_API_KEY` with a free Groq key, and redeploy. With no key the built-in coach answers and says so. After deploying, open `/api/status` to see which coach is in, and open Impact, "The planet now", to see that the readings arrive.

### 2. A demo video

Record it by following the two-minute version in `docs/demo-script.md`. Use a desktop browser window about 1440 px wide. Record in daylight hours, or set Sky to "Always day" as the script describes, because the island follows the local clock. Decide whether the recording should carry the app's sounds.

### 3. Screenshots

Six screens worth capturing, and what to open for each. Capture them in daylight hours, or with Sky set to Always day inside the demo world, so the island is not shown at night.

1. **The landing page.** Open `/` in a browser with no saved data for the site. It shows: the island, the headline and the three demo stickers.
2. **A grown world.** Open `/demo`. It grows the demo world and lands on Today at day 200. It shows: the mature tree, the props, and the level, streak and total in the top bar.
3. **Logging in plain words.** Inside the demo world open `/log`, click "Say it in your own words" and then the first example. It shows: two matched actions with their amounts and estimates, before anything is logged.
4. **The planet now.** Inside the demo world open `/impact?view=planet`. It shows: the three live tiles with their sources and Live badges, and the charts below.
5. **Explore mode.** Inside the demo world open `/today` and click "Explore the island". It shows: the island full screen with its labelled landmarks.
6. **The methodology page.** Open `/methodology`. It needs no saved data. It shows: the counts (51 actions, 55 sources, 45 regions) and the factor table.

Good extras: the coach panel (`/coach` inside the demo world), the planting ceremony (`/start` with no saved data) and one phone-width capture of Today. The repository's screenshot tool can take the same pictures, for example `node scripts/shot.mjs --route demo --state fresh --wait 12000 --out demo.png`; add `--device mobile` for a 390 px phone.

### 4. The repository link

https://github.com/shubhamjh15/touch-grass (the value of `BRAND.repoUrl` in `src/lib/brand.ts`, which is also what the app's footer links to). Check that the repository is visible to the judges. It has no LICENSE file; add one if the hackathon requires an open-source licence.

### 5. Team member names

The repository does not list them. The app credits "Touch Grass team" and nothing more.

### 6. A statement of third-party assets and licences

This text is accurate for the repository today and can be pasted as it stands:

> Touch Grass uses no third-party 3D models, images, video or audio. Every object on the island is generated in code, the sounds are synthesised in the browser, and the illustrations and app icons are our own. The typefaces are Space Grotesk, Tilt Warp and Martian Mono, self-hosted under the SIL Open Font License 1.1. Icons in the interface come from Lucide (ISC licence). The software is built on open-source libraries under the MIT, ISC and Zlib licences, including Next.js, React, three.js, React Three Fiber, drei, postprocessing, Zustand, Recharts, Radix UI, Framer Motion and Tailwind CSS. Climate readings come from NASA GISTEMP, the NOAA Global Monitoring Laboratory and the World Bank, and emission factors from the published sources listed on the app's methodology page; each is credited where it is shown.

(816 characters)

### 7. One thing not to paste

`submission_answers.md` and `elevator_pitch.md` in the repository root describe the earlier prototype, EcoQuest. The current answers are in `docs/submission-answers.md`.
