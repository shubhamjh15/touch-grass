# Roadmap

What would come next for Touch Grass, in three parts: features, a backend, and AI providers with a free tier. It describes the repository as of 6 October 2026.

Two marks are used for facts about outside services:

- **Checked** means the figure was read on the vendor's own page on 2026-10-06.
- **Research** means: from research on 2026-10-06, check before relying on it.

Effort figures are our rough estimates for one engineer who knows the codebase. They are not commitments.

## Where the product stands today

Finished and working: the whole loop (plant, log, estimate, grow), the 3D world, quests and badges, Learn, Impact with live planet readings, the coach without a key, the demo world, export, import and reset.

Known gaps, stated plainly:

- **The live coach has not been run against a real provider key.** It is tested against simulated provider responses only. The model names in `server/ai/providers.ts` are the first thing to re-check.
- **There is no service worker.** A page that is open keeps working with no connection, but opening the app, reloading it, or opening a page for the first time in a visit needs one. The app's own wording runs ahead of this in three places: the Privacy page lists files cached "so the app opens without a network", the install hint under Me, Data says the installed app "works offline", and the landing page FAQ says it works offline once loaded, which holds only for pages already opened. Until the service worker ships, that wording should be narrowed.
- **Community is in local mode.** A private journal, a share card, challenge links and editorial notes. No accounts, no feed.
- **Real devices.** Automated checks run in Chromium, at desktop size and at phone sizes. The team's notes record no test on a physical phone, in Safari or Firefox, or with a screen reader.
- **Graphics.** On integrated graphics the app picks the medium tier, which is the one measured at about 60 frames per second. The high tier, with post-processing, has not been measured on a discrete graphics card.
- **Two planet readings come through a mirror.** Methane and nitrous oxide are read from global-warming.org, which republishes NOAA's series, and the page says "via". NOAA's own files for those two are not wired in yet.
- **Coach rate limits are per server instance and in memory.** They stop accidents, not a determined caller.
- **A tree lives in one browser.** Clearing site data loses it unless a copy was exported.

## A. Features worth building

Ranked by value to users and to a jury. Items marked "deferred" are the ones the product specification set aside on purpose for this release.

### First, close out what is partly verified (days, not weeks)

| Item                                                                                 | Why                                                                              | Rough effort |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------ |
| Run the live coach, custom estimates and "Say it" matching against a real Groq key   | It is the feature a jury will try first, and it has only met simulated providers | 1 day        |
| Test on a physical phone, in Safari and Firefox, and with a screen reader            | The product is designed phone first and has not been held in a hand              | 2 days       |
| Read methane and nitrous oxide from NOAA's own files, with the mirror as second step | Removes the one indirect source on the Impact page                               | 1 day        |
| Measure the high graphics tier on a discrete card                                    | It is the only tier with no numbers                                              | half a day   |

### Then, in this order

| #   | Feature                                                                                                                       | Why                                                                                                                         | Rough effort                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **Optional accounts with backup, then sync** (deferred)                                                                       | Today a cleared browser ends a 200-day tree. Backup removes the product's biggest risk and unlocks everything social        | 2 weeks to backup, 3 more for sync |
| 2   | **Offline start: a service worker and a real install**                                                                        | People log on a bus or a train platform. The app already says it opens offline, so this makes the wording true              | 3 to 4 days                        |
| 3   | **Kind reminders** (deferred)                                                                                                 | Brings people back on the days a habit slips. Needs a permission flow and wording that never guilt-trips                    | 1 week local, push after #1        |
| 4   | **A real community** (deferred): friends, challenges that track both sides, groups, boards ranked by effort instead of tonnes | Makes the product social without rewarding a large footprint. A jury can see it. Needs accounts and a moderation plan first | 3 to 4 weeks after #1              |
| 5   | **Your own factors** (deferred): your vehicle, your energy bills, hourly grid intensity, a sourced cooling factor             | Narrows the ranges, which is the honest way to make the numbers better                                                      | 2 weeks                            |
| 6   | **"Log for yesterday"** and streak repair (deferred)                                                                          | Lets an action remembered the next morning still count. Kept out so far to keep the day rules simple and hard to game       | 1 week                             |
| 7   | **Languages and right-to-left layouts** (deferred)                                                                            | Interface text already sits in copy files, one per feature                                                                  | 2 weeks for the first              |
| 8   | **Household and classroom modes** (deferred)                                                                                  | Several actions are per household already. A classroom mode suits schools and a jury                                        | 3 weeks, after #1                  |
| 9   | **Opt-in, privacy-preserving analytics** (deferred)                                                                           | The specification lists what to measure; nothing is collected today                                                         | 1 week                             |
| 10  | **More species, seasons by hemisphere, journal photos, merge on import, an adjustable daily goal** (deferred)                 | Depth for people who stay                                                                                                   | 1 to 3 days each                   |
| 11  | **Photo or sensor verification** (deferred)                                                                                   | Would make boards harder to cheat, at a real privacy and cost price. Self-report is the honest label until then             | 3 weeks or more                    |
| 12  | **Widgets, health and transit integrations** (deferred)                                                                       | Less typing, but each one is a platform project                                                                             | open                               |

