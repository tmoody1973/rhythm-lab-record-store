# 3D Record Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D record shop the site's front door — a full-page, orbitable, lived-in shop with eight sections, cratedigger-style digging inside the 3D bins, a 3D "My crates", and a phone-tuned version — built test-first from the `spike/iso-shop` prototype.

**Architecture:** Pure, unit-tested modules decide everything that can be decided without a GPU (which section a record is in, where every bin and sleeve stands, each sleeve's pose, where the camera aims, URL state, quality tier). Thin React Three Fiber components draw what those modules decide, and every 3D action has an HTML control so Playwright drives the shop through buttons and a `role="status"` line. The 3D code is lazy-loaded; without WebGL the existing grid and flat My crates remain.

**Tech Stack:** React 19, Vite 8, Tailwind 4, TypeScript, Three.js 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (CameraControls, Text, useTexture, useGLTF, Clone), Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-record-shop-design.md` (decisions 1–13; decision log `docs/decisions/006-shop-is-the-front-door.md`). **Reference implementation:** branch `spike/iso-shop` — read any spike file with `git show spike/iso-shop:<path>`; port it, don't copy it blind: every ported behaviour gets its test first.

## Global Constraints

- Versions exactly: `three@0.186.1`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`, `@types/three@0.186`. Not Fiber v10 alpha. No physics, game engine or Blender pipeline.
- The 3D code is reached only through `lazy(() => import(...))`; the grid bundle must not import `three`.
- Without WebGL the site shows the grid and the flat My crates (milestone 2), never a blank room.
- Geometry invariant: no sleeve leans through a bin wall or into its neighbour (`tests/shop/geometry.test.ts` must keep passing).
- Every 3D action has an HTML control; arrows dig, Enter/Space shows, Esc steps back; **Alt/Ctrl/⌘/Shift + arrow is never captured**; reduced motion snaps instead of animating; the current record is announced in a `role="status"` element as `"<title> by <artist>, <n> of <N>"`.
- The store always shows the whole collection; search and grid filters live in the grid.
- Posters: typographic tributes only (no faces, logos or album art). Decor is CC0 Poly Haven, fetched by `npm run decor` into gitignored `public/decor/`; builds and tests must pass without it.
- Credits: keep cratedigger's MIT copyright lines verbatim wherever its motion is ported: `Copyright (c) 2015 Oz Conseil` and `Copyright (c) 2014 Daniel Tello`. (The spike's comment credited the wrong name — fix it.)
- Repo rules: TDD (watch each test fail first); conventional commits; **no Co-Authored-By lines**; git author is the configured GitHub no-reply address; never read `.env.local`; PR to `main`; CI must be green (`typecheck`, `test`, `test:probe`, `build`, Playwright).
- Playwright must use its own dev server port (`5318`) and never reuse Tarik's running server on 5317.

## Review Focus

1. **The GPU gives up mid-visit** (WebGL context lost, e.g. sleep/wake or driver reset) → the visitor lands on the grid with a short notice, not a black page; 3D isn't retried this session. *Test: Task 6.*
2. **Rapid input** (spinning the wheel, holding an arrow, mashing Next) → the index stays in range and the status always names the record actually standing (BUILD-PLAN: "rapid selection never produces the wrong record"). *Test: Task 2 (pure) and Task 8 (e2e).*
3. **Hand-edited or stale links** (`?section=bogus`, `?bin=99`, `?bin=-1`, `?view=nonsense`) → the store opens at the nearest valid level, no crash. *Test: Task 4 (parse) and Task 7 (e2e).*
4. **Saved crates that mention records no longer in the catalog** → they're skipped and counts reflect only real records. *Test: Task 10.*
5. **Rotating a phone or resizing mid-dig** → the camera re-frames for the new shape, the current record stays current, no sideways scroll. *Test: Task 11.*

## File structure

