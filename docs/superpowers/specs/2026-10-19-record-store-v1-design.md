# Rhythm Lab Record Store — milestone 2 design (catalog, enrichment, grid, album pop-up, visitor crates)

Date: 2026-10-19 · Status: draft for Tarik's review
Builds on: `docs/BUILD-PLAN.md` (product plan), `docs/IMPORT-COVERAGE.md` (Subsonic probe results), `scripts/subsonic-probe.mts` (working, tested Subsonic client).
Design source of truth: `docs/design/rhythm-lab-record-shop.png` (shop room + header) and `docs/design/rhythm-lab-album-modal.png` (album pop-up). Recreate these; do not re-derive the look from prose.

## Intent and why

A **public** website where people explore Tarik's musical taste through his Bandcamp collection, presented as a warm independent record shop. It is (Tarik's words) a **portfolio project** and a way **for other people to explore his tastes**. Tarik hosts Rhythm Lab (a radio show on Radio Milwaukee) and digs through this collection for show prep; the site turns that private habit into something visitors can browse.

*Claude's guess, not confirmed:* visitors are Rhythm Lab listeners, other DJs/diggers, and people evaluating Tarik's work (including AI-PM hiring managers). They arrive cold, so discovery by genre and curated crate matters more than search.

What makes it special: Tarik's curation and voice (his crates and notes) on top of real Bandcamp artwork and playback, in a room that feels like a shop.

## Decided (by Tarik)

- Front door is **the shop room** (3D, from his mockup). The 3D room itself is **milestone 3**, designed separately; this document is milestone 2, whose interim front door is the grid.
- **Visitors save their own picks** (heart) and **their own crates**, stored **in their browser**, with a **share-a-crate link**. No accounts.
- **Tarik curates his own crates both ways:** editing a list file, and picking while browsing the site.
- **Enrichment is in scope** using **Apple Music API (Tarik has an Apple Developer account), MusicBrainz, and Discogs**, for record label and more.
- **Three.js is used**, in milestone 3 (React Three Fiber + Drei, per BUILD-PLAN).

## Verified facts this design relies on (2026-10-19)

- Subsonic `getAlbumList2` returns all **1,215 records** (1,088 albums `a:<n>` + 127 single-track purchases `t:<n>`, found by the first catalog run) (899 artists, ~4,287 songs) with IDs like `a:3274104668`, artist IDs `b:2239178`, cover IDs `ca:3951378974`. 90% of albums have a Bandcamp top-level genre (`electronic` 295, `r&b soul` 182, `hip hop rap` 169, `jazz` 148, `world` 52, `experimental` 50, `funk` 45, … ; 118 have none).
- **`a:<n>` is the Bandcamp album ID** (verified on 4 records: a full album, a 1-song item "42H" by TTeo `album=2682884431`, the oldest dated purchase "New Love" by Mike Swoop from 2010 `album=2035267472`, and the package "Cuban Beat & Fantasia" `album=3961164446`; Tarik confirmed each embed showed the right record on 2026-10-19. Not recorded: whether the 1-song embed showed one track or a full parent album). First check: `https://bandcamp.com/EmbeddedPlayer/album=3274104668/size=large/` showed Edge Conditions by Jeremiah Chiu, and its title linked to `https://intlanthem.bandcamp.com/album/edge-conditions?from=embed`.
- **`ca:<n>` is the Bandcamp public art ID** (verified on 1 album): `https://f4.bcbits.com/img/a3951378974_10.jpg` showed the Edge Conditions cover.
- No place/country data, no record label, no canonical URL, no wishlist in Subsonic.

## Reference implementation: chrija76/bookshelf

`https://github.com/chrija76/bookshelf` (MIT; live at `bookshelf-aea8f1.netlify.app`) is the site Tarik's idea comes from, and it is architecturally the same thing for books: a local Node pipeline (`npm run data`) writes `public/data/books.json`, covers and KTX2 texture atlases; a static Vite + React + TS + react-three-fiber + drei + zustand site (three r186) reads only those files; Netlify hosts it. Read `README.md` and `PROMPT.md` there before planning. Adopt these patterns (Claude's calls):

