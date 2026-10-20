# Rhythm Lab Record Store

> Tarik Moody's Bandcamp collection as a record shop you can browse: genre crates, real album art, and Bandcamp's own player.

**Status: early build.** The data side works: 1,215 records, real covers and colours. The website itself (milestone 2) and the 3D shop room (milestone 3) are designed but not built yet. Nothing is deployed.

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
| Website: cover grid, album pop-up, visitor crates with share links | Designed, not built |
| Enrichment: label, country, styles from Apple Music, MusicBrainz, Discogs | Designed, not built |
| 3D record-shop room (Three.js) | Planned |

## Quick start

Needs Node.js 26 (TypeScript files run directly; no build step for the pipeline).

```bash
git clone https://github.com/tmoody1973/rhythm-lab-record-store.git
cd rhythm-lab-record-store
npm install
npm test             # pipeline unit tests (offline)
npm run test:probe   # Subsonic probe tests (offline)
npm run typecheck
```

Building the real catalog needs Bandcamp Subsonic credentials (Bandcamp → Fan Settings → Subsonic), which only work for your own collection:

```bash
cp .env.example .env.local   # then fill in the SUBSONIC_* values
npm run catalog              # first run ~9 minutes (downloads every cover once), later runs ~3 seconds
```

`fixtures/catalog-sample.json` holds 20 real records without artwork, for development without credentials.

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
src/catalog/         catalog schema shared by the pipeline and the future site
tests/pipeline/      pipeline tests (Vitest)
fixtures/            sample catalog for development
docs/                build plan, specs, plans, decisions, design mockups, reports
```

## Ground rules this project keeps

- Only Bandcamp's official Subsonic service or Tarik's own files. No scraping, no browser cookies, no undocumented endpoints.
- Credentials never appear in code, logs, the catalog, or git. A `check-secrets` command verifies that after every run.
- Read-only access to Bandcamp: no playlist writes, no audio downloads.
- Album artwork belongs to its owners. Covers aren't committed to this repo; the site credits and links back to Bandcamp.

## Credits

- Inspired by and partly adapted from [chrija76/bookshelf](https://github.com/chrija76/bookshelf) (MIT, Copyright (c) 2026 chrija76), a Goodreads library as a 3D room. The cover colour extraction in `pipeline/palette.ts` is adapted from it.
- Built with [Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE) © 2026 Tarik Moody. Album artwork, music and Bandcamp's player are not covered by this license.