### Not planned

- **Carbon offsets and any kind of shop.** The specification rules them out.
- **Tree-planting partnerships**, unless the partner is audited.
- **Invented users, likes or counters.** Boards and feeds will start empty and say so.

## B. The backend: accounts, sync and a real community

### What it has to do, and what it must not break

It has to provide sign-in, a durable copy of a user's data, sync between devices, and later the shared data a community needs: friends, groups, challenges, boards, posts and reports.

It must not sit on the path of "log an action, watch the tree grow". With the backend down, paused or not configured, the app must behave exactly as it does today. Accounts stay optional.

### Three options compared

|                                           | Supabase                                                                                                                                | Convex                                                                                        | Neon + Drizzle + Better Auth                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is                                | Hosted Postgres with sign-in, file storage, a scheduler and realtime in one project                                                     | A hosted TypeScript backend: database, server functions, scheduler and reactive queries       | Hosted Postgres, an ORM and an auth library that we assemble inside our own route handlers                                                          |
| Free plan (Checked)                       | USD 0. 50,000 monthly active users, 500 MB database, 1 GB files, 5 GB egress, 2 projects. Paused after 1 week of inactivity. No backups | USD 0. 1 million function calls a month, 0.5 GB database, 1 GB files                          | USD 0. 1 GB storage and 100 compute-hours per project, 5 GB egress. Compute sleeps after 5 minutes idle. Auth for up to 60,000 monthly active users |
| First paid step (Checked)                 | Pro from USD 25 a month: 100,000 monthly active users, 8 GB disk, 100 GB files, never paused, daily backups                             | Professional at USD 25 per developer a month: 25 million calls, 50 GB database                | Pay as you go: USD 0.106 per compute-hour, USD 0.35 per GB-month                                                                                    |
| Sign-in (Research)                        | Email link and code, Google, GitHub, and anonymous users that can be linked to an account later, all built in                           | An auth library still labelled beta; linking an anonymous user to an account is ours to write | A library in our own functions: magic link, OAuth and an anonymous plugin                                                                           |
| For a community (Research)                | SQL for boards, friends, groups and a moderation queue; row-level security; a dashboard with a user list and a table editor             | Reactive queries suit live feeds; no SQL for ad hoc questions                                 | SQL, but the API, file storage, scheduling and realtime are all ours to build                                                                       |
| Lock-in (Research)                        | Low. Standard Postgres; `pg_dump` and leave                                                                                             | Medium to high. The server code only runs on Convex                                           | Lowest                                                                                                                                              |
| Effort to accounts and backup             | About 1 week                                                                                                                            | About 1.5 weeks                                                                               | About 3 weeks                                                                                                                                       |
| Effort to full sync and a first community | 7 to 8 weeks in all                                                                                                                     | About the same                                                                                | 11 to 12 weeks in all                                                                                                                               |

The effort rows leave out stage 0 below: about one week of preparation inside the app, the same for every option.

### Recommendation: Supabase

