# Catalog Pipeline Implementation Plan (milestone 2, plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run catalog` turns Tarik's Subsonic library into a credential-free `public/catalog.json` plus self-hosted WebP covers with extracted colours.

**Architecture:** A Node pipeline under `pipeline/` reuses the tested Subsonic client exported by `scripts/subsonic-probe.mts`. Pure functions (mapping, palette, diff) are unit-tested; I/O (Subsonic, Bandcamp image fallback, disk) is injected so tests never touch the network. The shared Zod schema lives in `src/catalog/schema.ts` so plan 2's site validates the same shape.

**Tech Stack:** Node v26 (native TS), TypeScript, Zod, sharp, node-vibrant, Vitest. No tsx (Node runs `.ts` directly once `package.json` has `"type": "module"`).

**Spec:** `docs/superpowers/specs/2026-10-19-record-store-v1-design.md` (sections "Constraints", "1. Catalog export", "Reference implementation").

## Global Constraints

- Secrets only via `node --env-file=.env.local`; never print, log or write `SUBSONIC_*` values. Reuse `createClient`, `loadConfig`, `log`, `redact` from `scripts/subsonic-probe.mts`; do not write a second Subsonic client.
- Subsonic: `prefix: '/rest'`, `auth: 'token'` (proven in `out/auth.json`), requests sequential with the client's 250 ms gap. Endpoints used: `getAlbumList2`, `getCoverArt` only.
- Cover requests: about 1,215 on the first run, approved by Tarik; cached so later runs fetch only new albums. Client cap for this command: 1,500.
- Cover fallback host: `https://f4.bcbits.com/img/a<coverId>_10.jpg` only (verified). No other third-party host.
- Generated output is git-ignored: `public/catalog.json`, `public/covers/`, `data/.cache/`. Curation files (`content/*.json`) are never written by this pipeline.
- `public/catalog.json` must contain no `subsonic`, `/rest/`, `u=`, `t=`, `s=`, `p=` strings and no absolute filesystem paths.
- Palette code is ported from `chrija76/bookshelf` `pipeline/palette.ts` (MIT); keep a header comment with its copyright line.
- Every step prints a summary; nothing fails silently (fallbacks are counted and printed).

## Review Focus

1. Subsonic `getCoverArt` returns HTTP 500/404 or a non-image body → the Bandcamp fallback is tried; if that fails too, the album gets `cover: null` and is counted in the summary, never a crash. (Task 3 test)
2. An album whose `id` isn't `a:<digits>` or whose `coverArt` isn't `ca:<digits>` → skipped or `cover: null` with a warning, never a crash or a `NaN` id. (Task 1 test)
3. Enumeration ends `stoppedBy: 'cap' | 'error'` → the command refuses to write `catalog.json`, leaving the previous one intact. (Task 4 test)
4. Interrupted run (Ctrl-C, crash mid-write) → `catalog.json` is either the old file or the new file, never half-written; cached covers are reused on rerun. (Task 4 test: atomic write)
5. Palette extraction throws on a corrupt image → logged fallback palette, counted in the summary, never a silent random colour. (Task 2 test)

---

### Task 1: Project setup, shared schema, Subsonic → catalog mapping

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/catalog/schema.ts`, `pipeline/map.ts`, `tests/pipeline/map.test.ts`
- Modify: `.gitignore` (add `node_modules/`, `public/catalog.json`, `public/covers/`, `data/.cache/`, `dist/`)

**Interfaces:**
- Produces:
  - `src/catalog/schema.ts`: Zod `CoverSchema` (`{ grid: string; large: string; dominant: string; accent: string; text: string }`, colours `#rrggbb`), `PublicAlbumSchema`, `CatalogSchema` and their inferred types `Cover`, `PublicAlbum`, `Catalog`, matching the spec's types with `cover: Cover | null` and `schemaVersion: 1`.
  - `pipeline/map.ts`: `parseTaggedId(value: unknown, tag: 'a' | 'b' | 'ca'): number | null`, `toPublicAlbum(raw: Record<string, unknown>, cover: Cover | null): PublicAlbum | null` (returns `null` when `id` or `name` is unusable), `buildCatalog(albums: PublicAlbum[], generatedAt: string): Catalog` (sorted by `id`, `count` = length).

