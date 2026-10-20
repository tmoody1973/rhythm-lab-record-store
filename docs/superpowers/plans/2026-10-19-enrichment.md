# Enrichment Implementation Plan (milestone 2, plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run enrich` adds record label, catalog number, release date, artist country/area, styles and Bandcamp page links to the catalog from Apple Music, MusicBrainz and Discogs, publishing a value only when the match is trustworthy, and the site shows them (label line, "Open on Bandcamp", a Country filter).

**Architecture:** A local Node step (like `npm run catalog`) under `pipeline/enrich/`. Each source adapter turns one catalog record into normalized candidates; a pure matcher scores them; a pure gate decides what is published. All HTTP goes through one throttled, disk-cached fetcher per source, so reruns cost nothing and rate limits are never exceeded. Output: `public/enrichment.json` (published values only), `data/enrichment-review.md` (uncertain matches for Tarik), and for the pilot `docs/ENRICHMENT-COVERAGE.md`. Tarik's `content/overrides.json` always wins.

**Tech Stack:** Node v26 built-ins only (`fetch`, `node:crypto` for the Apple ES256 token), Zod, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-record-store-v1-design.md` ("2. Enrichment"). Decision record: `docs/decisions/004-enrichment-confidence-gate.md`.

## Global Constraints

- **Credentials** from `.env.local` only, loaded with `node --env-file=.env.local`: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` (the `.p8`, outside the repo), `DISCOGS_KEY`, `DISCOGS_SECRET`, `MUSICBRAINZ_CONTACT`. Never print, log, cache or commit them; cache keys and saved responses exclude auth headers. Extend `check-secrets` (or a new `npm run check-secrets`) to scan `data/.cache/enrich/`, `public/enrichment.json` and `docs/ENRICHMENT-COVERAGE.md` for each value.
- **Verified service rules (2026-10-19):**
  - MusicBrainz: average **≤ 1 request/second per IP**, exceeding it declines *all* requests; identifying User-Agent `RhythmLabRecordStore/0.1 ( <MUSICBRAINZ_CONTACT> )`; `https://musicbrainz.org/ws/2/…&fmt=json`. Use a 1,100 ms minimum interval, including retries.
  - Discogs: `Authorization: Discogs key=…, secret=…`; `/database/search` accepts it at the authenticated tier (about 60 requests/minute); use a 1,100 ms minimum interval; honour `X-Discogs-Ratelimit-Remaining` and 429.
  - Apple Music: developer token = JWT, header `{ alg: 'ES256', kid: APPLE_KEY_ID }`, claims `{ iss: APPLE_TEAM_ID, iat, exp }` (exp 1 hour ahead), signed with the `.p8`; `Authorization: Bearer <token>`; `GET https://api.music.apple.com/v1/test` checks auth; search `GET /v1/catalog/us/search?types=albums,songs&term=…`. Use a 250 ms minimum interval; honour 429.
- **Requests carry only artist and title text** (plus the User-Agent contact Tarik approved). No other personal data leaves the machine.
- **Matching rules (from the spec):** normalized artist + title, plus track count equal to `songCount` = `high`. Publish a field when its match is `high`, or when two sources agree on the value. For 1-song records (`kind: 'track'` or `songCount === 1`), publish only when two sources agree after an exact normalized artist + title match. `medium` goes to the review list; `low` is discarded. Disagreeing sources publish nothing for that field.
- **Overrides:** `content/overrides.json` (`{ [recordId]: Partial<Enriched> | { field: null } }`) always wins, is never written by the pipeline, and `null` suppresses a field.
- **Pilot before full run:** the full 1,215-record run happens only after Tarik reads the pilot report (Task 6). The pipeline never publishes from a run that was not complete for the records it covers.
- **Display:** the site footer credits the sources whose data is shown ("Metadata: Apple Music, MusicBrainz, Discogs"). Work on branch `feat/enrichment`; merge via PR with green CI.

## Review Focus