| File | Responsibility |
|---|---|
| `src/shop/sections.ts` | The eight sections, record → section, A–Z bins (pure) |
| `src/shop/layout.ts` | Where every section and bin sits; room size grows with the catalog (pure) |
| `src/shop/geometry.ts` | Sleeve slots and lean caps inside a bin (pure; port + existing test) |
| `src/shop/dig.ts` | Sleeve pose, index stepping, easing factor (pure) |
| `src/shop/camera.ts` | Camera aims for store / section / dig / shown, by screen shape (pure) |
| `src/shop/quality.ts` | Full vs light tier by screen width and memory (pure) |
| `src/shop/decor.ts` | Decor manifest schema and URLs, or null → flat colours (pure) |
| `src/shop/staffPicks.ts` | Tarik's `staff-picks` crate → records (pure) |
| `src/shop/support.ts` | `has3D()` and the "3D gave up this session" flag |
| `src/shop/scene/Materials.tsx` | Shared brick/plank/walnut materials, flat-colour fallback |
| `src/shop/scene/Room.tsx` | Floor, fading walls, neon, posters, lamps, rug, door, listening station, counter, plants, staff-picks wall |
| `src/shop/scene/Bins.tsx` | Bin boxes, instanced sleeves, front covers, divider cards, brass plaques, section lights |
| `src/shop/scene/DigBin.tsx` | The bin being dug: cratedigger motion (MIT notice in header) |
| `src/shop/scene/CameraRig.tsx` | CameraControls limits + applying aims |
| `src/shop/ShopScene.tsx` | Default export: Canvas + scene + `ShopOverlay`; context-loss handling |
| `src/shop/ShopOverlay.tsx` | HTML: section pills, bin pills, footer controls, status line, Store/Grid switch |
| `src/shop/CrateStage.tsx` | Default export: 3D My crates |
| `src/state/url.ts` | + `view`, `section`, `bin` |
| `src/ui/Collection.tsx`, `src/App.tsx`, `src/ui/CratesPanel.tsx` | Front door switch, footer, banner layering, 3D My crates switch |
| `scripts/fetch-decor.mts` | Download + slim decor, write manifest |
| `public/posters/*.webp`, `public/fonts/InterTight.ttf`, `public/fonts/OFL.txt` | Committed art and font |
| `THIRD_PARTY_NOTICES.md` | cratedigger MIT, bookshelf MIT, Poly Haven CC0, Inter Tight OFL |

---

### Task 1: Sections and the room layout

**Files:**
- Create: `src/shop/sections.ts`, `src/shop/layout.ts`
- Test: `tests/shop/sections.test.ts`, `tests/shop/layout.test.ts`

**Interfaces:**
- Produces:
  - `type SectionId = 'electronic' | 'soul-funk' | 'hip-hop' | 'jazz' | 'rock-pop-alt' | 'global' | 'left-field' | 'fresh'`
  - `type Section = { id: SectionId; name: string; genres: string[]; width: number; x: number; aisle: 0 | 1 | 2 | 3; crates?: true }`
  - `const SECTIONS: readonly Section[]` — values below
  - `sectionOf(r: PublicAlbum): SectionId`
  - `type Bin = { section: string; index: number; label: string; records: PublicAlbum[] }`
  - `binsBySection(albums: PublicAlbum[]): Map<SectionId, Bin[]>` — A–Z by artist (`localeCompare(…, 'en', { sensitivity: 'base' })`), 48 per bin, 24 per milk crate; label = first and last artist initials (`"A–E"`, or `"#"` for non-letters; one letter if equal)
  - `type Placed = { key: string; bin: Bin; x: number; z: number; w: number }` (`key = "<section>:<index>"`)
  - `type Rect = { x: number; z: number; w: number; d: number }`
  - `layoutShop(bins: Map<SectionId, Bin[]>): { room: { width: 24; backZ: -8; frontZ: number }; placed: Placed[]; sections: Map<SectionId, Rect> }`

Section table (approved, decision 13; widths and x from the spike):

| id | name | genres | width | x | aisle |
|---|---|---|---|---|---|
| electronic | Electronic | electronic, ambient | 17.2 | -1.6 | 0 |
| soul-funk | Soul & Funk | r&b soul, funk, blues | 7.2 | -5 | 1 |
| hip-hop | Hip-Hop | hip hop rap | 7.2 | 3.6 | 1 |
| jazz | Jazz | jazz | 7.2 | -5 | 2 |
| rock-pop-alt | Rock, Pop & Alt | alternative, pop, rock, folk, punk, acoustic | 7.2 | 3.6 | 2 |
| global | Global Sounds | world, latin, reggae, devotional | 4.8 | -6.2 | 3 |
| left-field | Left Field | experimental, soundtrack, classical, kids (+ any unknown genre) | 4.8 | -0.6 | 3 |
| fresh | Fresh Crates | (no genre) | 4.8 | 6.6 | 3, `crates: true` |

