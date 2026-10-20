# Rhythm Lab Record Store — milestone 3 design: the 3D record shop

Date: 2026-10-20 · Status: builder-checked; Tarik's answers to the builder's questions folded in (decisions 10–13); awaiting Tarik's read
Builds on: `docs/BUILD-PLAN.md` (sections "Record animation", "Make 1,296 items easy to browse", "Build in this order §3"), `docs/superpowers/specs/2026-10-19-record-store-v1-design.md` (milestone 2: grid, album pop-up, visitor crates, enrichment).
**Living reference:** branch `spike/iso-shop` (throwaway prototype, commits `b51acd4` → `be4fa95`). Run it with `npm run catalog && npm run decor && npm run dev`, open `/?view=store`. Where this document and the spike disagree, this document wins; where this document is silent on a look or a motion, the spike is the reference.
Inspiration (read before building): `risq/cratedigger` (MIT) — https://github.com/risq/cratedigger, live demo http://risq.github.io/cratedigger/ ; `chrija76/bookshelf` (MIT) — https://github.com/chrija76/bookshelf .

## Intent and why

The site's front door was always meant to be a shop you walk into (milestone-2 spec: "Front door is the shop room"). Milestone 2 shipped the useful parts — a cover grid, the album pop-up with Bandcamp's player, visitor hearts and crates — but a grid is a catalogue, not a record shop. This milestone makes the experience Tarik has when he digs for Rhythm Lab show prep: wander a warm, lived-in shop, step up to a section, and flip through a crate with your fingers.

Success, in Tarik's terms from the design session: it must **feel natural** — like cratedigger's crate, inside a store like the rendered mockup — not "weird". His verdict on spike v1 ("feels weird and not natural") is the anti-goal.

## Decided by Tarik (2026-10-20)