1. A rate-limit reply (MusicBrainz 503, Discogs 429, Apple 429), with or without `Retry-After` → the fetcher waits and retries, never exceeding the per-source interval even during retries, and gives up on that record after 3 tries with it counted in the summary. (Task 2 test)
2. Bad or expired credentials (Apple 401/403, Discogs 401) → that source is switched off for the run with one clear message; the other sources continue; nothing is published from it. (Task 4 test)
3. Two sources disagree on a value (different labels) → nothing is published for that field and it appears in the review list. (Task 1 test)
4. Same artist and title but a different edition (deluxe/remaster with more tracks), and "feat." / "(Remastered)" / "– EP" noise in titles → noise is normalized away, but a track-count mismatch is never `high`; 1-song records need two-source agreement. (Task 1 test)
5. An interrupted run → the cache is reused on rerun, `public/enrichment.json` is written atomically (old or new, never partial), `content/overrides.json` is untouched. (Task 4 test)

---

### Task 1: Normalization, matching and the publish gate (pure)

**Files:** Create `src/catalog/enrichment.ts` (shared schema), `pipeline/enrich/match.ts`, `tests/pipeline/match.test.ts`.

**Interfaces:**
- Produces:
  - `src/catalog/enrichment.ts`: Zod `EnrichedSchema` (`label?`, `catalogNumber?`, `releaseDate?` (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`), `artistCountry?` (ISO 3166-1 alpha-2), `artistArea?`, `styles?: string[]`, `bandcampUrl?` (must be `https://*.bandcamp.com/...`), `sources: ('apple'|'musicbrainz'|'discogs'|'override')[]`), `EnrichmentFileSchema` (`{ schemaVersion: 1; generatedAt: string; entries: Record<recordId, Enriched> }`), `OverridesFileSchema`, types.
  - `match.ts`: `normalize(s: string): string`; `type Candidate = { source; artist: string; title: string; trackCount: number | null; fields: Partial<Omit<Enriched, 'sources'>> }`; `confidence(record: PublicAlbum, c: Candidate): 'high' | 'medium' | 'low'`; `gate(record: PublicAlbum, best: Candidate[], overrides?: Partial<Enriched> | Record<string, null>): { published: Enriched | null; review: { field: string; values: { source: string; value: unknown }[] }[] }`.
- [ ] **Step 1: Failing tests:**
  - `normalize`: `'Björk'` → `'bjork'`; `'Universal Beings (Remastered)'` → `'universal beings'`; `'Song (feat. X)'` and `'Song feat. X'` → `'song'`; `'Days As Echoes – EP'` and `'... - EP'` → `'days as echoes'`; `'Simon & Garfunkel'` equals `normalize('Simon and Garfunkel')`; whitespace and punctuation collapse.
  - `confidence`: exact normalized artist+title and `trackCount === songCount` → `high`; same but track count differs (deluxe edition) → `medium`; artist matches, title doesn't → `low`; a 1-song record with an exact match → `medium` (never `high` alone).
  - `gate`: one `high` candidate publishes its fields with `sources: ['discogs']`; two `medium` candidates agreeing on `label` publish `label` only; two candidates disagreeing on `label` publish no `label` and return a review entry listing both values; a 1-song record with one exact candidate publishes nothing but appears in review; overrides replace a field, and `{ label: null }` suppresses it even when sources agree; `bandcampUrl` that isn't a `bandcamp.com` URL is dropped.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: add enrichment matching and publish gate`.

### Task 2: Throttled, cached fetcher

**Files:** Create `pipeline/enrich/http.ts`, `tests/pipeline/http.test.ts`.

**Interfaces:**
- Produces: `createSourceFetcher(opts: { name: string; minIntervalMs: number; cacheDir: string; headers: () => Record<string, string>; fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> }): { getJson(url: string): Promise<{ status: number; body: unknown; cached: boolean }>; stats(): { requests: number; cacheHits: number; retries: number; failures: number } }`. Cache file = `<cacheDir>/<sha256(url)>.json` storing `{ url, status, body, fetchedAt }` (no headers). Only 200 and 404 are cached. 429/503 → wait `Retry-After` seconds (default 5 s, doubling), max 3 retries. 401/403 → throws `AuthError`. Writes atomically.
- [ ] **Step 1: Failing tests** (fake fetch, fake clock/sleep, temp dir): two calls to different URLs are spaced ≥ `minIntervalMs` apart (recorded via fake `now`); a 429 with `Retry-After: 2` sleeps 2000 ms then succeeds, and the retry also respects the interval; three 503s → `failures: 1` and a `{ status: 503 }` result, not a throw; a second `getJson` of a cached URL makes no network call and returns `cached: true`; 401 → rejects with `AuthError`; the cache file contains no `Authorization` value (Review Focus 1).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: add throttled cached fetcher for enrichment sources`.

### Task 3: Record one real response per source, then build the adapters

**Files:** Create `pipeline/enrich/apple.ts`, `pipeline/enrich/musicbrainz.ts`, `pipeline/enrich/discogs.ts`, `pipeline/enrich/record-fixtures.ts`, `tests/fixtures/enrich/{apple,musicbrainz-search,musicbrainz-release,musicbrainz-artist,discogs-search,discogs-release}.json`, `tests/pipeline/sources.test.ts`.

**Interfaces:**
- Consumes: `createSourceFetcher` (Task 2), `Candidate` (Task 1).
- Produces:
  - `apple.ts`: `appleToken(teamId: string, keyId: string, pem: string, nowSec: number): string` (ES256 via `node:crypto` `sign('sha256', …, { key, dsaEncoding: 'ieee-p1363' })`); `appleSource(fetcher): { check(): Promise<void>; candidates(r: PublicAlbum): Promise<Candidate[]> }` — search `albums` for album records and `songs` for track records; map `recordLabel` → `label`, `releaseDate`, `trackCount`.
  - `musicbrainz.ts`: `musicbrainzSource(fetcher)` — `release` search with `query=release:"<title>" AND artist:"<artist>"`, take up to 3 results, then for the best one look up `release/<id>?inc=labels+url-rels+artist-credits` (label, catalog number, date, Bandcamp URL from url relations) and `artist/<id>` (country, area name).
  - `discogs.ts`: `discogsSource(fetcher)` — `database/search?type=release&artist=…&release_title=…&per_page=5`, then `releases/<id>` for the best result (tracklist length, labels[0].name, labels[0].catno, country, styles).
  - `record-fixtures.ts`: a one-off script (`node --env-file=.env.local pipeline/enrich/record-fixtures.ts`) that fetches each endpoint once for "Edge Conditions" by Jeremiah Chiu and writes the bodies to `tests/fixtures/enrich/` **after stripping anything that isn't the response body**.
- [ ] **Step 1: Live recording** (Claude runs it; ~8 requests): run `record-fixtures.ts`; confirm with `grep` that none of the credential values appear in `tests/fixtures/enrich/`. Note the real field names in each body (they decide the parsers; adjust Interfaces names if they differ, and ledger a ruling).
- [ ] **Step 2: Failing tests** (`sources.test.ts`, fetcher faked to serve the fixtures): `appleToken` produces three base64url parts whose header decodes to `{ alg: 'ES256', kid }`, and whose signature verifies with the matching public key (generate a P-256 test key with `generateKeyPairSync('ec', { namedCurve: 'P-256' })`); each adapter turns its fixture into a `Candidate` for Edge Conditions with artist "Jeremiah Chiu", title "Edge Conditions", the right track count, and the label as the fixture shows it; MusicBrainz yields a `bandcampUrl` if the fixture has a Bandcamp relation and an `artistCountry` from the artist fixture.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. **Step 5:** Run → PASS. **Step 6:** Commit `feat: add Apple Music, MusicBrainz and Discogs adapters`.

### Task 4: `npm run enrich` — pilot and full runs

**Files:** Create `pipeline/enrich/index.ts`, `pipeline/enrich/sample.ts`, `tests/pipeline/enrich-run.test.ts`, `content/overrides.json` (`{}`). Modify `package.json` (`"enrich": "node --env-file=.env.local pipeline/enrich/index.ts"`), `.gitignore` (`public/enrichment.json`, `data/enrichment-review.md` — review list is personal working data).

**Interfaces:**
- Produces: `pilotSample(albums: PublicAlbum[], n = 50): PublicAlbum[]` (deterministic: 25 one-song and 25 multi-song records, every k-th by id); `runEnrichment(records, sources, overrides): Promise<{ file: EnrichmentFile; review: ReviewEntry[]; stats }>` (sources run per record; a source that throws `AuthError` is disabled for the rest of the run with one message); CLI flags `--pilot` and `--only <source>`.
- [ ] **Step 1: Failing tests** (`enrich-run.test.ts`, fake sources): `pilotSample` is stable across calls and has 25/25; a source throwing `AuthError` on its first call is disabled, the others' results still publish, and the summary names it (Review Focus 2); results are written with `writeJsonAtomic` (plan 1) and an existing `content/overrides.json` is byte-identical afterwards (Review Focus 5); disagreeing sources yield a review entry (Review Focus 3).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: read `public/catalog.json`; pick records (pilot sample or all); for each, gather candidates from enabled sources concurrently (each source is internally throttled), pick each source's best candidate by `confidence`, `gate`; write `public/enrichment.json` (atomic), `data/enrichment-review.md` (grouped by record, with each source's values and links to look them up), and print a summary: records, published per field, review count, per-source requests/cache hits/failures, elapsed. **Step 4:** Run → PASS. **Step 5:** Commit `feat: add npm run enrich`.

### Task 5: Show enrichment on the site

**Files:** Modify `src/catalog/load.ts` (also load `/enrichment.json`; missing or invalid → empty, never an error), `src/ui/AlbumDialog.tsx` (label line under the title, e.g. "International Anthem · 2026" with catalog number when present; "Open on Bandcamp" button when `bandcampUrl`), `src/catalog/query.ts` + `src/state/url.ts` (`country` filter param), `src/ui/Collection.tsx` (Country select shown only when ≥ 20% of records have `artistCountry` (Tarik lowered it from 30% after the pilot), using `Intl.DisplayNames(['en'], { type: 'region' })` for names), `src/App.tsx` (footer credit). Create `tests/web/enrichment-ui.test.tsx`.
- [ ] **Step 1: Failing tests:** with a fake `/enrichment.json` giving Universal Beings `{ label: 'International Anthem', bandcampUrl: 'https://intlanthem.bandcamp.com/album/universal-beings', sources: ['musicbrainz'] }`, the pop-up shows "International Anthem" and an "Open on Bandcamp" link with that `href`, `target="_blank"` and `rel="noopener noreferrer"`; a non-Bandcamp `bandcampUrl` in the file is rejected by the schema and no button appears; with no enrichment file the site works and shows neither; with `artistCountry: 'GB'` on ≥ 30% of records a Country select appears listing "United Kingdom", and choosing it filters and sets `?country=GB`; below 30% it is hidden *(20%, Tarik's choice after the pilot)*; the footer credits only the sources present in the file.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; `npm run e2e` still passes. **Step 5:** Commit `feat: show labels, Bandcamp links and a country filter from enrichment`.

### Task 6: Pilot run and report (then stop for Tarik)

**Files:** Create `docs/ENRICHMENT-COVERAGE.md`.
- [ ] **Step 1:** Run `npm run enrich -- --pilot` (Claude runs it; about 50 Apple + ~150 MusicBrainz + ~100 Discogs requests, roughly 3–4 minutes). Then the secret scan → `PASS`.
- [ ] **Step 2:** Write `docs/ENRICHMENT-COVERAGE.md`: match rates per source, split into 1-song and multi-song records; fields published per source; how many values two sources agreed on; review-list size; requests and time; the projected full-run time; and a **hand-check table of 15 published values** (record, field, value, source, a link to check it) for Tarik to mark right or wrong.
- [ ] **Step 3:** Commit `docs: add enrichment pilot report`, push the branch, open the PR (CI green), and **stop**: Tarik reads the report and the hand-check table before any full run.

### Task 7: Full run (only after Tarik approves the pilot)

- [ ] **Step 1:** `npm run enrich` on all 1,215 records (Claude runs it in the background; roughly an hour, dominated by MusicBrainz's 1 request/second). Secret scan → `PASS`.
- [ ] **Step 2:** Update `docs/ENRICHMENT-COVERAGE.md` with full-run numbers and whether the Country filter crossed the 30% threshold; screenshot the pop-up with a label and the Country filter at desktop and phone width.
- [ ] **Step 3:** Commit, push; merge the PR when CI is green and Tarik says so.