1. **One free project covers everything the first two stages need**: sign-in, relational data, private files and scheduled jobs. Nothing has to run on a second compute platform beside the Next.js route handlers the app already has.
2. **Community features are relational problems.** Boards, friends, groups and a moderation queue are a few indexed SQL queries. Document stores need hand-kept aggregates.
3. **Guests can be upgraded.** An anonymous user can be linked to a real account later, so "no account needed" stays true (Research).
4. **The exit is cheap.** It is standard Postgres, so leaving is a database dump.
5. **Its weaknesses are tolerable for a local-first app.** Free projects pause after a week of inactivity and have no backups (Checked). Because the device stays the source of truth, a paused backend stops sync, not the product. Pro at USD 25 a month removes both limits.

**Runner-up: Convex.** Choose it instead if live, shared state becomes the centre of the product, or if a free tier that never pauses matters more than exit cost. No inactivity pause is documented there (Research).

**What it costs at hobby scale.** USD 0 for the backend on the free plan. Sign-in by email needs a sending domain, about USD 12 a year (Research); Google and GitHub sign-in do not. The first real bills are Supabase Pro at USD 25 a month (Checked) when pausing and missing backups stop being acceptable, and a paid hosting plan when the product becomes commercial (Research).

### The migration path from today's storage

**Where we start.** The whole game is one JSON document in the browser's localStorage under the key `touchgrass:game`, at schema version 1, validated on load, with a recovery copy for unreadable saves and a migration table that is still empty. Coach history and small interface settings have their own keys. The export file wraps that state in an envelope with a SHA-256 checksum, and import replaces rather than merges. Every log has an id, a timestamp, a local day key, a time-zone offset and the factor version it was made with. Ids are built from the time and a counter, so they are unique on one device but not guaranteed unique across devices. Totals such as XP, growth points, streak and badges are stored beside the logs. The rules engine is pure TypeScript, takes the clock as an argument, and can run on a server.

**Stage 0: prepare the local app. No backend. About 1 week.**

1. Write the first schema migration: globally unique ids for logs, breaks, journal notes and custom actions, and a tombstone instead of a deletion when something is removed.
2. Keep device preferences (3D quality, sound, motion, sky) apart from the profile and settings that should follow an account.
3. Teach the engine to rebuild every stored total from the stored facts, and test that a rebuild equals the saved state on the fixtures. It already re-scores a day after an undo, and the demo world already replays 200 days through the public interface.
4. Ship the service worker, and ask the browser for persistent storage.

**Stage 1: accounts and backup. About 1 week.**

1. Create the Supabase project. Sign-in is optional: Google, GitHub, or an email with a link and a six-digit code.
2. "Back up my grove" uploads the existing export envelope as one private, versioned row per user. A new device restores from it.
3. When the copy on the server and the copy on the device differ, ask which to keep. Label the state "Backed up" with a time, never "synced".
4. Reword the Privacy page: no account needed, and here is exactly what leaves the device if you choose to back up.
5. The coach's rate limit can now count per account as well as per visitor.

This stage alone removes the biggest risk in the product, and it does not need the engine changes of stage 2.

**Stage 2: sync. About 3 weeks.**

1. Replace the single document with facts in rows: logs, day marks, quest claims, lesson progress, breaks and journal notes.
2. The browser pushes its changed rows through one database function and pulls everything newer than its cursor. Browsers never write tables directly.
3. Merge by rule: logs are a set union in which a tombstone always wins; day marks are a union, so a streak can only get longer by merging; a quest claim keeps the earliest time; lesson progress keeps the best score; the profile merges field by field.
4. Totals are never synced. Each device recomputes them from the merged facts, so two devices that each earned 50 XP offline cannot disagree.
5. The offline queue is a "changed" flag on each row, not a second log.

**Stage 3: community. 3 to 4 weeks, after a moderation plan exists.**

1. Scores are computed on the server, from facts the server received, by the same rules engine the browser runs. Rank by effort, not by tonnes.
2. Start with friends and small groups, and challenge links backed by a server code. Boards start empty and say so.
3. Open a feed only when a moderation gate, reports, a kill switch and named moderators are in place.