Layout rule (the reflow the spec asks for): bin footprint `BW 2.2 × BD 1.15`, crate width `CW 1.1`, gap `GAP 0.2` (constants live in `geometry.ts`). In each section, `cols = floor((width + GAP) / (binWidth + GAP))`, rows grow as needed, bins centred in their row. Aisle depth = the deepest section in it. Aisles stack from the back wall forward: first aisle starts `1.0` in front of `backZ`, `WALKWAY = 1.6` between aisles, and `frontZ = last aisle front + 2.6` (room for the door) but never less than `8`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/shop/sections.test.ts
test('every record lands in exactly one section; counts add up', () => {
  const albums = fixture.albums; // fixtures/catalog-sample.json
  const bins = binsBySection(albums);
  const total = [...bins.values()].flat().reduce((n, b) => n + b.records.length, 0);
  expect(total).toBe(albums.length);
  expect(new Set([...bins.values()].flat().flatMap((b) => b.records.map((r) => r.id))).size).toBe(albums.length);
});
test('no genre → Fresh Crates; unknown genre → Left Field; case-insensitive', () => {
  expect(sectionOf({ ...rec, genre: null })).toBe('fresh');
  expect(sectionOf({ ...rec, genre: 'Polka' })).toBe('left-field');
  expect(sectionOf({ ...rec, genre: 'Hip Hop Rap' })).toBe('hip-hop');
});
test('bins hold 48, milk crates 24, A–Z with initial-range labels', () => { /* 100 jazz → 3 bins 48/48/4; 30 fresh → 24/6; label of a bin of A…E artists is "A–E" */ });
```

```ts
// tests/shop/layout.test.ts — for the fixture, for today's real counts (297,228,169,148,132,64,59,118) and for double them:
test('no two bins overlap and every bin is inside the room', () => { /* rect intersection over all placed pairs; x within ±12, z within (backZ, frontZ) */ });
test('aisles keep a walkway of at least 1.6 between them', () => {});
test('the room grows when the catalog does, and is never shallower than 16', () => {
  expect(layoutShop(double).room.frontZ).toBeGreaterThan(layoutShop(today).room.frontZ);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/shop/sections.test.ts tests/shop/layout.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `sections.ts` (port the spike's `sectionOf`/`binsBySection`, typed `SectionId`) and `layoutShop` in `layout.ts` per the rule above.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `npm test` — all green.
- [ ] **Step 5: Commit** `feat(shop): sections and a room layout that grows with the catalog`

### Task 2: Bin geometry and dig logic

**Files:**
- Create: `src/shop/geometry.ts` (port from spike verbatim), `src/shop/dig.ts`
- Test: `tests/shop/geometry.test.ts` (port from spike), `tests/shop/dig.test.ts`

**Interfaces:**
- Consumes: `Placed` (Task 1).
- Produces: from `geometry.ts` — `BW, BD, GAP, CW, SLEEVE, THICK, BASE_Y, WALL, FRONT_H, BACK_H, LEAN, STEP`, `type Slot`, `slot(w: number, count: number, i: number, perComp = 24): Slot`. From `dig.ts` — `type Pose = 'back' | 'forward' | 'up' | 'shown'`; `poseOf(p: Placed, i: number, sel: number, shown: boolean): Pose`; `stepSel(sel: number, delta: number, count: number): number`; `easeFactor(dt: number, reduced: boolean, lambda?: number): number` (default `lambda = 6`).

- [ ] **Step 1: Write the failing tests** — keep the spike's geometry test unchanged; add:

```ts
test('passed records fall forward, the current one is up (or shown), the rest lean back — same compartment only', () => {
  expect(poseOf(bin48, 3, 5, false)).toBe('forward');
  expect(poseOf(bin48, 5, 5, false)).toBe('up');
  expect(poseOf(bin48, 5, 5, true)).toBe('shown');
  expect(poseOf(bin48, 30, 5, false)).toBe('back'); // other compartment
  expect(poseOf(bin48, 0, -1, false)).toBe('back'); // nothing selected yet
});
test('rapid stepping never leaves the bin', () => {
  let s = -1; for (let k = 0; k < 500; k++) s = stepSel(s, 1, 48); expect(s).toBe(47);
  for (let k = 0; k < 500; k++) s = stepSel(s, -1, 48); expect(s).toBe(0);
  expect(stepSel(-1, 1, 0)).toBe(-1); // empty bin
});
test('reduced motion snaps; otherwise eases', () => {
  expect(easeFactor(0.016, true)).toBe(1);
  expect(easeFactor(0.016, false)).toBeCloseTo(1 - Math.exp(-6 * 0.016));
});
```

- [ ] **Step 2: Run** `npx vitest run tests/shop/geometry.test.ts tests/shop/dig.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — `geometry.ts` from the spike; `dig.ts` small functions (forward = same `comp`, `j < selSlot.j`).
- [ ] **Step 4: Run** — Expected: PASS; `npm test` green.
- [ ] **Step 5: Commit** `feat(shop): bin geometry and dig poses`

### Task 3: Camera aims

**Files:** Create `src/shop/camera.ts`; Test `tests/shop/camera.test.ts`

**Interfaces:**
- Consumes: `Placed`, `Rect`, room from Task 1; `slot` from Task 2.
- Produces: `type Aim = { position: [number, number, number]; target: [number, number, number] }`; `storeAim(room, aspect: number): Aim`; `sectionAim(rect: Rect, aspect: number): Aim`; `digAim(p: Placed, sel: number, shown: boolean, aspect: number): Aim`.

Landscape values are the spike's (`aimAtDig` and the store/section `setLookAt` calls). Portrait rule: when `aspect < 1`, move the camera away from the target along the same direction by factor `min(2.2, 1 / aspect)`.

- [ ] **Step 1: Write the failing tests**

```ts
test('a phone (portrait) frames from farther away than a laptop', () => { expect(dist(digAim(p, 3, false, 0.46))).toBeGreaterThan(dist(digAim(p, 3, false, 1.6))); });
test('showing a record moves the camera closer than digging', () => { expect(dist(digAim(p, 3, true, 1.6))).toBeLessThan(dist(digAim(p, 3, false, 1.6))); });
test('the store aim looks at the middle of the room; every aim stays above the floor', () => {});
```

- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS), `npm test` green.
- [ ] **Step 5: Commit** `feat(shop): camera aims, framed for phones and laptops`

### Task 4: The store is the front door (URL state, fallback, e2e migration)

**Files:**
- Modify: `src/state/url.ts`, `src/ui/Collection.tsx`, `src/App.tsx`, `src/ui/Header.tsx` (search → grid), `playwright.config.ts`, `tests/e2e/browse.spec.ts`, `tests/e2e/dialog.spec.ts`, `tests/e2e/flow.spec.ts`
- Create: `src/shop/support.ts`, a stub `src/shop/ShopScene.tsx` (default export rendering `<div data-testid="shop" />` — Task 6 replaces it)
- Test: `tests/web/state.test.ts`, `tests/web/front-door.test.tsx`

**Interfaces:**
- Produces:
  - `UrlState` gains `view: 'store' | 'grid'`, `section: string | null`, `bin: number | null`. `DEFAULT_STATE.view = 'store'`. `toSearch` writes `view=grid` only for grid; `section` must match the existing `SLUG` regex; `bin` is an integer `0 ≤ bin < 1000`; anything else parses to default.
  - `has3D(): boolean` (true when `'WebGLRenderingContext' in window` and session flag `rl-no-3d` is not set); `give3DUp(): void` (sets the flag).
  - `Collection` renders `lazy(() => import('../shop/ShopScene.tsx'))` when `state.view === 'store' && has3D()`, else the grid; in the grid the Store button is disabled with `title="This browser can't show the 3D shop"` when `!has3D()`.
- Behaviour: typing in the header search while in the store patches `{ q, view: 'grid' }`; the footer is hidden in the store; notices and the shared-crate banner sit in a `relative z-10` wrapper so they stay above the full-page canvas.

- [ ] **Step 1: Write the failing tests** — state: round-trip with `view: 'grid', section: 'jazz', bin: 2`; `toSearch(DEFAULT_STATE) === ''`; `parseUrl('?view=nonsense&section=%3Cx%3E&bin=-1')` equals `DEFAULT_STATE`; `parseUrl('?bin=99999').bin === null`. Front door (jsdom): `vi.mock('../../src/shop/ShopScene.tsx', () => ({ default: () => <div data-testid="shop" /> }))`; with `vi.stubGlobal('WebGLRenderingContext', class {})` the app at `/` shows `getByTestId('shop')`; typing "chiu" in the search shows the records list and `location.search` contains `view=grid`; without the stub, `/` shows the records list.
- [ ] **Step 2: Run** `npx vitest run tests/web/state.test.ts tests/web/front-door.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the URL fields, `support.ts`, the stub scene, the Collection/App/Header changes.
- [ ] **Step 4: Migrate e2e** — `playwright.config.ts`: `use.baseURL 'http://localhost:5318'`, `webServer: { command: 'npm run dev -- --port 5318 --strictPort', port: 5318, reuseExistingServer: false }`, Chromium `launchOptions.args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']`. Grid-focused specs (`browse`, `dialog`, `flow`'s grid part) navigate to `/?view=grid`. `crates.spec.ts` is left failing until Task 10 — mark its two tests `test.fixme` with a comment pointing to Task 10.
- [ ] **Step 5: Run** `npm test` and `npx playwright test` — Expected: all pass except the two `fixme`s (reported as skipped).
- [ ] **Step 6: Commit** `feat: the store is the front door; grid at ?view=grid`

### Task 5: Decor pipeline, quality tiers, posters and font

**Files:**
- Create: `scripts/fetch-decor.mts` (port + slimming), `src/shop/quality.ts`, `src/shop/decor.ts`, `public/posters/*.webp` (the 6 files from `spike/iso-shop`), `public/fonts/InterTight.ttf`, `public/fonts/OFL.txt`
- Modify: `package.json` (`"decor": "node scripts/fetch-decor.mts"`, devDependency `@gltf-transform/cli@4`), `.gitignore` (`public/decor/`)
- Test: `tests/shop/quality.test.ts`, `tests/shop/decor.test.ts`

**Interfaces:**
- Produces:
  - `type Quality = { tier: 'full' | 'light'; dpr: [number, number]; shadowMapSize: 1024 | 2048; lushPlants: boolean; plantCount: number }`
  - `qualityFor(width: number, memoryGB?: number): Quality` — light when `width < 768` or `memoryGB <= 4`: `{ dpr: [1, 1.5], shadowMapSize: 1024, lushPlants: false, plantCount: 4 }`; full: `{ dpr: [1, 2], shadowMapSize: 2048, lushPlants: true, plantCount: 8 }`.
  - `DecorManifestSchema` (zod: `{ version: 1, files: string[] }`); `decorUrls(m: DecorManifest | null): DecorUrls | null` (null → flat-colour fallback).
- Pipeline: textures `brick_wall_02`, `dark_wooden_planks`, `black_walnut_veneer_01` (diffuse + GL normal, 1k) converted with `sharp` to 1024 px WebP q80; plants `potted_plant_02` (lush) and `potted_plant_04` fetched as 1k glTF, then `npx gltf-transform simplify <in> <out> --ratio 0.3` on the lush plant, `resize --width 512` and `webp` on both; writes `public/decor/manifest.json`. **Budget: `du -sh public/decor` ≤ 3 MB.**
- Font: Inter Tight from the google/fonts repository (`ofl/intertight`), committed with its OFL licence text; used by every drei `<Text>` via `font="/fonts/InterTight.ttf"`.

- [ ] **Step 1: Write the failing tests** — `qualityFor(390).tier === 'light'`, `qualityFor(1440).tier === 'full'`, `qualityFor(1440, 4).tier === 'light'`; `decorUrls(null) === null`; a manifest missing a texture → `decorUrls` returns null; schema rejects `{ version: 2 }`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Run** `npm run decor` then `du -sh public/decor` — Expected: ≤ 3M and `manifest.json` present.
- [ ] **Step 6: Commit** `feat(shop): slim CC0 decor, quality tiers, tribute posters, self-hosted font`

### Task 6: The room on screen (static scene, orbit, idle stop, context loss)

**Files:**
- Create: `src/shop/scene/Materials.tsx`, `src/shop/scene/Room.tsx`, `src/shop/scene/Bins.tsx`, `src/shop/scene/CameraRig.tsx`
- Replace: `src/shop/ShopScene.tsx` (the Task 4 stub)
- Create: `src/shop/ShopOverlay.tsx` (only the Store/Grid switch and the hint line in this task)
- Test: `tests/e2e/shop.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5 (`layoutShop`, `storeAim`, `has3D`/`give3DUp`, `qualityFor`, `decorUrls`).
- Produces:
  - `ShopScene` default export, props `{ albums: PublicAlbum[]; state: UrlState; patch: (p: Partial<UrlState>, o?: { push?: boolean }) => void; onOpenRecord: (r: PublicAlbum) => void; staffPicks: PublicAlbum[] }`
  - `CameraRig` props `{ aim: Aim; interactive: boolean; minDistance: number }` — drei `CameraControls` with `minPolarAngle 0.2`, `maxPolarAngle 1.32`, `maxDistance 42`, `smoothTime 0.35` (0 when reduced motion); applies `aim` via `setLookAt(..., true)` when it changes.
- Behaviour (port from spike): walls fade when the camera is outside them; brick back wall with neon "RHYTHM LAB" and the six posters (`miles-davis`, `bjork` left of the neon; `tribe-called-quest`, `j-dilla` right; `sun-ra`, `alice-coltrane` over the listening station); left wall green with sconces; rug; door + OPEN on the front wall; doormat; listening station; counter; plants per `Quality`; bins, instanced sleeves coloured by `cover.dominant`, front covers, divider cards every 8 sleeves, brass plaques, a spotlight per section (brighter on hover). Decor (textures, plants, posters, font) loads inside its own `<Suspense>` boundaries so bins, sleeves and pills are usable before it arrives (flat colours meanwhile). Canvas `frameloop="demand"`; anything easing calls `invalidate()` until settled. In development builds only (`import.meta.env.DEV`) a `useFrame` increments `window.__rlFrames`. On `webglcontextlost`: `give3DUp()`, `patch({ view: 'grid' })`, and the app shows the notice "The 3D shop stopped working in this browser, so here's the grid."

- [ ] **Step 1: Write the failing e2e tests** (fixture catalog via the existing `offline` routing helper):

```ts
test('the front door is the shop: canvas and the Store/Grid switch', async ({ page }) => { /* goto '/', expect canvas visible, Store pressed */ });
test('the scene stops drawing when nothing moves', async ({ page }) => {
  // after 3 s idle: read __rlFrames, wait 1.5 s, read again → difference ≤ 2
});
test('if the GPU gives up, the grid takes over with a notice', async ({ page }) => {
  // page.evaluate: document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()
  // expect the records list and the notice text; reload → still the grid (session flag)
});
```

- [ ] **Step 2: Run** `npx playwright test tests/e2e/shop.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the scene files, porting from `git show spike/iso-shop:src/shop/ShopScene.tsx` and `.../Decor.tsx`, split per the file table.
- [ ] **Step 4: Run** — Expected: PASS; full `npx playwright test` green (except Task 10's `fixme`s); `npm run build` passes **with `public/decor/` removed** (`mv public/decor /tmp/decor-bak && npm run build && mv /tmp/decor-bak public/decor`).
- [ ] **Step 5: Look at it** — screenshot `/` at 1440×900; compare with the spike's overview; describe what you see in the commit body.
- [ ] **Step 6: Commit** `feat(shop): the room — orbit, fading walls, lived-in decor, idle stop`

### Task 7: Walking the shop (sections, bins, URL and Back)

**Files:** Modify `src/shop/ShopScene.tsx`, `src/shop/ShopOverlay.tsx`; Test `tests/e2e/shop.spec.ts`

**Interfaces:**
- Consumes: `UrlState.section/bin`, `sectionAim`, `digAim(p, -1, false, aspect)`.
- Behaviour: section pills ("Whole shop" + eight with counts; "Staff picks" added in Task 9) and, inside a section, bin pills (`"A–E · 48"`). Choosing a section or a bin — by pill or by clicking in the room (ignore pointer moves > 6 px, which are orbit drags) — calls `patch({ section, bin }, { push: true })`. Esc steps out one level (bin → section → store) with a normal `patch` (Back does the same through history). Unknown `section` → `patch({ section: null, bin: null })` without push; `bin` out of range → `patch({ bin: null })`. Orbit is enabled except while digging; store `minDistance 10`, otherwise `3`.

- [ ] **Step 1: Write the failing e2e tests** — Jazz pill → URL has `section=jazz` and bin pills appear; first bin pill → `bin=0` and the footer shows Previous/Show/Next; browser Back → `section=jazz` without `bin`; Back → no `section`; `goto('/?section=bogus&bin=99')` → "Whole shop" pressed, URL cleaned, no page error.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Commit** `feat(shop): step into sections and bins; Back steps out`

### Task 8: Digging (cratedigger motion, Show, Open album)

**Files:** Create `src/shop/scene/DigBin.tsx`; Modify `src/shop/ShopScene.tsx`, `src/shop/ShopOverlay.tsx`; Test `tests/e2e/shop.spec.ts`

**Interfaces:**
- Consumes: `poseOf`, `stepSel`, `easeFactor`, `slot`, `digAim`.
- Produces: `DigBin` props `{ p: Placed; sel: number; shown: boolean; mouse: RefObject<{ x: number; y: number }>; onPick: (i: number) => void; textured: boolean }`.
- Behaviour (port from spike; header comment carries cratedigger's two copyright lines): each sleeve pivots on its bottom edge and eases to its pose (lean caps from `slot`); current sleeve rises 0.18; shown sleeve rises to 0.95 and turns to face the camera; the room dims to 30 % while shown; the bin sways toward the mouse (±0.09 rad yaw, ±0.03 pitch). Input while digging: wheel (one step per 90 ms; the page doesn't scroll), vertical drag (one step per 26 px; up = next), ArrowRight/Down next, ArrowLeft/Up previous (ignored with any modifier or while typing), Enter/Space toggles Show, buttons Previous/Show/Next → Open album/Put back. `role="status"` announces the current record. Opening the album uses `onOpenRecord`; closing it leaves the dig exactly where it was. Sleeve textures load only for the bin being dug.

- [ ] **Step 1: Write the failing e2e tests** — in the first bin: Next → status ends with `"1 of N"` then `"2 of N"`; clicking Next 60 times quickly → status ends `"N of N"` and names the same title the footer shows; `Alt+ArrowRight` leaves the status unchanged; Show → Open album → the album dialog's name equals the status title; close it → status unchanged and Put back visible; with `page.emulateMedia({ reducedMotion: 'reduce' })` the scene root has `data-reduced-motion="true"`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Commit** `feat(shop): dig inside the bin with cratedigger's motion`

### Task 9: The staff-picks wall

**Files:** Create `src/shop/staffPicks.ts`; Modify `src/shop/scene/Room.tsx`, `src/shop/ShopScene.tsx`, `src/shop/ShopOverlay.tsx`, `src/ui/Collection.tsx` (pass `staffPicks`); Test `tests/shop/staffPicks.test.ts`, `tests/e2e/shop.spec.ts`

**Interfaces:**
- Consumes: `TARIK_CRATES` (`src/crates/curation.ts`), `binsBySection`-style binning (48 per bin).
- Produces: `staffPicks(crates: TarikCrate[], byId: Map<string, PublicAlbum>): PublicAlbum[]` — the crate with id `staff-picks`, in its order, unknown ids dropped; `[]` if absent.
- Behaviour: the left wall shows the first 12 picks face-out (3 rows × 4); clicking the wall (or a "Staff picks" pill, shown only when there are picks) navigates to `section=staff-picks`, digging those records like a bin. With no picks the wall is bare — no placeholder covers.

- [ ] **Step 1: Write the failing tests** — unit: absent crate → `[]`; order kept; unknown id dropped. e2e (repo's `content/crates.json` is `[]`): no "Staff picks" pill and `?section=staff-picks` cleans to the store.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Commit** `feat(shop): staff-picks wall from Tarik's crate`

### Task 10: My crates as a 3D crate

**Files:** Create `src/shop/CrateStage.tsx` (port); Modify `src/ui/CratesPanel.tsx` (`has3D()` switch, export `CratesPanelProps`); Rewrite `tests/e2e/crates.spec.ts` (remove the Task 4 `fixme`s); Adapt `tests/e2e/flow.spec.ts`; Test `tests/web/crates-ui.test.tsx` (unchanged — jsdom has no WebGL, so it keeps testing the flat fallback)

**Interfaces:**
- Consumes: `DigBin`, `digAim`, `stepSel`, Materials, `has3D`.
- Behaviour (spec "My crates"): full-screen native `<dialog>`; brass tabs (Favorites first, opens on the last crate used); Copy share link / Rename / Delete under the tabs; Back/Show/Flip, wheel, drag and arrows dig; Show → Open album / Put back / Remove; crates over 48 split into bins (`"bin 2 of 3"`); empty crates say how to fill them; records whose ids aren't in the catalog are skipped and not counted; closing an album returns to the same sleeve.

- [ ] **Step 1: Write the failing e2e tests** — seeded favourites + a crate with one unknown id: tabs show real counts (unknown excluded); Flip → status `"2 of 2"`; drag up 30 px → next; Show → Open album → close → status unchanged; Alt+Arrow ignored; Copy share link → link matches `/?shared=`; reduced motion → `data-reduced-motion="true"`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS); `npm test` still passes the flat tests.
- [ ] **Step 5: Commit** `feat: My crates as a 3D crate`

### Task 11: Phones

**Files:** Modify `src/shop/ShopScene.tsx`, `src/shop/ShopOverlay.tsx`, `src/shop/CrateStage.tsx`; Test `tests/e2e/shop-phone.spec.ts`

**Interfaces:** Consumes `qualityFor(window.innerWidth, navigator.deviceMemory)` and the `aspect` argument of every aim (recomputed on resize).

- Behaviour: light tier below 768 px; section pills scroll sideways inside their bar (the page itself never scrolls sideways); bin pills wrap; footer buttons are at least 44 px tall; touch drag digs; aims re-frame on resize/rotation without changing the current record.

- [ ] **Step 1: Write the failing e2e tests** (Playwright `devices['iPhone 13']`): at `/` the overview and pills are visible and `scrollWidth <= innerWidth`; Jazz → first bin → Next ×3 via buttons → status `"3 of N"`; Show → Open album opens; rotate to 844×390 mid-dig → status unchanged, no sideways overflow.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Look at it** — screenshots of overview, dig and shown at 390×844; describe them in the commit body.
- [ ] **Step 6: Commit** `feat(shop): tuned for phones`

### Task 12: Credits, docs, and the whole-branch gate

**Files:** Create `THIRD_PARTY_NOTICES.md`; Modify `src/ui/AboutPage.tsx` (How it works step 5: the shop is live — "Walk into the shop: the front page is a 3D record shop you can turn around, step into and dig through."), `README.md` ("The 3D shop" section: `npm run decor`, quality tiers, fallback), `tests/web/about.test.tsx` if its text assertion changes.

- [ ] **Step 1:** Update the About test to expect the new step-5 sentence — run, watch it FAIL — update the page — PASS.
- [ ] **Step 2:** Write `THIRD_PARTY_NOTICES.md` with cratedigger's MIT licence (both copyright lines verbatim), bookshelf's MIT notice, Poly Haven CC0 (asset ids), Inter Tight OFL.
- [ ] **Step 3: Run the full CI set** — `npm run typecheck && npm test && npm run test:probe && npm run build && npx playwright test` — Expected: all pass, none skipped.
- [ ] **Step 4: Bundle check** — `npm run build` output: the main entry chunk does not contain `three` (search `dist/assets/index-*.js` for `WebGLRenderer`; Expected: not found).
- [ ] **Step 5: Commit** `docs: credits and README for the 3D shop`; push; open the PR to `main`; wait for CI green. **Do not merge** — Tarik decides.