1. **A whole-store overview you click into.** An isometric-style floor plan of the shop with sections; clicking a section zooms in.
2. **Hybrid look:** a dollhouse cutaway's readable shape with a real shop's moody light (warm pools of light per section, neon, brick, dim between).
3. **The store is the whole page,** like the bookshelf site — no framed box, no hero text; header and controls float over it.
4. **You can rotate around the store** (orbit), not just look from one angle.
5. **Digging feels like cratedigger,** inside the 3D crate itself (not a flat pop-up): passed records fall forward, the current one rises, the rest lean back; the camera follows; Show lifts the record to face you.
6. **Records never pass through the crate walls** (bug Tarik found in the spike).
7. **Lived-in and decorative:** real-looking plants, brick and wood, lamps, a rug, divider cards, posters.
8. **Posters are typographic tributes** — artist name and abstract design, no faces, no logos, no album art — for Miles Davis, Björk, A Tribe Called Quest, J Dilla, Sun Ra, Alice Coltrane.
9. **"My crates" is a real 3D crate too,** not a flat panel ("the UX isn't impactful").
10. **Phones get the store, tuned for phones:** camera framed for a tall screen at every level (overview, section, dig, shown record), lighter decor (fewer plants, softer/smaller shadows), digging fully supported by touch. No feature is desktop-only.
11. **The store is the front door** at `/` when the browser can draw 3D; Grid is one tap away (`?view=grid`); record links (`?record=`) and share links (`?shared=`) keep working over the store. Because every first visit now loads the 3D code and decor, the build must slim the decor (see Constraints). Recorded as `docs/decisions/006-shop-is-the-front-door.md`.
12. **The staff-picks wall shows Tarik's real picks and is clickable:** it displays his `staff-picks` crate (`content/crates.json`, filled with `npm run import-crate`) face-out; clicking it digs those records like a bin. Until he fills it, the wall's shelves are bare — no placeholders (they'd read as his picks).
13. **The eight sections are approved as listed below.**

## The experience, in order

**Arriving.** The page is the shop: a cutaway room seen from a high three-quarter angle in real perspective (spike: fov 40). Brick back wall with a warm neon "RHYTHM LAB"; a dark green left wall with the staff-picks wall of face-out records; plank floor; walnut bins. The site header floats on top (logo, search, My crates); a pill bar of sections floats under it ("Whole shop" + the eight sections with counts); the Store/Grid switch floats bottom-right; a one-line hint bottom-left ("Drag to walk around · scroll to step closer · click a section").

**Looking around.** Drag orbits the room; scroll moves closer, stopping among the bins (never inside the floor); the camera can't go under the floor. Whichever walls stand between the camera and the room fade out, so the room always reads as an open dollhouse. Hovering a section (in the room or its pill) brings its spotlight up.

**Stepping up to a section.** Clicking a section (brass plaque on its bins, the bins themselves, or its pill) eases the camera down to that section. Its bins appear as pills ("A–E · 48"). Esc or "Whole shop" steps back.

**Digging.** Clicking a bin drops the camera to a low, close view of it, as in cratedigger. Wheel, vertical drag, arrow keys or Previous/Next dig through it. Motion, ported from cratedigger (MIT, credit kept):
- each sleeve pivots on its bottom edge;
- records before the current one fall forward, the current one stands upright and rises (~0.18 m in spike units), the rest lean back; lean angle π/7, capped by geometry (below);
- everything eases out (cratedigger: records 1 s, camera 0.8 s, Quartic.Out; spike: exponential damping λ≈6 and camera-controls smoothTime 0.35 — either is acceptable if it feels the same);
- the camera follows the current record; the bin sways slightly toward the mouse.
The current record's title, artist and "n of 48" show in the footer and are announced to screen readers.

**Showing a record.** Show (or clicking the standing record) lifts it, turns it to face you, dims the room, and shows artist and title large. **Open album** opens the existing album pop-up with the Bandcamp player; closing it returns to the same record. **Put back** or Esc returns it to the bin.

**My crates.** The header's My crates opens a full-screen 3D crate on the plank floor (walnut bin, plant, warm light) with the same dig and Show. Brass tabs across the top switch crates (Favorites first; opens on the last crate used); Copy share link / Rename / Delete sit under the tabs; Remove appears with Show. Crates over 48 records split into bins ("bin 2 of 3"). Empty crates say how to fill them.

## Sections (every record in exactly one)

Built from Bandcamp's own top-level genre on each record (milestone-2 catalog). Counts are from the 2026-10-19 catalog of 1,215 records:

| Section | Bandcamp genres | Records |
|---|---|---|
| Electronic | electronic, ambient | 297 |
| Soul & Funk | r&b soul, funk, blues | 228 |
| Hip-Hop | hip hop rap | 169 |
| Jazz | jazz | 148 |
| Rock, Pop & Alt | alternative, pop, rock, folk, punk, acoustic | 132 |
| Global Sounds | world, latin, reggae, devotional | 64 |
| Left Field | experimental, soundtrack, classical, kids, **and any genre not listed** | 59 |
| Fresh Crates (milk crates by the door) | records with **no** genre | 118 |

Within a section, records are A–Z by artist and cut into bins of 48 (two compartments of 24); milk crates hold 24. Each bin is labelled by its artist-initial range ("A–E"). Groupings proposed by Claude from the real counts; **approved by Tarik 2026-10-20** (decision 13).

## The room

Layout follows the gpt-image-2 mockup made in the session (not committed: it shows invented posters of real bands): Electronic along the brick back wall under the neon; Soul & Funk and Hip-Hop as the large middle islands; Jazz and Rock/Pop/Alt in front of them; Global Sounds and Left Field in the front row; Fresh Crates by the door; staff-picks wall on the left wall; listening station (turntables, headphone rack) in the back-right corner; counter (register, banker's lamp, a short stack of records) by the door; front door with a lit OPEN sign and a doormat. Exact coordinates: `src/shop/sections.ts` and `Room` in the spike.

Decor (all decorative, not interactive): CC0 Poly Haven materials — `brick_wall_02`, `dark_wooden_planks`, `black_walnut_veneer_01` — and photo-scanned plants `potted_plant_02` (lush) and `potted_plant_04` (small), fetched by `npm run decor` into `public/decor/` (gitignored, like covers); brass wall lamps with warm light; a red Persian-style rug drawn into a canvas texture; white A–Z divider cards every 8 sleeves riding the sleeve tops at their lean; brass plaques with each section's name on its bin fronts. The six tribute posters are committed under `public/posters/` (original art; 640×960 WebP, 832 KB).

## Constraints

- **Stack:** Three.js 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (stable pairing for React 19; not Fiber v10 alpha). Camera via drei `CameraControls`. No physics, no game engine, no Blender pipeline.
- **The 3D code loads only when needed** (lazy import), so the grid and pop-up stay fast.
- **Fallback:** without WebGL the site shows the grid (BUILD-PLAN: "On WebGL failure, show the grid rather than a blank room") and the flat My crates dig (milestone 2) — both already exist.
- **Geometry invariant:** no sleeve may lean through a bin wall or into its neighbour — front record placed so a fallen record rests on the front wall's top edge; each lean capped where it would meet a wall; sleeves 2 cm apart, 1.2 cm thick. Already tested in the spike (`tests/shop/geometry.test.ts`); keep that test.
- **Performance:** records not being dug are one instanced mesh coloured by each cover's dominant colour; real artwork only for the front sleeve of each compartment and for every sleeve in the bin being dug; 300 px covers for sleeves. Idle scenes stop requesting frames (BUILD-PLAN acceptance check) — the spike does **not** yet (it renders continuously).
- **Accessibility:** every 3D action has an HTML control (section pills, bin pills, Previous/Show/Next, Open album, Put back); keyboard: arrows dig, Enter/Space shows, Esc steps back; modifier+arrow (browser Back/Forward) is never captured; reduced motion snaps instead of animating; the current record is announced.
- **URL state:** `/` opens the store (decision 11); `?view=grid` the grid. *(Claude's call)* The section and bin are in the URL too (e.g. `?section=jazz&bin=2`), and stepping into a section or bin adds a history entry so browser Back steps out one level; individual dig steps and Show never add entries. The album pop-up keeps its existing history behaviour on top.
- **Filters and search:** *(Claude's call)* the store always shows the whole collection, sectioned A–Z — it's the shop, not a search result. Typing in the header search, or choosing a genre/crate/country filter, switches to the grid, where those live. (This deliberately overrides BUILD-PLAN's "store and grid show the same order" check.)
- **Room layout:** *(Claude's call)* each section's footprint is computed from its bin count with a reflow rule, so catalog growth (BUILD-PLAN counts up to 1,296) never makes bins collide; the spike's hand-placed rectangles are a starting point, not fixed coordinates.
- **Asset weight (decision 11):** first visit must stay reasonable for a front door — decimate the lush plant (~70k polygons), compress textures (e.g. KTX2 as in bookshelf, or smaller WebP/JPEG), and keep decor loading after the room is usable. *(Claude's call)* Performance bar: smooth (≈60 fps overview, no visible hitching while digging) on a mid-range laptop's integrated graphics and a recent mid-range phone.
- **Decor in CI and deploy:** `public/decor/` is gitignored and fetched by `npm run decor`; tests and builds must not fail if it's absent (fall back to flat colours), and the deploy step must run it.
- **Credits:** cratedigger (MIT, keep its copyright notice where code is ported), bookshelf (MIT), Poly Haven (CC0), metadata sources and "Album art © its owners" on the About page (in progress on `feat/about-page`).
- **Repo rules:** TDD; PR to `main` with green CI (`typecheck`, `test`, `test:probe`, `build`, Playwright); decisions in `docs/decisions/`.

## Non-goals

- Walking through the shop in first person; physics; avatars; multiplayer.
- Making the decor interactive (the listening station, counter and posters are scenery in this milestone; the staff-picks wall is the one exception, decision 12).
- Replacing the album pop-up or the Bandcamp player.
- Search inside the 3D view (search stays in the header and drives the grid).

## Anti-goals

- Anything that "feels weird": a flat diagram camera, a jump from the 3D room into a 2D panel at the moment of digging, records passing through wood, floating label clutter.
- A framed box on a page — the store is the page.
- Real artists' faces, logos or album art used as decoration.
- Loading the whole collection's artwork at once.

## What the spike proved, and what it didn't

Proved (screenshots in the session, headless Chromium/SwiftShader): full-page store, orbit with fading walls, section and bin camera moves, in-bin dig with fall-forward/rise/lean-back, Show/Open album/return, lived-in decor, posters, 3D My crates with return-to-sleeve, no page errors at 1440 and 390 px.

Not proved / known gaps the real build must close:
- **Phone** (required by decision 10): the store overview is cramped and the section pills overflow sideways (scrollable); the shown record is cropped on narrow screens.
- **Idle rendering** (see Constraints).
- **Tests:** none for the scene; three Playwright tests still describe the flat My crates (horizontal swipe, `h3` title, CSS reduced-motion) and fail against the 3D one — rewrite them for vertical drag, the status line and the 3D reduced-motion path.
- **Real GPU performance** (only software rendering was tested); the lush plant model is ~70k polygons.
- **Staff-picks wall** shows every 97th record as a placeholder; replace with Tarik's `staff-picks` crate, clickable, bare when empty (decision 12).
- **Fonts:** in-scene text (neon, plaques, divider cards) uses drei `Text`'s default font, fetched at runtime.
- **Code shape:** `ShopScene.tsx` is one large file; split it by responsibility (room, bins/sleeves, dig, camera, overlays).

## Left to the builder

File structure and module boundaries (including the existing grid-first e2e tests, which must move to `?view=grid` or test the store); whether to keep exponential damping or port cratedigger's tweens literally (feel must match); how to stop idle frames; instancing and texture caching details; exact light intensities and colours (match the spike's screenshots); the phone layout's mechanics, within whatever Tarik decides about the phone experience; test strategy for 3D (pure geometry/selection logic unit-tested; flows in Playwright via the HTML controls and the status line).