The merge rules and the order of stages 2 and 3 follow the research. Stages 0 and 1 are cut to fit the storage the app has today. The variable names would be `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser and `SUPABASE_SECRET_KEY` for the server (Research: confirm the names against Supabase's current guide for Next.js).

## C. AI providers with a free tier

### What the app is set up for today

- **With no key**, the built-in coach answers, custom actions get no kilogram figure, and "Say it in your own words" matches against a built-in list. This is the state of the builds we checked on 2026-10-06.
- **The default provider is Groq.** It is first in the failover order, and `.env.example` names a free Groq key as the fastest path.
- **Default models for Groq, as written in `server/ai/providers.ts`**: chat tries `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`, then `qwen/qwen3.8-27b`. Custom-action estimates try `openai/gpt-oss-20b` first.
- **Failover.** When several keys are set, providers are tried in this order: groq, gemini, mistral, openrouter, cloudflare, sambanova, nvidia, cohere, cerebras, huggingface, together, vercel, custom. A request tries at most four entries, and the built-in coach answers if all fail.

### The variables to set

Copy `.env.example` to `.env.local` and fill in one line. None of the names starts with `NEXT_PUBLIC_`, so none reaches the browser. On a host such as Vercel, add the same names under the project's environment variables and redeploy.

The fastest path, one line:

```bash
AI_API_KEY=gsk_your_groq_key
```

The provider is detected from the key's prefix: `gsk_` is Groq, `sk-or-` OpenRouter, `AIza` or `AQ.` Gemini, `nvapi-` NVIDIA, `hf_` Hugging Face, `csk-` Cerebras, `vck_` Vercel AI Gateway. A key with no recognisable prefix (Mistral, Cohere, SambaNova, Together) also needs `AI_PROVIDER`, for example `AI_PROVIDER=mistral`.

| Variable                                                                                                                                                                                                                | What it does                                                                                                                                                       | Default               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `AI_API_KEY`                                                                                                                                                                                                            | One key; the provider is detected from its prefix                                                                                                                  | none                  |
| `AI_PROVIDER`                                                                                                                                                                                                           | Names the provider when the key has no known prefix                                                                                                                | none                  |
| `AI_MODEL`                                                                                                                                                                                                              | Replaces the default models for that key, for example when a provider retires one                                                                                  | none                  |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `SAMBANOVA_API_KEY`, `NVIDIA_API_KEY`, `COHERE_API_KEY`, `CEREBRAS_API_KEY`, `HUGGINGFACE_API_KEY`, `TOGETHER_API_KEY`, `AI_GATEWAY_API_KEY` | Named keys, for running several providers as a failover chain                                                                                                      | none                  |
| `CLOUDFLARE_AI_TOKEN` and `CLOUDFLARE_AI_ACCOUNT_ID`                                                                                                                                                                    | Cloudflare Workers AI needs both                                                                                                                                   | none                  |
| `AI_FALLBACK_ORDER`                                                                                                                                                                                                     | Comma-separated provider ids to try first                                                                                                                          | the order above       |
| `AI_BASE_URL` with `AI_MODEL`                                                                                                                                                                                           | Any other OpenAI-compatible endpoint. Must be https, except on localhost, so a local Ollama works: `AI_BASE_URL=http://localhost:11434/v1` and `AI_MODEL=llama3.2` | none                  |
| `ALLOWED_ORIGINS`                                                                                                                                                                                                       | Extra origins allowed to call `/api/*`. There is no wildcard                                                                                                       | the site's own origin |
| `AI_RATE_PER_HOUR`                                                                                                                                                                                                      | Requests per hour per visitor, per server instance                                                                                                                 | 30                    |
| `AI_MAX_CONCURRENCY`                                                                                                                                                                                                    | Upstream calls at once, per server instance                                                                                                                        | 8                     |
| `AI_MAX_OUTPUT_TOKENS`                                                                                                                                                                                                  | Longest reply in tokens, from 64 to 1,500                                                                                                                          | 600                   |

