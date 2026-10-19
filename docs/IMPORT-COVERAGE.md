# Bandcamp Subsonic — import coverage report

Probe run: 2026-10-19 · Script: `scripts/subsonic-probe.mts` · Spec: `docs/superpowers/specs/2026-10-19-subsonic-feasibility-design.md`
Evidence: `out/` (gitignored): `auth.json`, `enumerate.json`, `coverage.json`, `art.json`, `ids-2026-10-19.json`, `catalog-sample.json`, `run.log`.
Baseline (public profile, 2026-10-19): 1,296 collection items, 71 wishlist items. Hidden purchases: **none, per Tarik (not verified by the API).**

## Bottom line

The official Subsonic beta can supply the catalog. Login, listing every album, artwork and private full-length streaming all work, using 78 logged requests in total across every run, all read-only. It does **not** supply the wishlist or Bandcamp page links. However, its album IDs **are Bandcamp album IDs**: `a:3274104668` opened Bandcamp's embedded player for the correct album, and that player links to the canonical page. Verified on **one** album so far.

## 1. Authentication

- **Works:** token auth (`t = md5(password + salt)`, `s = salt`) at `https://bandcamp.com/api/subsonic/rest/<endpoint>`. Server reports `type: BandcampServer`, `serverVersion: 1.0`, `version: 1.16.1`, `openSubsonic: true`.
- **No OpenSubsonic extensions** (`[]`), so there is no API-key login and no extras such as `songLyrics` or `formPost`.
- **Quirks (nonstandard):**
  - `ping` accepts any credentials, even a wrong password, so `ping` cannot test a login.
  - Data endpoints reject a wrong password or no login with **HTTP 500**, not Subsonic error 40.
  - `getOpenSubsonicExtensions` without a login also returns HTTP 500.
  - Practical effect: if the credentials are ever revoked, every call fails with 500, which looks like an outage. The app's error message should say "check your Subsonic credentials".

## 2. Enumeration

| Measure | Value | Unit note |
|---|---|---|
| Albums (`getAlbumList2`, alphabetical, 500 per page) | **1,215** in 3 pages (the whole `enumerate` stage, 37 requests, took 34 s) | Subsonic "albums". Packages and single-track purchases appear here as albums. |
| Artists (`getArtists`) | 899 | |
| Songs (sum of album `songCount`) | 4,287 | Songs, not collection items |
| Albums with exactly 1 song | 761 | Includes singles. A single-track purchase from a longer album can't be told apart from a single release using this data alone. |
| Duplicate IDs across pages | 0 | |
| Music folders | 1, "Collection" | |

- **Gap vs. baseline:** 1,215 albums against 1,296 collection items leaves **≈81 items unaccounted for**. Likely candidates: merch-only items with no music, single-track purchases folded into a parent album, or items Subsonic omits. Not resolved.
- **`search3` with an empty query** returned only 403 albums, so it can't list the whole library. `getAlbumList2` is the enumerator. Search is for finding single items.
- **Fallback endpoints** (`getIndexes`, `getMusicDirectory`, `getSong`) were not needed and not called.

## 3. Item identity

IDs are strings with a type prefix, for example:

| Prefix | Example | Meaning (inferred) |
|---|---|---|
| `a:` | `a:3274104668` | album ("Edge Conditions") |
| `t:` | `t:1816891202` | track |
| `b:` | `b:2239178` | artist/band (also the album's `parent` and `artistId`) |
| `ca:` | `ca:3951378974` | cover art |

**`a:<n>` = Bandcamp album ID: verified on one album.** Tarik opened `https://bandcamp.com/EmbeddedPlayer/album=3274104668/size=large/` in his own browser (2026-10-19). It showed "Edge Conditions by Jeremiah Chiu" with matching artwork, and its title linked to `https://intlanthem.bandcamp.com/album/edge-conditions?from=embed`. Still inference: `t:<n>` is the Bandcamp track ID and `ca:<n>` the Bandcamp art ID.

**Field coverage** (album list, n = 1,215): `id`, `name`, `artist`, `coverArt`, `songCount`, `duration`, `playCount` are all at 100%. `genre` is at 90.3% and `created` at 43.6%. `artistId` and `year` appear only in album detail and song objects.
**Songs** (25 sampled albums, 78 songs): `id`, `title`, `artist`, `album`, `duration`, `contentType`, `suffix`, `bitRate`, `size`, `year`, `genre` at 100%; `albumId`, `parent`, `track` at 97.4%; `created` at 69.2%. Sample bitrate: 256 kbps MP3.
`created` looks like a date (e.g. `09 Oct 2026 00:00:00 GMT`), but its meaning isn't confirmed. Don't use it as a purchase date.

## 4. Artwork

5 of 5 `getCoverArt` requests (size 600) returned `image/jpeg`, 31–130 KB, in 0.1–0.4 s. **0 albums are missing `coverArt`.** Cover URLs need credentials, so a public or shareable catalog can't link to them directly. It needs a private proxy or a deliberately exported image set. Rights for public reuse are a separate question.

## 5. Canonical Bandcamp links

**No URL field.** No field contains a URL or the word "bandcamp". The ⚑ flags in `coverage.json` on `artist`, `name` and `size` are false alarms from the text/number heuristic. **Route that works (verified on 1 album):** build `https://bandcamp.com/EmbeddedPlayer/album=<n>/…` from the `a:<n>` ID. The embedded player itself carries the "Open on Bandcamp" link to the canonical page, so no URL mapping is needed for albums that embed. Still to check: albums whose artist removed or hid the release, packages, and single-track purchases.

## 6. Coverage gaps

| Item | Result | Evidence |
|---|---|---|
| Wishlist (71) | **Not available.** `getStarred2` isn't implemented; it returns `{"error":true,"error_message":"bad version"}` (body seen in a diagnostic call; `coverage.json` records it only as "no subsonic-response"). | `run.log`, `coverage.json` |
| Playlists | Endpoint works; Tarik has none (`[]`) | `coverage.json` |
| Packages | **Included as their music.** "Cuban Beat & Fantasia (1970-1980)…" appears as album `a:3961164446`, 12 songs. | spot-check |
| Album purchase | Included. "Edge Conditions", Jeremiah Chiu, `a:3274104668`, 11 songs | spot-check |
| Single-track purchase "Curandera" | **Not found** by search or in the album list | spot-check. One of the ≈81-item gap. |
| Merch-only items | Unknown, probably absent (Subsonic only serves music) | inference |
| Genres | 90% of albums. Raw tags such as `jazz`, `world`, `#bruk #brokenbeat #coop`; need the alias mapping from BUILD-PLAN | `getGenres`, field coverage |

## 7. Private playback (one song)

Local player at `127.0.0.1:4173`, track `t:1816891202` ("Edge Conditions", 265 s):
- The browser requests the local server, which adds credentials and calls `stream`. The probe got `206 Partial Content`, `audio/mpeg`, with a full file size of **8,398,244 bytes**. That's about 254 kbps over 265 s, consistent with the **full-length 256 kbps** file rather than a preview.
- Requests for any other song ID return 404. Six `stream` requests in total: the 1 KB probe slice plus Tarik's listening and seeking. Nothing was saved to disk.
- **Tarik listened (2026-10-19):** playback works and continues past 0:30. `run.log` shows the browser seeking to byte offsets 3,637,248 and 5,668,864 of 8,398,244, so the whole file is reachable. **Not checked:** Tarik didn't report on the DevTools network tab. By design the page only references `/stream/…` on `127.0.0.1`.

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Auth with dedicated credentials; method recorded | ✅ token at `/rest` | `auth.json` |
| 2 | Wrong-secret run rejected | ✅ data endpoint rejects (HTTP 500); note that `ping` accepts | `auth.json` |
| 3 | `check-secrets` PASS | ✅ (after every stage) | terminal |
| 4 | Enumeration completes or records why | ✅ `short-page`, complete | `coverage.json` |
| 5 | Counts reported in their own units | ✅ | above |
| 6 | Duplicate IDs reported | ✅ 0 | `coverage.json` |
| 7 | Field-coverage table | ✅ | `coverage.json` |
| 8 | 3 spot-checks found or reported missing | ✅ 2 found, Curandera missing | `coverage.json` |
| 9 | 5 covers are images; missing-art count | ✅ 5/5, 0 missing | `art.json` |
| 10 | Canonical URL/ID present or absent | ✅ URLs absent; `a:` IDs are Bandcamp album IDs (verified, n = 1) | `enumerate.json`, Tarik's screenshot |
| 11 | Wishlist and merch/packages | ✅ wishlist absent; packages present as albums | `coverage.json` |
| 12 | One song plays via `127.0.0.1`; full vs. preview | ✅ plays, full length (seeks to 5.6 of 8.4 MB); network tab not reported | `run.log`, Tarik |
| 13 | Unit tests pass | ✅ 18/18 (`node --test scripts/subsonic-probe.test.mts`) | terminal |
| 14 | No download, write, cookie or off-allowlist call; no secret in output | ✅ 78 logged requests (stages, diagnostics, a failed first auth attempt, listening, ID re-check), all allowlisted and read-only. Caveat: redirects weren't logged until the post-review fix, so for earlier runs "no other host" covers only the URLs the probe requested; 0 redirects logged since. | `run.log` tally |
| 15 | Album IDs stable across runs | ✅ same-day re-run ~9 min later: 1,215 vs 1,215, 0 added, 0 removed. Not a different day; combined with the embed proof that `a:` IDs are Bandcamp's own IDs, treated as closed. An optional re-run on a later day is still welcome. | `ids-diff-*.json` |

## Which branch of the decision rule

**Branch 1, "Subsonic becomes the primary source"**, which beats the expected "no IDs" outcome. Subsonic supplies albums, artists, artwork, genres and private full-length playback. Embeds and "Open on Bandcamp" come from building `EmbeddedPlayer/album=<n>` from `a:` IDs, verified on 1 album. Edge cases still need a fallback: releases that won't embed, and the wishlist (71), which needs the file-import route.

## Next checks

1. Optional, any later day: `node --env-file=.env.local scripts/subsonic-probe.mts enumerate --ids-only` re-checks ID stability (criterion 15 is already closed on same-day evidence).
2. Before relying on embeds everywhere, Tarik opens 3–5 more embed URLs in his own browser: a package (Cuban Beat & Fantasia, `album=3961164446`), a 1-song album, and an older release. Claude can list candidate URLs from `out/ids-2026-10-19.json`.
3. Optional: Curandera's artist, to investigate the ≈81-item gap.
