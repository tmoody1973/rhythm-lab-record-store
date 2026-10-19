# Bandcamp Subsonic feasibility probe — design

Date: 2026-10-19 · Status: approved by Tarik · Parent plan: `docs/BUILD-PLAN.md` ("Resolve Bandcamp access before building the full app")

## Intent

Before building any of the record-store UI, find out whether Bandcamp's official Subsonic beta (announced 2026-07-16, server `https://bandcamp.com/api/subsonic`) can be the data source for Tarik's catalog. The output is **evidence and a written coverage report**, not an app. The report decides which of three paths v1 takes (see "Decision rule").

## What is already known (and what is not)

From Bandcamp's announcement: credentials are generated in Fan Settings → Subsonic; Bandcamp works as a "Subsonic or OpenSubsonic server"; supported clients are Amperfy, Feishin, Submariner ("others may work"); users can stream/download their collection and create/edit playlists; it is an open beta and "might be a little slow" for large collections.

**Not published:** endpoint list, auth method, rate limits, whether wishlist/merch/packages/single tracks appear, artwork behaviour, any Bandcamp URL or ID mapping. The probe must discover these, never assume them.

Public baseline (2026-10-19, `bandcamp.com/rhythmlab`): 1,296 collection items, 71 wishlist items. Collection items mix albums, tracks, and packages; Subsonic album/song counts are a different unit and must be reported as such. Tarik states he has **no hidden purchases** — record this as his statement, not an API-verified fact.

## Goals

The probe answers, with evidence:

1. **Auth** — which auth method works with the dedicated credentials.
2. **Enumeration** — can the whole library be listed, by which endpoint, how many pages, how long.
3. **Identity** — what ID fields exist; are they stable across pages; how tracks/albums/packages are represented.
4. **Artwork** — can covers be fetched; how many albums lack a cover reference.
5. **Canonical links** — does any field carry a Bandcamp URL or Bandcamp item ID.
6. **Coverage gaps** — wishlist, merch/packages, single-track purchases, genres, dates.
7. **Playback** — can one chosen song play in a browser through a local server that keeps credentials server-side.

## Non-goals / anti-goals (any of these = failure even if the probe "works")

- No bulk downloads; never call `download`. `stream` is called for exactly one user-chosen song.
- No writes of any kind: no playlist create/update/delete, no `star`/`unstar`, no `scrobble`, no settings changes.
- No main Bandcamp password, no browser cookies, no scraping, no undocumented fan endpoints, no requests to any host/path other than `https://bandcamp.com/api/subsonic/*` (plus `127.0.0.1` for the local player).
- No credential ever written to a log, terminal output, saved file, URL shown to the browser, or git.
- No deployment. No frontend scaffolding. No Vite/React.

## Constraints (decided)