To confirm it worked, open `/api/status`. With no key it answers `{"configured":false,"provider":null,"model":null}`. By the code, a Groq key makes it answer `{"configured":true,"provider":"Groq","model":"openai/gpt-oss-120b"}`, a key it cannot use adds a `hint` that says why, and the tag in the coach panel changes from "Built-in" to "Live". Only the first of these has been seen on a running build.

### Providers and their limits

The model column is what the code tries first for chat.

| Provider              | Key variable          | First chat model in the code        | Free tier and limits                                                                                                                                                                        |
| --------------------- | --------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Groq** (default)    | `GROQ_API_KEY`        | `openai/gpt-oss-120b`               | Checked: 30 requests a minute, 1,000 requests a day, 8,000 tokens a minute and 200,000 tokens a day, for each of the three chat models. Research: no card needed                            |
| Google Gemini         | `GEMINI_API_KEY`      | `gemini-3.5-flash-lite`             | Research: free quotas are not published; reported at about 500 requests a day for this model. The free tier's terms exclude audiences under 18 and users in the EEA, the UK and Switzerland |
| Mistral               | `MISTRAL_API_KEY`     | `mistral-small-latest`              | Research: limits are not published. Free mode may train on prompts unless you opt out                                                                                                       |
| OpenRouter            | `OPENROUTER_API_KEY`  | `google/gemma-4-31b-it:free`        | Checked: 20 requests a minute and 50 a day on free models, 1,000 a day after buying USD 10 of credit once                                                                                   |
| Cloudflare Workers AI | `CLOUDFLARE_AI_TOKEN` | `@cf/openai/gpt-oss-120b`           | Research: 10,000 Neurons a day                                                                                                                                                              |
| SambaNova             | `SAMBANOVA_API_KEY`   | `gpt-oss-120b`                      | Research: 20 requests a day. Enough for a demo only                                                                                                                                         |
| NVIDIA NIM            | `NVIDIA_API_KEY`      | `nvidia/nemotron-3-super-120b-a12b` | Research: free for development and testing only; the terms do not allow serving real users                                                                                                  |
| Cohere                | `COHERE_API_KEY`      | `command-a-plus-05-2026`            | Research: trial key, 1,000 calls a month, development and testing only                                                                                                                      |
| Cerebras              | `CEREBRAS_API_KEY`    | `gpt-oss-120b`                      | Research: no longer free                                                                                                                                                                    |
| Hugging Face          | `HUGGINGFACE_API_KEY` | `openai/gpt-oss-120b:cheapest`      | Research: USD 0.10 of free credit a month                                                                                                                                                   |
| Together AI           | `TOGETHER_API_KEY`    | `openai/gpt-oss-120b`               | Research: prepaid only. The code marks this model name as a guess                                                                                                                           |
| Vercel AI Gateway     | `AI_GATEWAY_API_KEY`  | `openai/gpt-oss-120b`               | The code marks the free model list as unverified                                                                                                                                            |

### What the limits mean for the coach

- **Groq's daily token limit binds first.** At about 1,500 tokens for one question and answer, 200,000 tokens a day is roughly 130 exchanges a day on one model, and 8,000 tokens a minute is about 5 a minute (Research estimate). The three Groq models each have their own allowance, and the failover chain uses them in turn.
- **Every visitor shares the one key.** The app's own limiter allows 30 requests an hour per visitor, but it counts per server instance and in memory. For a public launch, move it to a shared store.
- **When a limit is hit**, the next provider in the chain is tried, and after that the built-in coach answers and says so. Nobody sees an error page.
- **Model names expire.** Free tiers retire models often (Research). A retired name is skipped by the failover chain, and `AI_MODEL` replaces it without a code change.

### Before relying on the live coach

1. Set one key and open `/api/status`.
2. Ask Moss one question and watch the answer stream.
3. On the Log page, try a custom action and "Say it in your own words", and check that the result is labelled as coming from the AI.
4. Read the provider's data-use terms and name the provider on the Privacy page, which already says that coach messages go to the configured provider through the app's own server.
