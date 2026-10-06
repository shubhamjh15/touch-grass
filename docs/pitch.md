# Touch Grass: the pitch

Grow a living tree by shrinking your footprint.

This page describes the product as it is in the repository on 6 October 2026. The figures come from the app's own data files or from measurements on a running build. Where a figure has a published source, the source is named.

## One sentence

Touch Grass turns the climate actions you already take into honest CO2e estimates and a living 3D island that grows with you.

## Thirty seconds

Most people who try to live lighter never see whether it worked. A skipped 4 km drive is about 0.8 kg of CO2e, and nothing tells you. Touch Grass does. You log a real action in a few seconds, get an honest estimate with its source, and a tree on your own floating island puts on leaves. Miss a day and it rains; the tree never dies. There is no account, your data stays in your browser, and the coach answers with or without an AI key.

## Two minutes

People who want to cut their footprint run into three walls. The impact is invisible: nobody can feel 0.8 kg of CO2e. There is no feedback, so good intentions fade within days. And most climate content is a countdown, which makes people close the tab.

Touch Grass is a climate-habit companion built around a living world. You plant a tree in about a minute, with no account. Then you log what you really did: tap a sticker, or type "I cycled to work and skipped meat today" and the app finds the matching actions. Each log comes back with an estimate of the CO2e avoided, what it was compared with, a likely range and the source. Then the tree grows, on a 3D island you can turn, tap and explore.

The numbers are the part we are strictest about. Every figure carries an estimate mark and is rounded to two significant figures. All 51 actions and all 55 sources are on a public methodology page. Ten actions have no credible number, so the app shows none. Kilograms never turn into points, so a bigger footprint cannot win.

Around that loop there are daily rings, quests, 33 badges, 16 props that arrive on the island as you earn them, ten short lessons and a coach called Moss. The Impact page puts your own totals beside readings from NASA, NOAA and the World Bank, marked Live only when our server fetched them within the last 36 hours. Miss a day and it rains. The tree never dies.

It is a Next.js 16 app with a three.js world, a tested rules engine and no database. Your data stays in your browser, and you can export or delete it at any time. Next come optional accounts, sync and a real community.

## The problem

**The impact is invisible.** One kilometre not driven avoids about 210 g of CO2e, with a likely range of 140 g to 340 g (UK Government GHG Conversion Factors 2026, Department for Energy Security and Net Zero). Nothing in daily life shows it. A win you cannot see is hard to repeat.

**Effort goes to the small things.** Wynes and Nicholas (2017, Environmental Research Letters) put thorough recycling at about 0.2 t CO2e saved per person per year, against about 0.8 t for a plant-based diet and about 2.4 t for living car-free. Without numbers, people cannot tell which of their habits carry weight.

**It does add up.** The IPCC's 2022 mitigation report (Working Group III, Summary for Policymakers) finds that demand-side measures could cut greenhouse gas emissions in end-use sectors by 40 to 70% by 2050 compared with baseline scenarios. Most of that also needs better infrastructure and policy, which the app says in the same breath.

**The tools drop the loop.** A footprint calculator gives one verdict and goes quiet. A habit tracker knows nothing about carbon. Most climate content is fear, and fear gets attention but not a next step. This last point is our design position, not a cited finding.

The three sourced figures above are ones the app itself shows. They live in `src/data` (the action catalogue, the myth cards and their source lists) and are printed with their sources on the `/methodology` and Learn pages.

## What it does

1. **Plant.** Pick a name, one of three species (oak, cherry blossom, pine) and, if you like, a six-question quiz that gives a rough yearly starting line. It takes about a minute and asks for no account.
2. **Log.** Choose from 51 catalogued actions in seven kinds (Move, Eat, Power, Water, Stuff, Waste, Nature), describe a custom action, or say it in your own words. A log can be undone.
3. **See.** Each log shows about how much CO2e was avoided, what it was compared with, a likely range and the source. You earn XP for the effort, and the tree puts on leaves.
4. **Come back.** Three actions close the day's ring. Three daily and three weekly quests track themselves from what you log. A missed day is covered by rain; after a week away the tree rests, and it keeps every ring.

Also in the app:

- **Impact.** Your totals by category, the last 12 weeks, an activity calendar, everyday comparisons and your pace against your starting line. A second view shows the planet now: global temperature, CO2, methane and nitrous oxide in the air, and CO2 per person.
- **Learn.** Ten short lessons with three-question quizzes, ten myth cards and 30 daily facts, each with its source.
- **Moss, the coach.** Answers questions about habits, your numbers and how the app works, and can suggest an action. Only you can log one.
- **Community, in local mode.** A private journal, a share card made from a picture of your island, challenge links you send to a friend directly, and eight editorial notes. There is no feed and there are no invented users.
- **Touch grass break.** A timer that pays XP for ten minutes or more away from the screen.
- **Me.** A tree passport, badges, the island, settings, and your data: export as JSON or CSV, import, or delete everything.
- **A demo world.** "See day 200" on the landing page opens a grown island in a sandbox that never touches your own data, with a four-step tour.

## What is different

**You grow a world, not a chart.** The island is one live 3D scene. It follows your clock (dawn, day, golden hour, a moonlit night) and your tree's health. Drag to turn it, tap the tree and leaves fall, tap a prop and a note says what earned it. Explore mode opens it full screen with a photo button. Logging an action makes it react at once.

**Honest numbers, marked as estimates.** Every figure in the app carries the "≈" mark. The mark opens the formula, the comparison, the likely range and the source. Of the 51 actions, 41 have a sourced factor with a confidence level (4 high, 26 medium, 11 low) and 10 are marked "not quantified" and earn XP only. Electricity factors adjust to one of 45 regions. The app says "avoided", never "offset".

**Live planet data, labelled truthfully.** The Impact page shows five readings fetched by our own server from public sources: NASA GISTEMP for temperature, NOAA for CO2, methane and nitrous oxide, and the World Bank for CO2 per person. A reading is marked "Live" only if the server fetched it within 36 hours. Otherwise it says "Snapshot from" and the date.

**No account, and your data is yours.** Everything you log is stored in your browser, and none of it is sent anywhere in the background. There are no cookies, analytics or trackers. You can export it, import it or delete it. A page you have open keeps working if the connection drops: you can still log, and the tree still grows.

**A coach that works without a key.** With no AI key on the server, Moss answers from a built-in coach that reads your own log, and labels its answers "Built-in". With one free API key it becomes a live model. Either way it can only suggest: you confirm every log.

**Kind rules.** XP rewards effort, growth points grow the tree and kilograms measure impact. The three never convert into each other. Rain covers a missed day and refills each week. Growth, rings, level and badges are never taken away by absence.

## How it is built

Touch Grass is a Next.js 16 application (App Router, React 19, TypeScript in strict mode) styled with Tailwind CSS 4. The island is one WebGL scene built with three.js and React Three Fiber. It loads as a separate chunk after first paint, pauses when it is off screen, and picks one of three quality tiers from the graphics chip and from measured frame times. On a laptop with integrated graphics a production build ran it at about 60 frames per second. The game rules live in a pure TypeScript engine with no interface code in it. State is kept with Zustand and saved to the browser's localStorage. There is no database. The server does two jobs through four route handlers: it relays coach requests to an AI provider so the key never reaches the browser, and it fetches the climate readings so the browser never calls a third party. The repository holds 2,141 automated tests.

## Who it is for

We designed for three people. They are design personas, not research findings.

- **The anxious beginner.** Cares, feels guilty after reading the news, tried a footprint calculator once and never went back. Needs small wins that feel real, and kindness after a bad week.
- **The student who likes games.** Wants quests, streaks and something to dare friends with, and will try to break the rules. Needs rules that cannot be farmed.
- **The practical household lead.** Wants the three changes that matter, with sourced numbers, a baseline and a data export.

## What it is not

It is not a carbon-offset shop, an audited carbon ledger or a full footprint calculator. The figures are estimates of emissions avoided against a stated alternative, reported by the user. They are good for scale and for ranking actions, and the app says so on every one.

## What is next

1. Optional accounts with backup and sync, so a tree survives a cleared browser and follows you between devices.
2. A service worker, so the app also opens with no connection.
3. Kind reminders.
4. A real community: friends, challenges that track both sides, and groups ranked by effort instead of tonnes, with moderation in place first.

The details, a backend recommendation and the AI provider setup are in [roadmap.md](roadmap.md). A script for showing the product is in [demo-script.md](demo-script.md).
