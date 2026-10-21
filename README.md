# Rhythm Lab Record Store

> Tarik Moody's Bandcamp collection as a record shop you can browse: genre crates, real album art, and Bandcamp's own player.

**Status: early build.** The catalog (1,215 records with real covers and colours) and the website (cover grid, album pop-up with Bandcamp's player, visitor crates with share links) work locally. The 3D shop room (milestone 3) and enrichment are designed but not built yet. Nothing is deployed.

## What this is

Rhythm Lab is a radio show on Radio Milwaukee. Show prep means digging through a Bandcamp collection of about 1,300 purchases. This project turns that private habit into a public site where anyone can explore the collection like a record shop. They'll flip through crates by genre or by Tarik's picks, open an album, listen through Bandcamp's embedded player, and save their own picks.

It is also a portfolio piece about building with AI: every non-trivial decision is written up in plain English in [`docs/decisions/`](docs/decisions/). The design is in [`docs/superpowers/specs/`](docs/superpowers/specs/), and the visual source of truth is Tarik's mockups in [`docs/design/`](docs/design/).

## How it works

```text
Bandcamp's official Subsonic service ──► npm run catalog (on Tarik's Mac)
                                            │  lists every record, downloads each cover once,
                                            │  extracts its colours, writes a public catalog
                                            ▼
                     public/catalog.json + public/covers/   (no credentials, no private links)
                                            │
                                            ▼
                     static website (milestone 2): grid, album pop-up, Bandcamp's player
```

The public site never talks to Subsonic. It can't leak credentials, and it never streams Tarik's purchased files to visitors. Playback goes through Bandcamp's own embedded player, so every play also points back to the artist's page.

## What's built

| Piece | State |
| --- | --- |
| Feasibility probe for Bandcamp's Subsonic beta ([report](docs/IMPORT-COVERAGE.md)) | Done |
| Catalog pipeline: 1,215 records (1,088 albums, 127 single tracks), self-hosted WebP covers, colour palettes ([guide](docs/CATALOG.md)) | Done |
| Website: cover grid, album pop-up with Bandcamp's player, visitor hearts and crates with share links, Tarik's crates | Done (local, not deployed) |
| Enrichment: label, country, styles from Apple Music, MusicBrainz, Discogs ([coverage](docs/ENRICHMENT-COVERAGE.md)) | Done |
| 3D record shop as the front page: eight sections, cratedigger-style digging, 3D My crates, phones ([design](docs/superpowers/specs/2026-10-20-record-shop-design.md)) | Done (local, not deployed) |

## Quick start

Needs Node.js 26 (TypeScript files run directly; no build step for the pipeline).

```bash
git clone https://github.com/tmoody1973/rhythm-lab-record-store.git
cd rhythm-lab-record-store
npm install
npm test             # unit tests (offline)
npm run test:probe   # Subsonic probe tests (offline)
npm run typecheck
npm run e2e          # browser tests (uses the sample catalog, offline)
```

Building the real catalog needs Bandcamp Subsonic credentials (Bandcamp → Fan Settings → Subsonic), which only work for your own collection:

```bash
cp .env.example .env.local   # then fill in the SUBSONIC_* values
npm run catalog              # first run ~9 minutes (downloads every cover once), later runs ~3 seconds
```

Then run the site:

```bash
npm run dev                  # http://localhost:5173
```

`fixtures/catalog-sample.json` holds 20 real records without artwork, for development without credentials.

To curate a crate of your own picks: build it in the site (Add to crate), click **Copy share link** under My crates, then:

```bash
npm run import-crate -- "<share link>" --into staff-picks --name "Staff Picks"
```

That writes `content/crates.json`; a one-line note per record can go in `content/notes.json`. A crate with the id `staff-picks` hangs face-out on the shop's staff-picks wall.

### The 3D shop

The front page is a 3D record shop (React Three Fiber). Its furnishing is free CC0 art from Poly Haven, downloaded and slimmed once:

```bash
npm run decor                # brick, planks, walnut and two plants → public/decor/ (~2.8 MB, not committed)
```

Without it the shop still works in flat colours. Phones and low-memory devices get a lighter version; browsers that can't draw 3D (or whose graphics give out mid-visit) get the cover grid. `/?view=grid` always opens the grid.

## Environment variables

All live in `.env.local` (git-ignored). The site never sees them.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `SUBSONIC_URL`, `SUBSONIC_USER`, `SUBSONIC_PASSWORD` | catalog | Dedicated Bandcamp Subsonic credentials (never your main Bandcamp password) |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` | enrichment (planned) | Apple Music API (MusicKit key kept outside the repo) |
| `DISCOGS_KEY`, `DISCOGS_SECRET` | enrichment (planned) | Discogs consumer key and secret |
| `MUSICBRAINZ_CONTACT` | enrichment (planned) | Contact address MusicBrainz requires in requests |

## Project structure

```text
pipeline/            catalog step: Subsonic → catalog.json, covers, palettes
scripts/             Subsonic feasibility probe (read-only, with its own tests)
src/                 the website: catalog logic, URL state, crates, UI components
tests/               unit tests (Vitest) and browser tests (Playwright)
fixtures/            sample catalog for development
content/             Tarik's crates and notes (hand-editable)
docs/                build plan, specs, plans, decisions, design mockups, reports
```

## Ground rules this project keeps

- Only Bandcamp's official Subsonic service or Tarik's own files, with one exception: `npm run about` reads each record's public album page once for its description, credits and tags ([decision 008](docs/decisions/008-read-bandcamp-album-pages-for-notes.md)). No browser cookies, no logged-in pages, no undocumented endpoints.
- Credentials never appear in code, logs, the catalog, or git. A `check-secrets` command verifies that after every run.
- Read-only access to Bandcamp: no playlist writes, no audio downloads.
- Album artwork belongs to its owners. Covers aren't committed to this repo; the site credits and links back to Bandcamp.

## Credits

- Inspired by and partly adapted from [chrija76/bookshelf](https://github.com/chrija76/bookshelf) (MIT, Copyright (c) 2026 chrija76), a Goodreads library as a 3D room. The cover colour extraction in `pipeline/palette.ts` is adapted from it.
- The shop's crate-digging motion is ported from [risq/cratedigger](https://github.com/risq/cratedigger) (MIT, Copyright (c) 2015 Oz Conseil, Copyright (c) 2014 Daniel Tello).
- Textures and plants: [Poly Haven](https://polyhaven.com) (CC0). Font: Inter Tight (SIL OFL 1.1).
- Full licence texts: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Built with [Claude Code](https://claude.com/claude-code).

## Deploy

Vercel builds the site from GitHub: every pull request gets a preview link, and every merge to `main` (after CI passes) goes live. The build runs `npm run decor && npm run build` (see `vercel.json`): it fetches the CC0 decor from Poly Haven, then builds into `dist/`. The catalog, credits and covers are committed in `public/`; refresh them locally (`npm run catalog`, `npm run enrich`, `npm run about`), run `npm run check-secrets`, and open a pull request. Why: [decision 007](docs/decisions/007-deploy-from-github-to-vercel.md).

## License

[MIT](LICENSE) © 2026 Tarik Moody. Album artwork (`public/covers/`), album notes (`public/about/`), music and Bandcamp's player are not covered by this license; the artwork and notes belong to their artists and labels and are shown only to identify and introduce each record, with a link back to Bandcamp.