- [ ] **Step 1: Set up the package.** `package.json`: `"type": "module"`, `"private": true`, scripts `test` = `vitest run`, `typecheck` = `tsc --noEmit`, `catalog` = `node --env-file=.env.local pipeline/catalog.ts`. Install: `npm i -D typescript @types/node vitest` and `npm i zod sharp node-vibrant` (record exact resolved versions in the commit message). `tsconfig.json`: `strict`, `module`/`moduleResolution` `nodenext`, `allowImportingTsExtensions`, `noEmit`, include `pipeline`, `src`, `tests`, `scripts`. `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, so the probe's `node:test` suite isn't picked up; add script `test:probe` = `node --test scripts/subsonic-probe.test.mts` and confirm it still prints 22/22.
- [ ] **Step 2: Write failing tests** in `tests/pipeline/map.test.ts`:
  - `parseTaggedId('a:3274104668', 'a') === 3274104668`; `parseTaggedId('ca:12', 'a') === null`; `parseTaggedId('a:12x', 'a') === null`; `parseTaggedId(undefined, 'b') === null`.
  - `toPublicAlbum({ id: 'a:3274104668', name: 'Edge Conditions', artist: 'Jeremiah Chiu', artistId: 'b:2239178', genre: 'jazz', songCount: 11, duration: 2541, coverArt: 'ca:3951378974' }, null)` deep-equals `{ id: 'bandcamp:album:3274104668', albumId: 3274104668, title: 'Edge Conditions', artist: 'Jeremiah Chiu', artistKey: 'b:2239178', genre: 'jazz', cover: null, songCount: 11, durationSec: 2541 }`.
  - Missing `genre` → `genre: null`; empty-string genre → `null`.
  - `toPublicAlbum({ id: 'x:1', name: 'A' }, null) === null` and `toPublicAlbum({ id: 'a:1' }, null) === null` (Review Focus 2).
  - `buildCatalog` of two albums given out of order returns them sorted by `id`, `count: 2`, and `CatalogSchema.parse` accepts it.
  - `JSON.stringify(buildCatalog(...))` matches none of `/subsonic|\/rest\/|[?&][utsp]=/`.
- [ ] **Step 3: Run** `npm test -- map` → FAIL (module not found).
- [ ] **Step 4: Implement** `src/catalog/schema.ts` and `pipeline/map.ts` to the signatures above. `artistKey` keeps the raw `b:<n>` string (or `''` when absent). Drop all other Subsonic fields.
- [ ] **Step 5: Run** `npm test -- map` → PASS; `npm run typecheck` → no errors.
- [ ] **Step 6: Commit** `feat: add catalog schema and Subsonic mapping`.

### Task 2: Palette (ported from bookshelf)

**Files:** Create `pipeline/palette.ts`, `tests/pipeline/palette.test.ts`.

**Interfaces:**
- Produces: `type Palette = { dominant: string; accent: string; text: string }`; `extractPalette(image: Buffer): Promise<Palette>` (throws on undecodable input); `paletteOrFallback(key: string, image: Buffer, onFallback: (key: string, err: Error) => void): Promise<Palette>`; `fallbackPalette(key: string): Palette` (deterministic per key); `contrast(a: string, b: string): number`.

- [ ] **Step 1: Write failing tests** (build images in the test with `sharp({ create: { width: 60, height: 90, channels: 3, background: '#1f3a5f' } }).jpeg().toBuffer()`):
  - A solid `#1f3a5f` cover → `dominant` within 16 per channel of `#1f3a5f`.
  - A cover whose outer border is white and centre is `#c4572e` (composite a 30×50 rectangle) → `dominant` is near white (border counted double keeps background colours).
  - `contrast(p.text, p.dominant) >= 4.5` for both covers.
  - `paletteOrFallback('a:1', Buffer.from('not an image'), spy)` resolves to `fallbackPalette('a:1')` and calls `spy` once (Review Focus 5); calling `fallbackPalette('a:1')` twice gives equal results.
