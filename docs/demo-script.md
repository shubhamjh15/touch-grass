# Demo script

A two-minute walk through Touch Grass that a presenter can follow word for word, a 30-second fallback, what to do when something goes wrong, and honest answers to the three questions a jury is most likely to ask.

Every click below was walked on 6 October 2026 in a desktop Chromium browser at 1440 x 900. Button labels are quoted exactly as they appear on screen. Numbers that depend on the day are marked.

## Before you start

- **Use a desktop browser window at least 1280 px wide.** On a phone the same steps exist, but the navigation is a tab bar and the tour is a strip above it.
- **Use a browser that has no tree planted for this site** (a fresh profile, or site data cleared). If a tree is already planted there, "Start my own" and "Exit" return to that tree instead of the planting screen.
- **Do the real run in a new tab.** The tour remembers, per tab, that it was finished or skipped. If it does not appear, click "Tour" in the demo banner.
- **Know which coach is in.** Open `/api/status` on the same site. `"configured":false` means the built-in coach will answer. `"configured":true` names the live provider and model. Both work in the demo; say which one the audience is seeing.
- **Decide about sound.** The app plays short sounds by default (Me, Settings, Sound).
- **After dark, read "Evening lighting" below.** The island follows the clock of the machine it runs on.

## The two-minute demo

The spoken lines add up to about 260 words. Talk while you click.

### 1. Landing page (0:00, 10 seconds)

**Do.** Open the home page. Drag the island a little to turn it.

**You should see.** The island on the left with a "Drag to turn" chip, the headline "Grow a living tree by shrinking your footprint." and three buttons: "Plant your tree", "Try it first" and "See day 200".

**Say.** "This is Touch Grass. People who try to live lighter never see whether it worked. We made it visible: a live 3D island that follows the clock on this laptop."

### 2. Try it without signing up (0:10, 15 seconds)

**Do.** Click "Try it first". The focus jumps to the three stickers under the tree. Click "Biked 5 km".

**You should see.** The sticker flies to the tree and the tree grows. The line above the receipt reads "Demo tree: Seedling. 4 more stickers to Sapling." A "Demo receipt" prints "Biked 5 km ≈1 kg", and under it "Biked 5 km: ≈1 kg CO2e avoided vs. the same trip in an average car."

**Say.** "No sign-up. I tap one thing I did. The tree grows and a receipt prints: about one kilogram of CO2e avoided, against the same trip in an average car. Every number says what it is compared with."

### 3. Open the demo world (0:25, 13 seconds)

**Do.** Click "See day 200".

**You should see.** A card titled "Growing a demo world" counts through 200 days for about three seconds. Then the Today page opens with a grown oak. A banner under the top bar reads "Demo world · Nothing is saved" with "Tour", "Start my own" and "Exit". The name tag reads "Fern · Oak · Mature tree · Day 200 · Thriving". On 6 October 2026 the top bar showed level 25, a 97-day streak and 533 kg avoided; read the numbers off the screen. A card reads "1 of 4 · This world is alive".

**Say.** "A judge cannot log for 200 days, so the app replays 200 days through its real rules. Level 25, a 97-day streak, about 530 kilograms avoided. Nothing in here is saved."

### 4. Tour step 1: the world (0:38, 10 seconds)

**Do.** Click the bench, to the left of the trunk beside the path. Then drag the island.

**You should see.** A small note: "Bench. Built from reclaimed planks after 5 Stuff actions." The tour card changes to "That is it. Every prop out there was earned by a real action." and moves to step 2 by itself after about two seconds.

**Say.** "I can turn it and tap things. This bench arrived after five Stuff actions. Every prop was earned."

### 5. Tour step 2: log an action (0:48, 27 seconds)

**Do.** Click the green "Log an action" button under the island. On the Log page click "Say it in your own words", the bar above the search field. In the sheet, click the first example: "I cycled to work and skipped meat today". (Typing the sentence and clicking "Find my actions" does the same.) Then click "Stick 2 on".

**You should see.** Under "Here is what that sounds like." two ticked actions: "Walked or cycled instead of driving", 3 km, 630 g CO2e avoided, and "Vegetarian day", 1 day, 2.9 kg CO2e avoided. "Together" reads 3.5 kg. After "Stick 2 on", two notes appear, each reading "Stuck. Fern grew." with its estimate, its XP and an "Undo" button; the second adds "ring closed". The island in the left rail throws leaves. The status line changes from "1 more action closes today's ring." to "Ring closed. See you tomorrow?" The tour moves to step 3 by itself after about four seconds.

