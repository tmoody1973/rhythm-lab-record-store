# Bandcamp Subsonic Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only, zero-dependency script that tells us whether Bandcamp's Subsonic beta can supply Tarik's catalog, with a written coverage report.

**Architecture:** One script, `scripts/subsonic-probe.mts`, exports small pure helpers (redaction, allowlist, auth, paging, field coverage) and a throttled client. A `main()` guarded by `import.meta.main` dispatches subcommands `auth | enumerate [--ids-only] | art | play <songId> | check-secrets`. Live runs write redacted evidence to `out/`; findings go to `docs/IMPORT-COVERAGE.md`.

**Tech Stack:** Node v26.8.1 (native TS type stripping, `--env-file`, `fetch`, `node:crypto`, `node:http`, `node:fs`, `node:test`). No npm packages, no `package.json`.

**Spec:** `docs/superpowers/specs/2026-10-19-subsonic-feasibility-design.md`

## Global Constraints

- Run: `node --env-file=.env.local scripts/subsonic-probe.mts <subcommand>`. Test: `node --test scripts/subsonic-probe.test.mts`.
- Zero npm dependencies; no `package.json`. Imports between `.ts` files use the explicit `.ts` extension.
- Base URL from `SUBSONIC_URL` (= `https://bandcamp.com/api/subsonic`). Standard Subsonic clients call `<base>/rest/<endpoint>`; Task 2 confirms whether `/rest` is needed and stores the working `prefix` (the spec does not fix it).
- Common params: `v=1.16.1`, `c=rl-record-store-probe`, `f=json`.
- Endpoint allowlist: `ping`, `getOpenSubsonicExtensions`, `getMusicFolders`, `getArtists`, `getArtist`, `getAlbumList2`, `getAlbum`, `search3`, `getStarred2`, `getPlaylists`, `getGenres`, `getCoverArt`, `stream`. Fallback-only (after a recorded failure): `getIndexes`, `getMusicDirectory`, `getAlbumList`, `getSong`. Everything else throws.
- Redact query params `u`, `p`, `t`, `s`, `apiKey` from every URL that is logged, saved, or put in an error message.
- Sequential requests, 250 ms gap; 429 → back off (honour `Retry-After`), max 3 retries; 3 consecutive 5xx → abort the stage; hard cap 400 requests per run.
- All terminal output goes through `log()`, which redacts and appends to `out/run.log`.
- Claude never opens, prints, or `cat`s `.env.local`. Tarik does the `play` listening step.
- No `download`, no writes, no cookies, no host/path outside the Subsonic base URL and `127.0.0.1`.
- The project is **not a git repo**: skip commit steps unless Tarik runs `git init`; if he does, never stage `.env.local` or `out/`.

## Review Focus

1. Missing/empty `SUBSONIC_USER`/`SUBSONIC_PASSWORD` → clear error naming the missing variable; zero requests sent. (Task 1 test)
2. `check-secrets` with an empty or unset secret → must throw "secret not loaded", never a trivial `PASS`. (Task 1 test)
3. HTTP 200 whose body has `subsonic-response.status == "failed"` → treated as a `SubsonicError` with code, not success. (Task 1 test)
4. Network failure or non-JSON body (HTML error page, XML) → error message contains only the redacted URL, never the token/salt/password. (Task 1 test)
5. Request cap hit mid-pagination → result marked `stoppedBy: 'cap'` and reported as partial, never as complete. (Task 3 test)

---

### Task 1: Safe client core