- [ ] **Step 2: Run** `npm test -- palette` → FAIL.
- [ ] **Step 3: Implement** by porting `backgroundColour`, `contrast`, `luminance`, `textColourFor`, `CURATED` and the accent-swatch selection from bookshelf `pipeline/palette.ts` (decode to PNG with sharp before `Vibrant.from(png).quality(3).getPalette()`, import from `node-vibrant/node`). Replace its `rng` with a small seeded hash of `key` (e.g. FNV-1a mod `CURATED.length`). Drop its on-disk cache (Task 3 caches). Header comment: `Adapted from chrija76/bookshelf pipeline/palette.ts — MIT, Copyright (c) 2026 chrija76`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: add cover palette extraction (ported from bookshelf)`.

### Task 3: Covers — fetch, cache, convert

**Files:** Create `pipeline/covers.ts`, `tests/pipeline/covers.test.ts`.

**Interfaces:**
- Consumes: `paletteOrFallback` (Task 2), `Cover` type (Task 1).
- Produces:
  - `type ImageFetcher = (coverId: number) => Promise<Buffer | null>` (null = not an image / failed).
  - `subsonicFetcher(client: { raw: (endpoint: string, params: Record<string, string>) => Promise<Response> }): ImageFetcher` — `getCoverArt` with `{ id: 'ca:<n>', size: '1200' }`; returns null unless status 200 and `content-type` starts with `image/`.
  - `bandcampFetcher(fetchImpl?: typeof fetch): ImageFetcher` — `https://f4.bcbits.com/img/a<n>_10.jpg`, same null rule.
  - `ensureCover(albumId: number, coverId: number | null, deps: { fetchers: ImageFetcher[]; cacheDir: string; outDir: string; onFallback: (key: string, err: Error) => void }): Promise<{ cover: Cover | null; source: 'cache' | 'subsonic' | 'bandcamp' | 'none' }>`.
  - Files: original at `<cacheDir>/<coverId>.jpg`; outputs `<outDir>/<albumId>-300.webp` and `<outDir>/<albumId>-1000.webp`; palette cached at `<cacheDir>/<coverId>.palette.json`. `Cover.grid`/`large` are site paths `/covers/<albumId>-300.webp` and `/covers/<albumId>-1000.webp`.

- [ ] **Step 1: Write failing tests** (temp dirs; fetchers are fakes returning sharp-generated JPEGs or null):
  - First fetcher returns an image → both WebP files exist with widths 300 and 1000 (read back with `sharp(...).metadata()`), `source: 'subsonic'`, `cover.grid === '/covers/7-300.webp'`.
  - Calling `ensureCover` again with fetchers that throw if called → `source: 'cache'` and no fetcher call.
  - First fetcher returns null, second returns an image → `source: 'bandcamp'` (Review Focus 1).
  - Both return null → `{ cover: null, source: 'none' }`; `coverId: null` → same without calling fetchers.
  - `subsonicFetcher` with a fake client returning `new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })` → null; with status 500 → null.