**Say.** "I can tap a sticker, or say it in plain words. It found two catalogue actions with an estimate each, and nothing is logged until I confirm. Stuck. That closed today's ring, and the tree answered."

### 6. Tour step 3: honest impact and the planet (1:15, 22 seconds)

**Do.** Click "Impact" in the top bar. Then click "The planet now".

**You should see.** First "Your impact": "Avoided so far", about 540 kg CO2e after the two logs, with charts by category and for the last 12 weeks. Then "The planet right now": three tiles, each with a source link and a badge. On 6 October 2026 they read: global temperature +1.4 °C for August 2026 against the 1951 to 1980 average (NASA Goddard Institute for Space Studies); CO2 in the air 428 ppm on 5 October 2026 (NOAA Global Monitoring Laboratory); CO2 per person, world, 4.7 t a year for 2024 (World Bank). The badge reads "Live" or "Snapshot from" a date.

**Say.** "My totals, by category and by week. Beside them the planet's own numbers from NASA, NOAA and the World Bank, fetched by our server. The badge says Live only when a reading is under 36 hours old. Otherwise it says Snapshot, with the date."

**If there is time.** Click the "≈" mark beside "Avoided so far" before switching views. It opens "How we got this": the number of logs, the formula, "You report it, we estimate it." and a link to the methodology page.

### 7. Tour step 4: ask the coach (1:37, 13 seconds)

**Do.** Click "Next" on the tour card. Click the green face in the top bar ("Ask Moss, your coach"). In the panel, click the suggestion "What's my biggest lever?" or type a question and click the send button.

**You should see.** A panel titled "Moss" with a tag that reads "Built-in" or "Live". With the built-in coach the answer is headed "Moss · Built-in answer" and, on 6 October 2026, began "Your starting line: 6.8 t a year, mostly food and home." It ends "A rough guess, not a verdict." and offers a lesson to read. A few seconds later the tour card reads "That is the whole loop."

**Say, with the built-in coach.** "The coach. I ask in plain words and it answers from this tree's own data. This is the built-in coach, and it says so. With one free API key the same box is a live model."

**Say, with a live key.** "The coach. I ask in plain words and it answers from this tree's own data. This is a live model, called through our own server, so the key never reaches the browser. Without a key a built-in coach answers instead."

### 8. Explore mode (1:50, 6 seconds)

**Do.** Close the coach with the X. Click "Today" in the top bar, then "Explore the island" at the bottom right of the island. The tour's closing card can stay where it is.

**You should see.** The island full screen. Labels point at seven landmarks (Log, Quests, Learn, Impact, Community, Ask Moss, Passport). A list "What is here (15 of 16)" names the props. The controls along the bottom turn, zoom and reset the view, and "Photo" saves a picture of the island.

**Say.** "Explore mode: the island full screen, with a photo button."

### 9. Exit and start for real (1:56, 4 seconds)

