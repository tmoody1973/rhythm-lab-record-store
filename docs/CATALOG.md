# The catalog step

`npm run catalog` turns your Bandcamp collection, read through Bandcamp's official Subsonic service, into the files the website loads. It runs on your Mac only; the website never talks to Subsonic.

## What it does, in order

1. Logs in to Subsonic with the dedicated credentials in `.env.local` (token login; your password never travels).
2. Lists every record with `getAlbumList2`, 500 per page. If the listing stops early for any reason, it **refuses to write anything** and leaves the previous catalog untouched.
3. For each record, gets its cover: from the cache if already downloaded, otherwise from Subsonic's `getCoverArt`, falling back to Bandcamp's public image server (`f4.bcbits.com`). Each cover is saved as two WebP files (300 px for the grid, 1000 px for the album pop-up) and its colours are extracted: a dominant background colour, an accent, and a readable text colour.
4. Writes `public/catalog.json` in one step (a crash can't leave half a file), then prints a summary.

## Records

Subsonic returns two kinds of record:

- **Albums** (`a:<n>`, 1,088 on 2026-10-19) → `bandcamp:album:<n>`.
- **Single tracks bought on their own** (`t:<n>`, 127) → `bandcamp:track:<n>`.

`<n>` is Bandcamp's own id, so the website builds Bandcamp's embedded player from it (`EmbeddedPlayer/album=<n>` or `track=<n>`).

## How long it takes (measured 2026-10-19)

| Run | Requests | Time |
| --- | --- | --- |
| First ever (all 1,215 covers) | about 1,220 | about 9 minutes |
| Later runs, nothing new | 3 | about 3 seconds |
| Later runs, new purchases | 3 + one per new record | a few seconds per record |

## Where things go

| Path | What | In git? |
| --- | --- | --- |
| `public/catalog.json` | The public catalog (no credentials, no Subsonic addresses) | No, generated |
| `public/covers/` | 2 WebP files per record, named `<kind>-<n>-ca<coverId>-<size>.webp` so new artwork gets new files (~118 MB) | No, generated; album art isn't committed |
| `data/.cache/covers/` | Original downloads and extracted colours (~96 MB) | No |
| `fixtures/catalog-sample.json` | 20 real records (17 albums, 3 tracks) without covers, for development and tests | Yes |
| `content/*.json` | Your crates and notes | Yes; this step reads them but never writes them |

To force covers to rebuild, delete `public/covers/` (fast, rebuilt from the cache). To re-download them, delete `data/.cache/covers/` (slow; about 1,215 requests).

## The summary

Each run prints: records written (albums and single tracks), records skipped, covers by source (cache, Subsonic, Bandcamp, none), cover download failures and colour fallbacks, records added and removed since the last run, crate entries that now point at missing records, request count and elapsed time. Removed records and broken crate entries are reported, never deleted.

## Credits

The colour extraction is adapted from [chrija76/bookshelf](https://github.com/chrija76/bookshelf) (MIT, Copyright (c) 2026 chrija76).