**Files:**
- Create: `scripts/subsonic-probe.mts`, `scripts/subsonic-probe.test.mts`, `.env.example`
- Exists already: `.gitignore` (`.env.local`, `out/`), `.env.local` (Tarik's credentials — do not open)

**Interfaces:**
- Produces:
  - `redact(url: string): string`
  - `assertAllowed(endpoint: string, opts?: { fallback?: boolean }): void` — fallback-only endpoints throw unless `fallback: true`
  - `tokenAuth(user: string, password: string, salt?: string): URLSearchParams` — sets `u`, `t = md5(password + salt)` hex, `s`; random 12-hex-char salt if omitted
  - `loadConfig(env?: NodeJS.ProcessEnv): { baseUrl: string; user: string; password: string }`
  - `class SubsonicError extends Error { code: number }`
  - `createClient(cfg, opts?: { fetchImpl?: typeof fetch; gapMs?: number; cap?: number; prefix?: string }): { call(endpoint: string, params?: Record<string,string>, o?: { fallback?: boolean; auth?: 'token' | 'enc' | 'none' }): Promise<any>; raw(endpoint: string, params: Record<string,string>, init?: RequestInit): Promise<Response>; count(): number }` — `call` returns the parsed `subsonic-response` object
  - `log(...parts: unknown[]): void`
  - `scanForSecret(dir: string, secret: string): string[]` — names of files containing `secret`

- [ ] **Step 1: Write the failing tests** in `scripts/subsonic-probe.test.mts`:
  - `redact` on `https://x/rest/ping?u=tarik&t=abc&s=def&p=enc:41&apiKey=k&v=1.16.1&f=json` returns a string containing `v=1.16.1` and `f=json` and none of `tarik`, `abc`, `def`, `enc:41`, `=k`.
  - `assertAllowed` throws for each of `download`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`, `star`, `unstar`, `scrobble`; does not throw for `getAlbumList2`; throws for `getSong` without `{fallback:true}` and passes with it.
  - `tokenAuth('u','sesame','c19b2d').get('t') === createHash('md5').update('sesamec19b2d').digest('hex')`.
  - `loadConfig({SUBSONIC_URL:'https://x'})` throws with message containing `SUBSONIC_USER`. (Review Focus 1)
  - `scanForSecret(tmp, '')` throws `/secret not loaded/`; a tmp dir with one file containing `hunter2` returns `['that-file']`; a clean dir returns `[]`. (Review Focus 2)
  - Client with `fetchImpl` returning `200 {"subsonic-response":{"status":"failed","error":{"code":40,"message":"Wrong username or password"}}}` → `call('ping')` rejects with `SubsonicError` whose `code === 40`. (Review Focus 3)
  - Client with `fetchImpl` that rejects, and one returning `200 "<html>"` → rejection message does not contain the password or the `t=`/`s=` values. (Review Focus 4)
  - Client with `fetchImpl` returning 429 then 200 (`gapMs: 0`, `Retry-After: 0`) → resolves; returning 500 three times → rejects; `cap: 2` → third `call` rejects `/request cap/`.

- [ ] **Step 2: Run, expect FAIL** — `node --test scripts/subsonic-probe.test.mts` → module/exports not found.

- [ ] **Step 3: Implement** the exports above in `scripts/subsonic-probe.mts`. `log` writes to stdout and appends to `out/run.log` (create `out/` if missing), redacting any URL-like substring via `redact`. Errors are built from `redact(url)` only. Each request logs `endpoint`, HTTP status and elapsed ms (the spec wants per-request timing for the "slow beta" finding). `scanForSecret` on a missing directory returns `[]`. Add `main()` behind `if (import.meta.main)` with a subcommand switch (stubs for now). Write `.env.example` with `SUBSONIC_URL=https://bandcamp.com/api/subsonic` and empty `SUBSONIC_USER=`, `SUBSONIC_PASSWORD=`, `SUBSONIC_API_KEY=`.

- [ ] **Step 4: Run, expect PASS** — same command, all tests green.

- [ ] **Step 5: Implement `check-secrets` subcommand** — `scanForSecret('out', process.env.SUBSONIC_PASSWORD)`; prints `PASS` or `FAIL: <files>`; exit code 1 on FAIL. Run `node --env-file=.env.local scripts/subsonic-probe.mts check-secrets` → `PASS` (out/ empty or absent counts as PASS once the secret is loaded).

### Task 2: `auth` stage (Claude runs it live)

**Interfaces:**
- Consumes: `createClient`, `tokenAuth`, `SubsonicError`, `log`
- Produces: `out/auth.json` = `{ prefix: string, extensions: unknown, openSubsonic?: boolean, type?: string, serverVersion?: string, method: 'token'|'enc'|'apiKey', negative: { code: number, message: string } }`

- [ ] **Step 1: Implement `auth`** per spec "Stages → auth": `getOpenSubsonicExtensions` with `auth:'none'` (try prefix `/rest` first, then none; record which answered as `prefix`), then `ping` with token auth; on code 41/42 retry with `auth:'enc'` and log "plain-password auth required" as a flagged finding. Negative test: `ping` with password `'definitely-wrong'` → record code/message.
- [ ] **Step 2: Run** `node --env-file=.env.local scripts/subsonic-probe.mts auth`. Expected: logs the extensions list, `ping ok via token` (or the fallback), `negative: code 40`. If `ping` fails with code 40 on the real credentials, **stop** and report to Tarik — do not retry repeatedly.
- [ ] **Step 3: Run** `check-secrets` → `PASS`.

### Task 3: `enumerate` stage

**Interfaces:**
- Consumes: `createClient`, `log`
- Produces:
  - `pageAll<T>(fetchPage: (offset: number) => Promise<T[]>, size: number, idOf: (t: T) => string): Promise<{ items: T[]; pages: number; duplicates: string[]; stoppedBy: 'short-page' | 'cap' | 'error'; error?: string }>`
  - `fieldCoverage(objs: Record<string, unknown>[]): Record<string, { pct: number; flagged: boolean }>` — `flagged` when any value (stringified) contains `http` or `bandcamp`, or matches `/^\d{8,12}$/`
  - `toCatalogItem(album: Record<string, unknown>): CatalogItem` (type copied from BUILD-PLAN line ~109) with `source:'bandcamp-subsonic'`, `id:'bandcamp-subsonic:album:<id>'`, `artworkRef` = raw `coverArt` ID, `membership:'collection'`, `kind:'album'`
  - Files: `out/enumerate.json`, `out/coverage.json`, `out/ids-<YYYY-MM-DD>.json` (`[{id, artist, title, songCount}]` sorted by id), `out/catalog-sample.json` (≤20 items)

- [ ] **Step 1: Write failing tests:**
  - `pageAll` over pages `[500 items, 500 items, 296 items]` → `items.length === 1296`, `pages === 3`, `stoppedBy === 'short-page'`.
  - `pageAll` where page 2 repeats one ID from page 1 → `duplicates` equals `[thatId]`.
  - `pageAll` whose `fetchPage` rejects `/request cap/` on page 2 → `stoppedBy === 'cap'`, `items.length === 500`. (Review Focus 5)
  - `fieldCoverage([{id:'1',coverArt:'a'},{id:'2'}])` → `coverArt.pct === 50`, `id.pct === 100`; an object with `{x:'https://foo.bandcamp.com'}` → `x.flagged === true`.
  - `toCatalogItem({id:'al-9',name:'Edge Conditions',artist:'A',coverArt:'c9'})` → `id === 'bandcamp-subsonic:album:al-9'`, `artworkRef === 'c9'`, and `JSON.stringify` of the result contains no `http`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the three helpers and the `enumerate` subcommand following spec steps 1–9 (primary `getAlbumList2` type `alphabeticalByName` size 500; `search3` cross-check with set difference; fallbacks with 300-request cap; `getAlbum` on every Nth album to sample 25; `getStarred2`; `getPlaylists` names+counts only; three `search3` spot-checks: "Curandera", "Edge Conditions", "Cuban Beat & Fantasia"). `--ids-only` runs only the primary paging and writes `out/ids-<date>.json`; if a previous `ids-*.json` exists, log added/removed counts against the newest one.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Run live** `node --env-file=.env.local scripts/subsonic-probe.mts enumerate`. Expected: page count, album/artist counts, duplicates count, spot-check results, `stoppedBy`. Then `check-secrets` → `PASS`.

### Task 4: `art` stage

**Interfaces:** Consumes `createClient.raw`, `out/enumerate.json`. Produces `out/art.json` = `{ samples: [{ coverArt, status, contentType, bytes, ms }], missingCoverArt: number }`.

- [ ] **Step 1: Implement `art`** per spec: first 5 albums with `coverArt`, `getCoverArt` `size=600`; read the body only to count bytes; save no images.
- [ ] **Step 2: Run live**; expected 5 rows with `contentType` starting `image/`. Then `check-secrets` → `PASS`.

### Task 5: `play` stage (Tarik listens)

**Interfaces:** Consumes `createClient.raw`. Produces `startPlayer(client, songId: string, port?: number): Promise<import('node:http').Server>` bound to `127.0.0.1`.

- [ ] **Step 1: Write failing test:** `startPlayer` with a fake client whose `raw` returns a 200 `audio/mpeg` body `'abc'`, port `0` → `server.address().address === '127.0.0.1'`; `GET /stream/<songId>` → 200 `audio/mpeg`; `GET /stream/other` → 404; `GET /` body contains `<audio controls src="/stream/<songId>">` and no `autoplay`; the fake client receives the browser's `Range` header.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement** per spec "play": forward `Range`; pipe back `status`, `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`; nothing written to disk; log the song's `duration` (via `getSong` fallback or the `getAlbum` data in `out/`) next to the streamed `Content-Length`. **Step 4: Run, expect PASS.**
- [ ] **Step 5: Hand off to Tarik:** Claude picks the first track of Edge Conditions from `out/enumerate.json` (or another sampled album if missing) and gives Tarik the exact command `node --env-file=.env.local scripts/subsonic-probe.mts play <songId>` and URL `http://127.0.0.1:4173/`. Tarik confirms: audio plays; network tab shows only `127.0.0.1`; whether it plays to the end (full vs. ~30 s preview). Ctrl-C. Then `check-secrets` → `PASS`.

### Task 6: Coverage report

**Files:** Create `docs/IMPORT-COVERAGE.md`.

- [ ] **Step 1: Write the report** from `out/*.json` and Tarik's play result, one section per spec goal (auth, enumeration, identity, artwork, canonical links, coverage gaps, playback), plus: the 15 acceptance criteria as a ✅/❌/⏳ checklist with the evidence file for each; "Hidden purchases: none, per Tarik (not verified by the API)"; counts labelled by unit vs. the 1,296 collection items / 71 wishlist baseline; and which decision-rule branch the evidence points to, with the link-gap count if that branch applies. Include no credentials, stream URLs, or cover URLs.
- [ ] **Step 2: Second-day ID pass** (⏳ until then): on or after 2026-10-20 run `enumerate --ids-only`, then fill criterion 15 with the added/removed counts.
- [ ] **Step 3:** `check-secrets` → `PASS`; mark criterion 3 ✅.
