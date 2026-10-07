# Showcase images

Eleven gallery images for a submission page. Each is 2400 x 1600 pixels (3:2), a JPEG under 3 MB.
Every capture on them is the running app; nothing is drawn or staged.

| File | Caption to paste | Size |
| --- | --- | --- |
| [`01-cover.jpg`](01-cover.jpg) | Touch Grass: log small real-world climate actions, get an honest CO2e estimate, and grow a living 3D island. | 684 kB |
| [`02-living-world.jpg`](02-living-world.jpg) | The Today page: a living 3D island, generated in code, that follows your clock and grows with every action you log. | 761 kB |
| [`03-log-in-seconds.jpg`](03-log-in-seconds.jpg) | Logging takes seconds: peel a sticker, pick an amount, see the estimate before you commit, and get a receipt with Undo. | 804 kB |
| [`04-honest-numbers.jpg`](04-honest-numbers.jpg) | Honest numbers: every figure is an estimate that opens its formula, its comparison, a likely range and its source. | 739 kB |
| [`05-impact-and-planet.jpg`](05-impact-and-planet.jpg) | Impact: your own totals by category and week, next to live planet readings from NASA, NOAA and the World Bank. | 705 kB |
| [`06-live-coach.jpg`](06-live-coach.jpg) | Moss, the coach, answering a typed question live, with action chips you can log in one tap. The AI key never leaves the server. | 878 kB |
| [`07-the-game.jpg`](07-the-game.jpg) | The game: daily and weekly quests that track themselves, 33 badges, and a tree passport with one growth ring per day. | 912 kB |
| [`08-it-grows.jpg`](08-it-grows.jpg) | It grows: nine growth stages from seed to ancient, three species, and a sky that follows your day from dawn to night. | 888 kB |
| [`09-explore-mode.jpg`](09-explore-mode.jpg) | Explore mode: the island full screen, with labelled landmarks, camera controls and a photo button. | 663 kB |
| [`10-on-a-phone.jpg`](10-on-a-phone.jpg) | On a phone: the same island, the sticker sheet and your impact, with a thumb-reach tab bar. Nothing to install. | 854 kB |
| [`11-how-it-is-built.jpg`](11-how-it-is-built.jpg) | How it is built: Next.js, React, TypeScript and three.js; a pure rules engine under test; local-first, with no account and no database. | 801 kB |

## When a form allows only seven

Use these, in this order: `01-cover.jpg`, `02-living-world.jpg`, `03-log-in-seconds.jpg`, `04-honest-numbers.jpg`, `05-impact-and-planet.jpg`, `06-live-coach.jpg`, `11-how-it-is-built.jpg`.

They tell the whole story on their own: what it is, the world, the log, the honest numbers, the
planet, the live coach, and how it is built. The four left out (`07-the-game.jpg`, `08-it-grows.jpg`, `09-explore-mode.jpg`, `10-on-a-phone.jpg`) add depth where there is room.

## Making them again

```bash
npm run dev                          # the app on http://localhost:5173, in another terminal
node scripts/showcase-images.mjs     # all eleven, about eight minutes
node scripts/showcase-images.mjs 06  # one card
```

The script opens the running app in a browser on the real GPU, seeds the saved state
`scripts/fixtures/day200.json`, sets the page's clock to that day's afternoon so the island is in
daylight, and renders each card at twice the pixel density. Card 06 asks the coach a real question,
so it needs an AI key in `.env.local`; without one the built-in coach answers and the card says so.
The product video has its own notes in [video.md](video.md).