- **Every pipeline step cached on disk with a version number**, so reruns redo only what changed; a printed summary per run (sources, fallbacks, counts).
- **Hand-editable curation files never recomputed** (their `categories.json`/`assignments.json`/`overrides.json` ↔ our `crates.json`/`notes.json`/`overrides.json`), and overrides beat every source.
- **Deterministic output** (anything random seeded by record id).
- **Palette extraction per cover** (dominant colour counting the border band double; accents via node-vibrant after decoding to PNG with sharp; log fallbacks, never silent random colours). Milestone 2 stores it in the catalog; milestone 3 uses it for sleeve edges in crates.
- **Working style:** after every visual change, take Playwright screenshots against the dev server and check them before reporting.
- **Milestone 3** may reuse its room, lighting, camera rig and atlas code under the MIT licence, keeping the copyright notice.

Do **not** adopt: its scraping of Goodreads/Amazon pages with a spoofed browser User-Agent (prohibited here), or its `noindex` stance by default — this site is a public portfolio. *(Claude's call: allow indexing; Tarik can flip it.)*

## Goals (milestone 2)

1. **Catalog export:** a local command turns Subsonic data into a **public, credential-free catalog file** the site loads.
2. **Enrichment:** a local command adds label, catalog number, country/artist area, styles, and release date from Apple Music, MusicBrainz, and Discogs, gated by match confidence, with Tarik's overrides winning.
3. **Grid view:** browse all records as covers, with genre chips, Tarik's crates, search, sort (Artist/Title A–Z/Z–A), A–Z jump, pagination — the BUILD-PLAN rules in "Organize by genre and alphabetical order" and "Make 1,296 items easy to browse" apply (use 1,215 / actual counts).
4. **Album pop-up** matching `docs/design/rhythm-lab-album-modal.png`, with Bandcamp's embedded player, and the BUILD-PLAN "Core interaction: an engaging album modal" rules (one iframe at a time, unmount on close, accessible dialog, no autoplay, reduced motion).
5. **Visitor picks and crates** in the browser, with share links and "save this shared crate".
6. **Tarik's crates** from `content/crates.json`, plus a command that imports a shared crate link into that file.

## Non-goals (milestone 2)

- The 3D shop room (milestone 3, its own design; the mockup is its source).
- Accounts, sign-in, any server or database. Wishlist. Private Subsonic playback on the public site (that would redistribute Tarik's purchased files).
- Deploying anywhere. Building runs locally; going live is a separate, explicit decision by Tarik.

## Anti-goals (failure even if it "works")

- A wrong label/country shown confidently on the public site.
- Any credential, token, Subsonic URL, or stream link in the public build or catalog file.
- Looking like a dashboard or admin tool instead of the shop in the mockups.
- Broken or blank players; a pop-up that blocks details when an embed fails.
- Visitor data leaving the visitor's browser.
- Scraping Bandcamp pages or using undocumented endpoints (BUILD-PLAN "Do not make automated profile scraping…").

## Constraints

- Stack per BUILD-PLAN: React + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Zod, Vitest, React Testing Library, Playwright. Node v26 is installed.
- Reuse `scripts/subsonic-probe.mts` client pieces (redaction, allowlist, token auth, throttling) for the export; do not write a second Subsonic client.
- Secrets only in `.env.local` (gitignored): `SUBSONIC_*`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` (the `.p8` lives at `~/.config/rl-record-store/`, mode 600, outside the repo), `DISCOGS_KEY` + `DISCOGS_SECRET` (consumer key/secret), `MUSICBRAINZ_CONTACT`. Agents never print these values. Never in `VITE_*` variables, the catalog file, logs, or git.
- **Covers are self-hosted (Tarik's decision, 2026-10-19).** The catalog step downloads each cover once through the official Subsonic `getCoverArt` (≈1,215 requests, sequential, cached on disk so later runs fetch only new albums — Tarik approved this volume), converts it to WebP at a grid size and a pop-up size, extracts its palette, and writes them under `public/covers/`. Milestone 3 packs them into texture sheets. `https://f4.bcbits.com/img/a<n>_10.jpg` (verified) is the fallback if a Subsonic cover fails. Album art belongs to its owners; the site credits Bandcamp and links every record back to it.
- The only third-party content the site loads is Bandcamp's player (`https://bandcamp.com/EmbeddedPlayer/…`), mounted one at a time. No audio is ever rehosted.
- Curation lives in separate files from source metadata, so a refresh never erases it (BUILD-PLAN "Separate source metadata from personal curation").

## The parts, as decided

### 1. Catalog export (`npm run catalog`)

Reads Subsonic via the existing client (`getAlbumList2` paging; nothing else needed) and writes `public/catalog.json`:

```ts
type PublicAlbum = {
  id: string;            // 'bandcamp:album:<n>' or 'bandcamp:track:<n>' — the cross-adapter key from BUILD-PLAN
  kind: 'album' | 'track'; // Subsonic 'a:<n>' = album; 't:<n>' = a single track bought on its own (127 of 1,215)
  bandcampId: number;    // <n>; the player is EmbeddedPlayer/album=<n> or EmbeddedPlayer/track=<n>
  title: string;
  artist: string;
  artistKey: string;     // Subsonic 'b:<n>'
  genre: string | null;  // Bandcamp genre string as given, e.g. 'r&b soul'; null when absent
  cover: { grid: string; large: string; dominant: string; accent: string } | null; // self-hosted WebP paths + palette; null → typographic placeholder
  songCount: number;
  durationSec: number;
};
type Catalog = { schemaVersion: 1; generatedAt: string; source: 'bandcamp-subsonic'; count: number; albums: PublicAlbum[] };
```

Validated with Zod before writing; written atomically (temp file + rename). Fields not listed (e.g. `created`, `playCount`) are excluded: `created` has unconfirmed meaning. A refresh lists albums that disappeared since the last export and any crate entries that now point at missing albums — it never deletes curation.

### 2. Enrichment (`npm run enrich`, `npm run enrich -- --pilot`)

Reads `public/catalog.json`; writes a cache `data/enrichment-cache.json` (raw per-source results, so reruns don't re-query) and the published result `public/enrichment.json`:

```ts
type Enriched = {
  label?: string; catalogNumber?: string; releaseDate?: string;   // ISO, only at known precision
  artistCountry?: string;   // ISO 3166 code, from MusicBrainz artist area
  artistArea?: string;      // e.g. 'London'
  styles?: string[];        // Discogs styles
  bandcampUrl?: string;     // only if a source supplies a Bandcamp URL (e.g. MusicBrainz url relationship)
  sources: ('apple' | 'musicbrainz' | 'discogs' | 'override')[];
};
// public/enrichment.json: Record<PublicAlbum['id'], Enriched> — only entries that passed the confidence gate or were overridden.
```

- **Matching signal:** normalized artist + title, plus **track count equals `songCount`**, which is a strong disambiguator. Each source match gets a confidence of `high | medium | low`.
- **Gate:** publish a field only when its match is `high` (exact normalized artist+title and matching track count), or when two sources agree on the value. `medium` goes to `data/enrichment-review.md` for Tarik; `low` is discarded.
- **1-song items** (761 of 1,215; may be singles or tracks bought from a longer album): the track-count signal can't be trusted, so a field is published only when two sources agree on it after an exact normalized artist + title match. Otherwise it stays blank. The pilot reports 1-song and multi-song match rates separately. *(Claude's call: blank beats wrong, per the anti-goals.)*
- **Source order:** MusicBrainz and Discogs paths don't wait on Apple; if Apple credentials aren't ready, the pilot runs with two sources and Apple joins later. *(Claude's call.)*
- **Overrides:** `content/overrides.json` (keyed by album id, any `Enriched` field, or `null` to suppress a field) always wins and is never touched by the script.
- **Pilot first:** `--pilot` runs a deterministic 50-album sample (mix of 1-song and multi-song albums) through all three sources and writes `docs/ENRICHMENT-COVERAGE.md` with match rates per source and a hand-check list. The full 1,215 run happens only after Tarik reads the pilot.
- **Sources** (exact endpoints, auth, rate limits, and display/attribution terms to be confirmed from current docs during planning, not from memory):
  - Apple Music API: developer token (JWT signed with Tarik's MusicKit key); catalog album search; fields such as `recordLabel`, `releaseDate`, `upc`, `genreNames`.
  - MusicBrainz: release search + artist area; ≤1 request/second; identifying User-Agent whose contact is `MUSICBRAINZ_CONTACT` from `.env.local` (an address Tarik chose; kept only in .env.local, never in git).
  - Discogs: consumer key/secret sent as `Authorization: Discogs key=…, secret=…`. Official docs (read 2026-10-19) confirm `/database/search` accepts it at the high rate-limit tier with image URLs. Release search for label, catalog number, country, styles; respect its rate limit and attribution.
- **Attribution:** the site footer credits the sources the terms require (e.g. "Data provided by Discogs").

### 3. The site (milestone 2 surfaces)

- **Look:** palette, typography and components from the mockups — cream background, deep green primary buttons and active chips, large serif headlines, small spaced-caps labels, rounded pill chips. Header from `rhythm-lab-record-shop.png`: vinyl logo, "RHYTHM LAB / Tarik's record collection", search field, **"My crates"** button. **No avatar** (no accounts). Store/Grid switch shown; "Store" is disabled with a "coming soon" state until milestone 3. *(Claude's call: one header for both views, the shop mockup's.)*
- **Chip row:** "All records", then Tarik's crates in `content/crates.json` order, then genres. Genres map from Bandcamp strings to labels via a small editable alias file: `jazz`→Jazz, `electronic`→Electronic, `r&b soul`→Soul / R&B, `hip hop rap`→Hip-hop, `world`→Global sounds, `experimental`→Experimental, `funk`→Funk, others → their capitalized names, none → **Unclassified**. Genres with very few records collapse under "More". *(Claude's call.)*
- **Grid:** no mockup exists; design it in the mockups' visual language. Cover, title, artist; count of results; sort; A–Z jump; numbered pages (BUILD-PLAN suggests ~48 per page). Covers load lazily at a small size.
- **Country filter:** shown only once enrichment publishes `artistCountry` for a meaningful share of albums. *(Claude's call: hide a facet that would mostly be empty.)*
- **Album pop-up** (from `rhythm-lab-album-modal.png`): large cover; artist in spaced caps; big serif title; label line if enriched (hidden if not); Bandcamp player iframe `size=large`, tracklist on, colors tuned to the cream/green palette (Bandcamp's player cannot be restyled beyond its URL options — the mockup's custom player is approximated, not reproduced); "In Tarik's crates: …" line listing his crates containing it plus its genre; buttons **Add to crate** (visitor), **heart** (visitor favorite), **Open on Bandcamp** shown only when `bandcampUrl` is known (the embed's own title link always works). Optional "Tarik's note" when one exists.
- **URL state:** filters, sort, page, and open record in the URL per BUILD-PLAN ("Preserve your place when opening a record").

### 4. Visitor picks and crates

- Stored in `localStorage` (wrapped in try/catch; the site works if storage is unavailable), schema-versioned.
- Favorites (heart) and named crates (create, rename, delete, add/remove records). "My crates" opens a panel listing them.
- **Share link:** `…/?shared=<base64url(JSON {name, ids:string[]})>` using record ids in a compact form (`a<n>` / `t<n>`); bare numbers are ambiguous because album and track numbers are separate spaces. Opening it shows the shared crate read-only with **"Save to my crates"**. Incoming data is validated: name length ≤ 60, escaped as text, ≤ 200 ids, ids must exist in the catalog (unknown ids dropped with a notice).

### 5. Tarik's crates

- `content/crates.json`: `[{ id, name, note, records: string[] }]` (catalog ids) in display order; `content/notes.json`: `{ [recordId]: string }` for per-record notes. Both hand-editable, validated with Zod at build.
- `npm run import-crate -- "<share link>" --into <crateId>` merges a shared crate's records into one of Tarik's crates (creating it if new), never removing existing entries, and prints what changed.

## Tests

Vitest for pure logic (catalog mapping/validation, genre aliasing, filter + sort + A–Z + pagination per BUILD-PLAN acceptance checks, share-link encode/decode/validation, crate import merge, enrichment matching/confidence gate); React Testing Library for the pop-up and crate panel; one Playwright flow: filter Jazz → sort Artist A–Z → open a record → player iframe present → add to a new crate → copy share link → open it in a fresh context → save. Enrichment source calls are tested against recorded fixtures, never live in CI.

## Left to the builder

Component structure, state management (React state/context per BUILD-PLAN; Zustand only if needed), exact grid density per breakpoint, cover image size choices (verify which `_<size>` suffixes Bandcamp serves), animation details within BUILD-PLAN's timing guidance, the review-list format, file layout under `src/`.

## Open items (not blocking milestone 2)

- Hosting and domain (BUILD-PLAN suggests Netlify); a GitHub remote; CI (typecheck, tests, build) is required **before** the first public deploy per Tarik's standing rule.
- Bandcamp image/player hotlinking is how Bandcamp's own embeds work, but heavy traffic or a policy change could break it; a self-hosted cover set is the fallback.
- The ≈81-item gap between 1,215 albums and 1,296 collection items, and Curandera, remain unexplained.
- Decision log entries to draft after approval: visitor crates in the browser; public static site with Bandcamp embeds; enrichment confidence gate.
