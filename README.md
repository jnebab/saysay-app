# SAYSAY

A responsive, mobile-first daily Filipino history puzzle. SAYSAY launches as one web app for phones, tablets, and desktop browsers, following the low-friction model of early Wordle: one URL, one puzzle per day, no account required.

The app generates a deterministic catalog of 1,000 conflict-free sets from its reviewed history-group bank. A player starts with one **New Full Set** try. Replacing a set spends one try, and every two correctly solved groups earns another try. Set selection becomes progressively harder as the player’s successful streak grows; difficulty is intentionally not exposed as a manual setting.

Every grid dealt in a day is unique down to the group: a group of 4 blocks that has appeared on any earlier grid that day — won, lost, or swapped away — is never dealt again, so the day's 24-group bank yields six fully distinct grids before any reuse is possible. Selection looks ahead so an early pick never strands conflicting groups and cuts the day short. On top of that, no block from a set the player survived (won) reappears in later sets, with that history kept in local storage across days (last 12 survived boards). When the bank cannot satisfy every constraint, the oldest history is forgiven first and a never-before-dealt board is still guaranteed.

Players can use **Report inaccurate information** to prepare a contextual content report. Because v0.1 has no backend, the report opens the device share sheet and falls back to copying the report for sending through the user’s preferred channel.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. ES modules, puzzle fetches, and the service worker do not work correctly when `index.html` is opened directly from the filesystem.

## Add a puzzle

1. Copy an existing file in `puzzles/` and name it using its Manila calendar date: `YYYY-MM-DD.json`.
2. Give it a unique public `id` and matching `date`.
3. Add `easy`, `medium`, and `hard` arrays under both `levels` and `bonusLevels`.
4. Add exactly four groups to each level, with difficulties 1–4 and colors `g1`–`g4`.
5. Add exactly four unique words to each group. All sixteen words within a level must be unique.
6. Add English and Filipino group names and facts.
7. Add the puzzle to `puzzles/index.json`. Set `draft` to `false` only after editorial review.

Difficulty/share mapping:

| Difficulty | Color key | Share emoji |
|---|---|---|
| 1 | `g1` | 🟨 |
| 2 | `g2` | 🟩 |
| 3 | `g3` | 🟦 |
| 4 | `g4` | 🟪 |

Puzzle content is rendered as plain text. Do not put HTML in puzzle data.

## Translation policy

The app supports English and Filipino. Puzzle content should include both `en` and `tl` text, with English used as the final fallback if a Filipino field is temporarily unavailable.

## Deploy to Cloudflare Pages

Create a Pages project from this repository. Use no framework preset, no build command, and `/` as the output directory. The repository itself is the deploy artifact.

## Architecture

- `js/game.js` contains pure state-in/state-out logic and no browser APIs.
- `js/ui.js` owns DOM rendering, events, time, network access, and sharing.
- `js/storage.js` owns versioned local storage. Progress, active set, and New Full Set tries persist locally.
- `js/game.js` generates the 1,000-set catalog, filters word conflicts, and selects progressively harder sets from streak-based bands, never re-dealing a group seen earlier that day and skipping every word from survived sets.
- `js/i18n.js` owns user-facing strings and puzzle translation fallback.
- The service worker precaches the shell and runtime-caches puzzle JSON. Offline replay works after a puzzle has been fetched once.

## Later

- Archive browsing and expanded statistics
- Analytics, accounts, and leaderboards
- SvelteKit only if server-rendered pages or backend features become necessary
- Capacitor only if app-store distribution or native notifications become important
- Optional ₱299/year supporter gate after product validation