- **Runtime:** Node v26 (installed: v26.8.1) runs `.ts` directly via type stripping. Load secrets with `node --env-file=.env.local`. Use built-in `fetch`, `node:crypto`, `node:http`, `node:test`. **Zero npm dependencies, no `package.json`.** (Claude's call; Tarik approved the plan containing it.)
- **Secrets:** `.env.local` (Tarik creates it; gitignored). `.env.example` holds placeholders only: `SUBSONIC_URL=https://bandcamp.com/api/subsonic`, `SUBSONIC_USER=`, `SUBSONIC_PASSWORD=`, `SUBSONIC_API_KEY=`. Use whichever Fan Settings actually issues (username+password or API key — unknown until Tarik generates them).
- **Endpoint allowlist** (the client throws on anything else): `ping`, `getOpenSubsonicExtensions`, `getMusicFolders`, `getArtists`, `getArtist`, `getAlbumList2`, `getAlbum`, `search3`, `getStarred2`, `getPlaylists`, `getGenres`, `getCoverArt`, `stream`. **Read-only fallbacks** (used only after a primary endpoint fails, and the failure is recorded): `getIndexes`, `getMusicDirectory`, `getAlbumList`, `getSong`. *(Claude's call: Tarik said not to assume standard endpoints work, and these are read-only, so reaching the data another read-only way is in scope. Writes and `download` stay forbidden with no exceptions.)*
- **Redaction:** every URL passes through one `redact()` function that removes `u`, `p`, `t`, `s`, `apiKey` query params before it is logged or saved. Saved responses come from the JSON body, never from request URLs. All terminal output goes through one `log()` that redacts and also appends to `out/run.log`, so the transcript is in `out/` too.
- **Leak check without anyone handling the secret:** a `check-secrets` subcommand reads the secret from the environment, scans every file in `out/` (including `run.log`) and prints only `PASS` or `FAIL: <file names>`. It never prints the secret or matching lines. Nobody (human or agent) opens `.env.local` to run it. *(Claude's call.)*
- **Politeness:** requests strictly sequential, ~250 ms gap. On HTTP 429 back off (honour `Retry-After` if present) and retry up to 3 times; abort the stage after 3 consecutive 5xx. Record elapsed time per request. Hard request cap per run: 400.
- **Total expected load:** ~40–50 requests; ≤300 more only if the per-artist fallback is needed.

## Files

| Path | Purpose |
|---|---|
| `.gitignore` | `.env.local`, `out/` |
| `.env.example` | placeholders above |
| `scripts/subsonic-probe.mts` | single script, subcommands below (~200 lines target) |
| `scripts/subsonic-probe.test.mts` | `node:test`: `redact()` strips all five params; client throws for `download`, `createPlaylist`, `updatePlaylist`, `star`, `scrobble` |
| `out/` (ignored) | redacted raw JSON per stage, `coverage.json`, `catalog-sample.json` |
| `docs/IMPORT-COVERAGE.md` | human-readable findings report, written after the runs |

Run as: `node --env-file=.env.local scripts/subsonic-probe.mts <subcommand>`. Tests: `node --test scripts/subsonic-probe.test.mts`.

## Stages (subcommands)

Common request params: `v=1.16.1`, `c=rl-record-store-probe`, `f=json`. A Subsonic error is `subsonic-response.status == "failed"` with `error.code`; record code + message.

### `auth`
1. `getOpenSubsonicExtensions` (spec allows unauthenticated) → record extension list, `openSubsonic`, `type`, `serverVersion`.
2. `ping` with token auth: `t = md5(password + salt)`, `s = salt` (random per request).
3. If that fails with code 41 (token auth unsupported) or 42, and `apiKeyAuthentication` is listed, retry with `apiKey`. Only if both fail, try `p=enc:<hex>` and record that plain-password auth was required (a finding, flagged as worse).
4. Negative test: one `ping` with a deliberately wrong secret → expect code 40 (or 44 for a bad key). Record actual code.

### `enumerate`
1. `getMusicFolders`, `getArtists` (record artist count), `getGenres`.
2. **Primary:** `getAlbumList2?type=alphabeticalByName&size=500&offset=N` until an empty or short page. Record page count, items per page, duplicate album IDs across pages.
3. **Cross-check:** `search3?query=""&albumCount=500&albumOffset=N&artistCount=0&songCount=0` paged the same way. Report set difference vs. step 2 (IDs in one and not the other).
4. **Fallback** only if step 2 errors: `getArtist` per artist from `getArtists`; if `getArtists` also fails, `getIndexes` → `getMusicDirectory`. Either way capped at 300 requests; if the cap is hit, stop and report partial.
5. `getAlbum` for a sample of 25 albums (deterministic: every Nth album from the sorted list) → song fields, track counts.
6. `getStarred2` (read) → count albums/songs/artists; compare to the 71 wishlist baseline. `getPlaylists` (read) → names + counts only.
7. Spot-checks via `search3` by name: **Curandera** (expected: purchased single track), **Edge Conditions** (album), **Cuban Beat & Fantasia** (package). Record found/not found and the full returned object shape.
8. Save the full sorted list of album IDs, each with artist, title and song count, to `out/ids-<date>.json`. These are the matching keys a later link-mapping step would use. A second, ID-only pass (`enumerate --ids-only`, about 3–6 requests) runs **on a different day** and is compared with the first. That shows whether IDs stay the same between sessions, which curation depends on. *(Claude's call: cheap, and without it the "primary source" path could break silently.)*
9. Write `out/coverage.json`: counts by unit (artists, albums, songs-in-sample), and a **field-coverage table** — for album and song objects, the % of items with each field present. Include every field observed, and specifically: `id`, `parent`, `albumId`, `artistId`, `coverArt`, `year`, `genre`/`genres`, `created`, `played`, `starred`, `musicBrainzId`, `isDir`, `type`, `mediaType`, `path`, `duration`. Flag any field whose value contains `http`, `bandcamp`, or looks like a Bandcamp numeric item ID.

### `art`
`getCoverArt?id=<coverArt>&size=600` for 5 albums (first 5 of the sorted list that have `coverArt`). Record HTTP status, `Content-Type`, byte length, time. Save nothing but the metadata (no image files kept). Report the count of albums missing `coverArt`. Note in the report that cover URLs need credentials, so a public catalog cannot reference them directly.

### `play <songId>`
Start `node:http` on `127.0.0.1:4173` only (not `0.0.0.0`). Routes:
- `GET /` → minimal HTML page with `<audio controls src="/stream/<songId>">` (no autoplay).
- `GET /stream/<songId>` → only the ID given on the command line is accepted (404 otherwise). Server calls `stream?id=<songId>` with auth added server-side, forwards the browser's `Range` header, and pipes status, `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges` back. No body is written to disk.

Tarik picks the song ID from `out/` (suggest the Edge Conditions first track). Pass: audio audibly plays; the browser's network tab shows only `127.0.0.1` requests; terminal log is redacted. Also compare streamed length/duration to the song's `duration` to tell **full track vs. preview**. Ctrl-C ends the server.

## Sanitized sample

`out/catalog-sample.json`: ≤20 items, mapped to the `CatalogItem` shape in `docs/BUILD-PLAN.md` with `source: 'bandcamp-subsonic'`, `id: 'bandcamp-subsonic:<album|track>:<subsonicId>'`, `membership: 'collection'` only where the source shows it. `artworkRef` holds the Subsonic `coverArt` ID, **not** a URL. Never include stream/cover URLs or any credential. Subsonic IDs are never assumed equal to Bandcamp `item_id`s.

## Acceptance criteria (binary)

1. `ping` succeeds with dedicated credentials; auth method recorded.
2. Wrong-secret run returns the expected error code, recorded.
3. `check-secrets` prints `PASS` (scans all of `out/`, including `run.log`).
4. Enumeration completes, or stops with a recorded reason.
5. Artist/album/song counts reported, labelled as units distinct from the 1,296 collection items.
6. Duplicate IDs across pages reported (0 = good).
7. Field-coverage table exists in `out/coverage.json` and the report.
8. Each of the 3 spot-check items found with its shape recorded, or reported missing.
9. 5 cover fetches return `image/*`; missing-art count reported.
10. Canonical Bandcamp URL/ID: present or absent, with an example either way.
11. Wishlist and merch/packages: present or absent, with evidence (`getStarred2` count vs. 71; Cuban Beat & Fantasia result).
12. One song plays in the browser via `127.0.0.1`; full-vs-preview recorded.
13. `node --test scripts/subsonic-probe.test.mts` passes (redaction + write-endpoint refusal).
14. Never observed: a `download` call, any write call, cookie use, a non-allowlisted host/path, or a secret in output.
15. Album-ID sets from two runs on different days are compared; the difference is reported (none is the good result).

## Decision rule (from BUILD-PLAN, plus one branch)

- Metadata + artwork + playback work → Subsonic adapter becomes the primary source.
- Metadata works, playback awkward → sanitized catalog export + link-out/embed playback for v1.
- Enumeration unsuitable → file-import fallback.
- **Metadata works, but there's no Bandcamp URL or item ID** (the likeliest result). Subsonic still supplies the catalog. Bandcamp links and embeds become a separate mapping step: Tarik's own file, or manual entry, matched on the artist/title/type keys saved in step 8. Matches are never guessed silently. The report must say how many items lack links. Tarik decides whether v1 ships with link-out only where a mapping exists. *(Claude's call to add this branch. Choosing the mapping method stays with Tarik, after the evidence is in.)*

## Fallback: Tarik's own JSON/CSV/local music metadata

Not built now. If needed: Tarik supplies a representative file; CSV parsed with Papa Parse, all imports validated with Zod into the same `CatalogItem` shape; local audio tags via `music-metadata` only if that route is chosen. Same rules as BUILD-PLAN "Parse CSV and HTML into one normalized catalog". The probe's sample uses `CatalogItem` so both paths meet one schema.

## Who runs what (Tarik's decision)

- **Tarik:** generates the dedicated Subsonic credentials in Fan Settings and writes `.env.local` himself. Does the `play` step (listens; checks the browser network tab shows only `127.0.0.1`).
- **Claude:** runs `auth`, `enumerate`, `art`, and `check-secrets` via `node --env-file=.env.local …`. Claude never opens, prints, or `cat`s `.env.local`. Its only view of results is redacted output.
- The second-day ID pass can be run by either of them.

## Left to the builder

Internal code structure within the one script, output formatting, exact report wording, which 25 albums are sampled (as long as deterministic), how the `out/` JSON is laid out beyond the fields named above.

## Open items outside this probe

- Project is not a git repository yet; "committed" is pending until Tarik chooses to `git init`.
- Whether the finished store is private or shareable (affects artwork use) stays open per BUILD-PLAN.