- [ ] **Step 2: Run** `npm test -- covers` → FAIL.
- [ ] **Step 3: Implement.** Resize with `fit: 'cover'` to squares (`.resize(300, 300)` / `.resize(1000, 1000)`), `.webp({ quality: 80 })`. Write the original only after a successful fetch. Skip conversion when both WebP files already exist.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: add cover fetching, caching and WebP conversion`.

### Task 4: `npm run catalog` — orchestrate, refuse partial, atomic write, report

**Files:** Create `pipeline/catalog.ts`, `pipeline/report.ts`, `tests/pipeline/report.test.ts`.

**Interfaces:**
- Consumes: `createClient`, `loadConfig`, `log`, `pageAll` from `scripts/subsonic-probe.mts`; Tasks 1–3.
- Produces:
  - `pipeline/report.ts`: `diffCatalogs(prev: Catalog | null, next: Catalog): { added: string[]; removed: string[] }`; `danglingCrateRefs(crates: unknown, next: Catalog): { crateId: string; albumId: number }[]` (crates file shape `[{ id, name, note, albumIds: number[] }]`; returns `[]` when `crates` is null or not an array); `writeJsonAtomic(path: string, data: unknown): Promise<void>` (write `<path>.tmp-<pid>` then `rename`).
  - `pipeline/catalog.ts`: entry point; exits non-zero on refusal.

- [ ] **Step 1: Write failing tests** in `tests/pipeline/report.test.ts`:
  - `diffCatalogs(null, next)` → every id in `added`, `removed: []`; a prev with `bandcamp:album:1` missing from next → `removed: ['bandcamp:album:1']`.
  - `danglingCrateRefs([{ id: 'staff-picks', albumIds: [1, 2] }], catalogWith([2]))` → `[{ crateId: 'staff-picks', albumId: 1 }]`; `danglingCrateRefs(null, …)` → `[]`.
  - `writeJsonAtomic` to a path, then again with different data → file parses to the second value; no `*.tmp-*` files remain in the directory (Review Focus 4).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `report.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5: Implement `pipeline/catalog.ts`:** load config; `createClient(cfg, { prefix: '/rest', auth: 'token', cap: 1500 })`; page `getAlbumList2` (`type=alphabeticalByName`, `size=500`) with `pageAll`. **If `stoppedBy !== 'short-page'`, log the reason and exit 1 without writing anything** (Review Focus 3). For each album: `parseTaggedId(coverArt, 'ca')` → `ensureCover` with `[subsonicFetcher(client), bandcampFetcher()]`, `cacheDir: 'data/.cache/covers'`, `outDir: 'public/covers'`; log progress every 50 albums. Map with `toPublicAlbum`; `CatalogSchema.parse(buildCatalog(...))`; read the previous `public/catalog.json` if present; `writeJsonAtomic('public/catalog.json', catalog)`. Print the summary: albums written, skipped (bad ids), covers by source (cache/subsonic/bandcamp/none), palette fallbacks, `added`/`removed` counts with up to 10 removed titles, dangling crate refs from `content/crates.json` if it exists, requests used, elapsed time.
- [ ] **Step 6: Live run** (Claude runs it; ~10 minutes the first time): `npm run catalog`. Expected: `albums written: 1215` (or the current count), covers mostly `subsonic`, `none` small, no refusal. Then `node --env-file=.env.local scripts/subsonic-probe.mts check-secrets` → `PASS`, and `grep -cE 'subsonic|/rest/|[?&][utsp]=' public/catalog.json` → `0`.
- [ ] **Step 7: Second live run** → summary shows covers all `cache`, `added 0`, `removed 0`, and well under 10 requests (only the 3 list pages).
- [ ] **Step 8: Commit** `feat: add npm run catalog`.

### Task 5: Dev fixture and docs

**Files:** Create `fixtures/catalog-sample.json`, `docs/CATALOG.md`.

- [ ] **Step 1:** Write `fixtures/catalog-sample.json`: the first 20 albums of the real catalog **with `cover: null`** (album art is not committed to git), validated by a test in `tests/pipeline/map.test.ts`: `CatalogSchema.parse(fixture)` succeeds and `fixture.count === 20`.
- [ ] **Step 2:** `docs/CATALOG.md`: what `npm run catalog` does, how long the first and later runs take (from Task 4's real numbers), where output goes, what is git-ignored, the cover sources and fallbacks, and the bookshelf credit.
- [ ] **Step 3:** `npm test` (whole suite) → all pass; `npm run typecheck` → clean. **Commit** `docs: add catalog fixture and pipeline guide`.
