# Submission Form Answers

Answers for Touch Grass as it is in the repository on 6 October 2026, under the same headings and in the same order as `submission_answers.md` in the repository root, which describes the earlier prototype. Each answer is one block, ready to paste.

## Project Title

Touch Grass

## Describe your project in one sentence (max 100 characters)

Log real climate actions, get honest CO2e estimates, and grow a living 3D island in your browser.

## Describe what your project does and its main features. How does it work from a user's perspective?

Touch Grass is a climate-habit companion. You plant a tree in about a minute, with no account, then log the real things you do: tap one of 51 catalogued actions or type a sentence such as "I cycled to work and skipped meat today". Each log returns an estimate of the CO2e avoided, marked "≈", with what it was compared with, a likely range and its source. Your tree then grows on a 3D island you can turn, tap and explore, and badges add props to it. Around that loop there are daily rings and quests, streaks that survive a missed day (it rains instead), ten short lessons, a coach called Moss that answers with or without an AI key, and an Impact page that sets your totals beside live readings from NASA, NOAA and the World Bank. Everything is stored in your browser and can be exported or deleted. A demo world shows a tree at day 200 without touching your own data.

## What were the biggest obstacles you faced during development? How did you attempt to overcome them?

First, the 3D world lagged: about 30 frames per second on a laptop with integrated graphics. Profiling found three causes: a CSS transition on the page root that restyled the whole document every frame, a quality tier picked from CPU cores instead of the graphics chip, and a canvas positioned by script that trailed scrolling by 60 px. With those fixed and the shadow pass drawn less often, a production build holds about 60 frames per second on the same laptop. Second, honesty: many popular actions have no defensible number. We built a table of 51 actions and 55 sources with a range and a confidence level for each, and we print no figure for the ten actions that have none. Third, free AI tiers change without notice, so the coach has a chain of fallback providers and a built-in coach behind them.

## What are you most proud of achieving? What milestones did you hit that felt significant?

A world that answers you: one WebGL scene that follows your clock and reacts the moment you log, at about 60 frames per second on integrated graphics. Numbers a sceptic can check: every figure is an estimate with its comparison, range and source, and the whole factor table is public on the methodology page. A demo world that replays 200 days through the real rules in a sandbox, so a visitor sees a grown island in seconds. And 2,141 automated tests, including simulations of the game economy.

## What new skills, technologies, or concepts did you learn while building this project?

Next.js 16 with the App Router and React 19, including route handlers that stream a response. Real-time 3D on the web with three.js and React Three Fiber: instancing, shader patches for wind, a governor that watches frame times, and measuring before optimising. Writing a pure, deterministic rules engine and testing it by simulating different kinds of user over a year. The basics of carbon estimates: counterfactuals, ranges, regional grid factors, and when not to print a number. Building a product that works on the device first and treats the server as optional.

## What are your plans for future development? What features would you like to add?

Optional accounts with backup and sync, so a tree survives a cleared browser and follows you between devices; we would add them on Supabase and keep signing in optional. A service worker so the app also opens with no connection. Kind reminders that never guilt-trip. Then a real community: friends, challenges that track both sides, and groups ranked by effort instead of tonnes, with moderation in place before any feed. Later: your own vehicle and energy data, more languages, and household and classroom modes.

## How does your project address environmental or social sustainability? What impact could it have?

Personal climate action is hard to keep up because it is invisible and unrewarded. Touch Grass gives a real action an immediate, honest answer and a reason to come back, without guilt: a missed day costs nothing permanent. It also points effort where it counts. Its lessons use published research showing that thorough recycling saves about 0.2 t CO2e a year while living car-free saves about 2.4 t (Wynes and Nicholas, 2017), and kilograms never convert into points, so a large footprint cannot win. By the app's own factor, a plant-based meal in place of a typical meal with meat avoids about 1.5 kg CO2e. If 1,000 people did that once a week it would come to about 1.5 tonnes a week. That is a self-reported estimate, not an offset, and the app says so on every figure. Socially, it is free, private and needs no account.

## List all technologies, APIs, frameworks, and tools used

Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind CSS 4, Radix UI, Framer Motion, three.js, React Three Fiber, drei, postprocessing, Zustand, Recharts, cmdk, sonner, Lucide icons, react-markdown, canvas-confetti, Fontsource (Space Grotesk, Tilt Warp, Martian Mono), Vitest, Testing Library, Playwright, ESLint, Prettier, Node.js, npm, Git, GitHub. Browser APIs: WebGL, Web Audio, localStorage and sessionStorage, Web Share, Web App Manifest, server-sent events. Data sources: NASA GISTEMP, NOAA Global Monitoring Laboratory (CO2 directly; methane and nitrous oxide through global-warming.org), World Bank Indicators API. AI: any OpenAI-compatible chat completions API, with Groq as the default provider; optional, with a built-in coach when no key is set.