**Do.** Press Escape or click "Close". Click "Start my own" in the demo banner (the same button is on the tour's closing card).

**You should see.** The planting screen: "Let's plant." with three promises (Private, Honest, Kind) and one button, "Let's plant".

**Say.** "That was a demo. Yours starts as a seed, in about a minute, with no account."

### If you have 40 more seconds: plant the tree

Click "Let's plant", "Next" (your name is optional), "Next" (pick a species and a name), "Skip for now" (the starting-line quiz), "Next" (focus areas), "Go plant". Then press and hold the seed for one and a half seconds, or click "Plant". With a tree named Sol, the screen reads "Sol is planted. Ring 1 is yours." and "+25 XP". Click "Give Sol its first leaf" to land on Today at day 1, with a sprout on a bare island.

## The 30-second version

1. **(0:00)** On the landing page, click the "Biked 5 km" sticker. Say: "Touch Grass. Log a real action, get an honest estimate, and a tree grows. That was about one kilogram of CO2e, against the same trip by car."
2. **(0:08)** Click "See day 200". Say: "This is day 200, replayed through the real rules. Nothing here is saved."
3. **(0:16)** Drag the island once. Click "Impact", then "The planet now". Say: "Your own numbers beside readings from NASA, NOAA and the World Bank, marked Live only when they are fresh."
4. **(0:26)** Click "Start my own". Say: "No account. Yours starts as a seed."

## If something goes wrong

### No network

What happens, as checked on a local production build:

- A page that is already open keeps working. You can log, the ring closes and the tree reacts. A status line reads "Offline · everything still saves".
- The coach answers from the built-in coach.
- A page you opened earlier in the visit still opens. A page you have not opened yet shows "This page did not load. You are offline and this page is not saved on this device yet." with a "Back to the grove" link.
- Reloading, or opening the site, fails. The app has no offline start yet.
- "The planet now" keeps the readings it already has.

By design, read from the code and not exercised on the day: when the server is reachable but a source is not, that reading falls back to the last good one or to a copy saved with the app, and is marked "Snapshot from" its date instead of "Live".

What to do: before the session, walk the whole path once so every page has been opened. If the venue network is unreliable, serve the app from the presenting laptop: stop any development server in that folder, then run `npm run build` and `npm run start` (http://localhost:3000). Only the live planet readings and a live coach then depend on the internet, and both have a labelled fallback.

### No WebGL

What happens: an illustrated tree takes the island's place automatically. Logging, quests, Impact and the coach are unaffected, and the tour's first step can be passed with "Next".

What to do: this usually means hardware acceleration is switched off in the browser. Switch it on and reload, or use another browser. Also check Me, Settings, "3D quality": it must not be set to "Still illustration". If the 3D is there but slow, set the same control to "Low".

### Evening lighting

What happens: the island follows the local clock, so after dark it shows a moonlit night. In the demo world the lantern is lit and fireflies are out. That is intended, and worth one sentence: "It is night on the island because it is night here."

What to do if you want daylight: inside the demo world, click the tree icon at the right end of the top bar, open the "Settings" tab, and set "Sky" to "Always day". Then click "Today". This takes three clicks and was checked on 6 October 2026 at 10:42 pm. The setting lasts until you leave the demo world. A first visit to the landing page has no such switch and always follows the clock.

### The tour card is missing

Click "Tour" in the demo banner. It starts again from step 1.

### "The demo world would not grow."

Click "Try again". Nothing was changed. If it fails twice, click "Plant your tree" on the landing page and show the planting flow and a first log instead.

## Three questions a jury will ask

### How accurate are the numbers?

They are estimates, and the app says so on every one. Each figure is the emissions avoided against a stated alternative, for example a kilometre walked against the same trip in an average car. It is not a measurement, an offset or carbon accounting, and it depends on the user reporting honestly.

What we do to keep it honest: 41 of the 51 actions have a factor from a published source, with a central value, a low and a high value and a confidence level (4 high, 26 medium, 11 low). The other 10, such as litter picking and volunteering, have no credible figure, so the app prints none and awards XP only. Figures are rounded to two significant figures and never exceed the published high value. Electricity factors adjust to 45 regions, and car factors have a world default plus values for the United States and India. Daily caps and overlap rules stop one habit being counted twice. Most transport, waste and home-energy factors are UK or US values, which the methodology page states. The whole table and all 55 sources are on `/methodology`.

### Why is there no backend yet?

It is a choice, and it has a cost. With no account and no database, starting takes a minute, nothing personal sits on a server, and the core loop cannot be slowed or stopped by one. The server only relays coach messages, so the AI key stays off the browser, and fetches the public climate readings.

The cost: a tree lives in one browser. Clearing site data loses it unless you exported a copy, there is no second device, and Community is in local mode: a private journal, a share card, challenge links and editorial notes, with no feed and no invented users. The next step is optional accounts with backup and sync. The plan and the migration path are in [roadmap.md](roadmap.md).

### How is the AI used?

In three places, all optional. Moss, the coach, answers questions and can suggest an action. A custom action that is not in the catalogue can get a cautious estimate, capped at 2 kg per log and 5 kg per day and kept out of the headline total. "Say it in your own words" can use the model to match a sentence to catalogue actions.

The guard rails: the model never logs anything, the user confirms every log. The system prompt is built on the server, and the browser cannot choose the model or the prompt. The user's name is never sent, and the block of stats sent with a message can be switched off. Requests are rate limited to 30 an hour per visitor on each server instance. Without a key, or when the provider fails, a built-in coach answers and is labelled "Built-in".

One honest caveat: the live path has been tested against simulated provider responses only. No real provider key has been used with this build yet, so check it with a key before relying on it in front of an audience.

## What was and was not checked

- Checked on 6 October 2026: every step above and the "Always day" setting in a development build, and the demo world, the prop notes and the offline behaviour on a local production build. The browser console showed no errors.
- Not checked: the live coach and AI matching with a real key, a physical phone, Safari or Firefox, and a screen reader.
- With a live key, step 5 may match the example sentence through the model instead of the built-in list, and the amounts may differ. Rehearse it.
