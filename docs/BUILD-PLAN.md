# Rhythm Lab Record Store — Claude Code build plan

Build a personal record-store experience around your Bandcamp collection: album sleeves in wooden crates, music categories across the top, and a record-detail panel when you select something. Use **React + TypeScript + Vite**, with **Three.js + React Three Fiber + Drei** for the immersive view. Keep a normal cover grid alongside it so the collection is usable on phones, with a keyboard, and when 3D cannot load.

Start with a local, single-owner app. You do not need a checkout, an AI API, a subscription system, or a cloud database to build the first version. “Record store” describes the browsing experience, not a marketplace.

## What to take from the bookshelf example

The reference has a canvas-based scene, a warm wall and wooden floor, category buttons across the top, and a **Spines / Covers** toggle. Selecting a category updates its URL. I could inspect those controls and the environment, but the books themselves did not render reliably in my browser; I did not verify its book-selection behavior or exact rendering libraries. [1]

For your version, translate categories into record crates, books into square sleeves, and the view toggle into **Sleeves / Crates / Grid**. Selecting a record should open accessible HTML details rather than place all the text inside the 3D canvas. That selection behavior is a proposed feature, not something I verified in the reference.

The visual direction should feel like a listening room or an independent record shop: warm lighting, restrained wood textures, large artwork, small printed divider labels, and subtle movement. Avoid a dashboard full of charts. Start with a fixed camera and clickable crates rather than building a first-person game.

Your profile’s description already suggests a good organizing idea: jazz, electronic, hip-hop, and soul, with music that crosses those boundaries. Suggested custom crates are **Staff Picks**, **Jazz & Beyond**, **Electronic**, **Hip-Hop**, **Soul**, and **Global Sounds**. These are editable suggestions, not classifications I verified across your collection. [2]

## What your actual collection changes

On October 19, 2026, the live public `rhythmlab` page displayed **1,296 collection items** and **71 wishlist items**. Its initial page contained only 20 collection cards. These are displayed collection counts, not a verified inventory of every paid purchase or 1,296 distinct albums. An alternate text extraction returned an older count, so the real importer must record a fresh baseline rather than hard-code this number. [2]

The inspected public metadata includes **tracks, albums, and package entries**. For example, Curandera is a track, Edge Conditions is an album, and the Cuban Beat & Fantasia entry is a package associated with an album. Several visible tracks link to the same album from their rendered cards. Preserve their individual source identities; do not merge them merely because they share an album URL. [2]

Wishlist items must stay separate from owned collection entries. Do not claim a digital purchase is vinyl. Show physical format only when reliable source metadata or your own edits support it. Public data also cannot establish whether private, hidden, removed, or other-account purchases are missing.

## Resolve Bandcamp access before building the full app

**The preferred first test is Bandcamp’s official Subsonic API beta.** Bandcamp announced it on July 16, 2026. In Bandcamp’s Fan Settings, you can generate Subsonic credentials and use `https://bandcamp.com/api/subsonic` as the server. The announcement says supported clients can stream/download a collection and create or edit playlists that also appear in Bandcamp. It warns that large collections can be slow. [3]

This is promising, but it is not proof that every Subsonic endpoint works for a custom browser app. The announcement names Amperfy, Feishin, and Submariner as supported clients; it says other clients may work. We have not tested your authenticated collection, artwork coverage, canonical Bandcamp links, wishlist coverage, physical purchases, or custom web playback. [3]

### First milestone: a small local feasibility test

Have Claude Code implement a minimal local Node/TypeScript adapter, not the whole site. You generate the dedicated credentials yourself in Fan Settings and keep them in a local ignored environment file. Do not use your main Bandcamp password or export browser cookies.

The test should answer:

1. Can the official service authenticate and enumerate your music library, including all result pages?
2. Which stable item IDs, titles, artists, artwork references, and track/album relationships does it return?
3. Are canonical Bandcamp URLs available, and what is absent?
4. Does it include individual track purchases, hidden music, or package-associated music? Does it omit wishlist and merchandise?
5. Can one selected item play through the intended private architecture, without leaking credentials?

Use read-only operations first. Do not create playlists, download the whole library, or assume undocumented endpoint support. Compare the returned inventory with your account and the public baseline, while recognizing that song counts and collection-item counts are different units.

**Pass condition:** enough official metadata and artwork access to build a useful catalog, with an explicit coverage report. If streaming is awkward but metadata works, export a sanitized catalog and use link-out playback for version one. If enumeration is unsuitable, use file imports instead.

### File-import fallback

Accept your own JSON/CSV catalog and metadata/artwork from music files you have already downloaded. Local music-file tags are useful, but may not identify the originating Bandcamp purchase or include every item you own. Keep source URLs optional and support manual corrections.

I did not find a documented fan CSV/JSON collection-export feature. Do not instruct Claude to rely on a nonexistent “Export collection” button. Bandcamp’s published OAuth developer APIs are described for labels and merchandise fulfillment partners, not a general fan-collection OAuth integration. That is distinct from the new Subsonic beta. [4]

Do **not** make automated profile scraping, undocumented fan endpoints, browser-session tokens, or bulk artist-page crawling the sync strategy. Bandcamp’s current acceptable-use policy explicitly prohibits scraping text, media, and other site content through automated means. Running a scraper locally does not remove that issue. Use the official service, your own files, or a separately authorized source. [5]

## Recommended tech stack

### App and styling

Use **React with TypeScript** for the interface and typed data model. Use **Vite** for development and static builds. Its official starter includes a `react-ts` template. Install a currently supported Node.js LTS version that satisfies the tooling’s requirements. [6]

Use **Tailwind CSS** for layout and interface styling, plus a small custom CSS file for the record-shop treatment. The current Tailwind setup uses the `@tailwindcss/vite` plugin and `@import "tailwindcss"`; avoid copying older v3 initialization commands. Preserve the React plugin in Vite’s configuration. [7]

### Immersive record browsing

Use **Three.js**, **`@react-three/fiber`**, and **`@react-three/drei`**. Fiber lets you express a Three.js scene using React components; Drei supplies useful camera, controls, loading, and performance helpers. For the currently documented stable pairing, Fiber v9 goes with React 19. Keep compatible stable versions together and do not choose Fiber v10 alpha for this project by default. [8] [9]

Build sleeves from simple geometry and artwork textures. No Blender models, physics engine, or game framework are needed initially. Let the HTML interface control the selected crate, filters, and record. Add Zustand only if coordinating that state becomes cumbersome; React state/context is enough to start.

### Data, import, and storage

Use **Zod** to validate imported records. Keep an explicit normalized catalog format independent of Bandcamp’s response shape. Use **Node.js + TypeScript** for the official API adapter. Add `music-metadata` only if you implement local audio-file metadata import.

For the first browsing prototype, load a JSON catalog and keep personal crate edits/preferences in browser storage, with an **Export backup** action. If the catalog is imported into the browser, IndexedDB is a reasonable home for it. Browser storage is not a backup and does not synchronize between devices.

For a larger local importer, SQLite is a sensible later addition for durable import checkpoints and cached metadata. **Supabase/Postgres is not necessary now**; consider it only when authenticated cross-device editing becomes a real requirement.

### Tests and hosting

Use **Vitest** for import, deduplication, filtering, and merge logic; use **React Testing Library** for HTML controls and **Playwright** for browser flows. Test the 3D interactions in a real browser, not only component tests.

A sanitized, shareable catalog can be a static Vite deployment on Netlify. A static build cannot safely hold private Bandcamp credentials. Private connected playback needs an authenticated server-side adapter; public browsing should use a separate, deliberately selected export. Do not publish downloaded audio files.

## A simple architecture

```text
Official Bandcamp Subsonic service     Your JSON/CSV/local music metadata
                  \                  /
                   Local import adapter
                            |
               Validation + normalized catalog
                            |
          Catalog JSON / browser database / later SQLite
                            |
                  React application state
                   /          |          \
             3D crates    Cover grid    HTML record details
                                           |
                              Bandcamp link / optional embed
```

The frontend should remain usable without a live Bandcamp request. An import refresh should update source metadata while preserving your own notes and crate assignments.

Separate **source metadata** from **personal curation**. Otherwise, the next refresh can erase the very things that make this your record store.

A proposed record shape—not a claim about the official API’s returned fields—is:

```ts
type CatalogItem = {
  id: string; // Stable source + item type + ID, when supplied.
  source: 'bandcamp-subsonic' | 'bandcamp-csv' | 'bandcamp-html' | 'local-file' | 'manual';
  sourceId?: string;
  kind: 'album' | 'track' | 'package' | 'unknown';
  title: string;
  artist: string;
  bandcampUrl?: string;
  artworkRef?: string;
  embedSrc?: string; // Validated Bandcamp EmbeddedPlayer URL, not raw HTML.
  parentAlbumId?: string;
  membership: 'collection' | 'wishlist' | 'unknown';
  releaseDate?: string;
  sourceGenreTags?: string[]; // Only tags provided by an approved source.
};

type Curation = {
  itemId: string;
  crateIds: string[];
  genreIdsOverride?: string[]; // Undefined uses source mapping; [] clears genres.
  favorite: boolean;
  notes?: string;
};
```

Do not invent purchase dates, genre tags, labels, or ownership flags when the source does not provide them. Local-file entries can remain unmatched until you confirm a match. An “album-grouped” display can be added later without deleting underlying track entries.

## Organize by genre and alphabetical order

**Genre browsing and alphabetical sorting are first-version requirements.** Open a genre, browse its records alphabetically, and click any sleeve to open its album-player modal. The store and grid must use identical filtering and ordering rules.

### Genres are different from personal crates

Create a genre navigation row or selector with **All genres**, **Jazz**, **Electronic**, **Hip-hop**, **Soul / R&B**, **Funk**, **Global / International**, **Experimental**, and **Unclassified** as an editable starting taxonomy. These are proposed browsing labels, not verified classifications of your purchases. Refine them to fit the actual imported music.

Keep **Staff picks**, favorites, and personal crates in a separate curation control. A record can belong to several genres and several personal crates without duplicating its underlying catalog entry. In the store view, a selected genre can appear as a labeled wooden bin with alphabetical divider tabs.

Use genre metadata only if the approved API or your own files supply it. The API feasibility report must state whether usable genres/tags are available; do not assume the Subsonic beta exposes them. Preserve original source tags and map them to stable genre IDs using an editable alias configuration. A city, mood, or label should not automatically become a genre.

If metadata is missing, use **Unclassified**. Add a genre editor to the album modal and a multi-select/bulk edit action in the grid. Manual genre overrides must survive refreshes and backup/restore. An undefined override uses the source mapping; an explicitly empty override leaves the item unclassified. Do not silently guess genres or crawl artist pages to fill gaps.

### Alphabetical browsing and sorting

Add a **Sort by** dropdown with **Artist A–Z**, **Artist Z–A**, **Title A–Z**, and **Title Z–A**. Default to **Artist A–Z**, with title as the secondary key. For title sorting, use artist as the secondary key. Use stable item ID as the final tie-breaker so page order does not change unexpectedly.

Add a compact **A–Z / #** jump strip or letter selector for the active alphabetical field. Artist sorting jumps by artist; title sorting jumps by title. `#` covers leading numbers or symbols. Disable letters with no matching records and make the control horizontally scrollable or collapsible on phones. Letter navigation must reach matching records beyond the currently rendered page.

Use a locale-aware comparator such as `Intl.Collator` with case-insensitive comparison and numeric ordering. Preserve original capitalization, accents, and names for display. Sort literal display names by default; ignoring leading articles such as “The” can be a separate explicit option later. Do not reorder personal names as last-name-first automatically.

Apply collection/wishlist selection, genre, crate, and search filters **before** sorting and pagination. Genre and crate filters should combine. Display the resulting item count and an empty state with a reset action. A multi-genre record counts once in the active result set, although it may appear under several genre categories.

Keep genre and sort choices when switching store/grid or closing the modal. Save preferences locally and encode shareable filters in the URL where practical.

**Acceptance checks:** All genres and Unclassified work; multi-genre items are not duplicated in a result set; artist/title A–Z and Z–A are correct; case, accented names, numeric names, and equal titles behave predictably; letter navigation works across pages; filters combine; store/grid show the same order; and manual genre edits survive re-import and backup/restore.

## Make 1,296 items easy to browse

**Use the store for discovery and the collection grid for efficient finding.** The room is a visual presentation of a filtered catalog, not a physical obstacle course. Users should never have to drag a camera around a huge shop or flip through hundreds of sleeves to reach a known artist.

### Keep the working controls outside the room

Keep search prominent in the HTML header, followed by a genre selector, a **Sort by** control, an A–Z jump control, and **Store / Collection** mode buttons. The Collection mode is the efficient cover grid, with an optional compact list later. Keep the same filters and ordering in both modes; the grid is not a separate inventory.

The desktop collection layout can use a narrow filter sidebar and a wide result grid. On phones, use a **Filters** button with an active-filter count and a sheet containing labeled controls. Keep search, sort, and result count visible without opening the sheet. Use removable active-filter chips and **Clear filters**.

Use genre as the primary facet, with **Albums / Tracks / Packages** as a second reliable facet. Keep wishlist separate. Add artist/year filters only when the data supports them; do not show acquisition-date sorting if all you have is import time. Clear, relevant filter labels matter more than having a large number of categories. [19]

Multi-selected genres use **OR**: Jazz or Soul. Different filter types use **AND**: Jazz or Soul, and Albums, and a matching search term. Recompute contextual genre counts from the query and other facets; count unique item IDs rather than counting tag assignments. Expose Unclassified and make narrowing reversible.

### Bound the sleeves you actually render

The Store can open with three inviting crates, then expand one selected genre or curated crate into a focused browsing view. Give each focused crate visible Previous/Next controls, a page/location indicator, and the same A–Z jumps as the grid. Do not bury navigation in gestures or make only the frontmost sleeve reachable. Provide keyboard-operable HTML record buttons/list entries linked to scene selection.

Start with approximately **24 visible sleeves per focused store page** and **48 cards per grid page**, then test readability and performance with your actual devices. These are proposed starting values, not universal best-practice numbers. Larger artwork on phones may need a smaller page. Render only the active scene page plus a modest adjacent-artwork cache.

Use numbered pagination for the full Collection, with Previous/Next and a result-range indicator. A–Z navigation should find the first matching item in the entire sorted filtered result set, load its page, and focus its card. It should not merely search the current page. Preserve a visible location and avoid automatic infinite scroll as the only route through the inventory. Pagination or explicit Load more provides useful landmarks; endless scroll is better suited to deliberate open-ended discovery. [20]

All-genre browsing should remain available even when genre metadata is incomplete. Search by artist/title works regardless of genre. At this catalog size, start with an in-memory normalized search index and deterministic sorting; do not require Elasticsearch, a cloud search service, or an AI classifier. Add fuzzy matching only if real use shows a need, and prefer exact/prefix matches over weaker suggestions.

### Preserve your place when opening a record

Store query, genres, type, crate, sort, page/location, mode, and selected record in one shared state model. Opening the album modal should preserve the originating item anchor and scroll position. Closing returns to that record, not to the top of the shop. Switching Store/Collection preserves the active item where possible, rather than resetting to page one.

Put recoverable state in URL parameters where practical, for example `?view=store&genre=jazz&sort=artist-asc&page=2`. A selected-record URL can add `record=<stable-id>`. Browser Back should close a modal opened from the collection before leaving the filtered collection. If the user arrived directly at a record URL, closing it should navigate to a sensible parent collection rather than unexpectedly leaving the app.

Use native HTML controls, clear focus indicators, and text labels for artists/titles. Announce updated result counts without moving focus on every keystroke. A native modal dialog can support focus management and an inert background; still test the third-party iframe and restore focus to the originating record or an appropriate HTML scene control. [21]

**Example flow:** choose Jazz → choose Artist A–Z → jump to J → select a sleeve → listen in the modal → close → continue at the same sleeve. If you already know the record, type its artist/title into search and open it directly. Neither flow requires exploring the whole 3D room.

## Parse CSV and HTML into one normalized catalog

Treat CSV, saved HTML, and the official API as **separate input adapters with one shared output schema**. The frontend must never depend on a particular export’s column names or Bandcamp’s HTML selectors.

No standard fan CSV/HTML export schema has been confirmed. A label sales CSV is not automatically a fan collection export. Accept the actual file you supply, inspect a representative sample, and build a named, versioned mapping for that format. Use only files and content you are authorized to process. Offline parsing is not a recommendation to collect the files through prohibited scraping. [4] [5]

### Import flow visible to the user

Use **Choose file → Map fields if needed → Preview and resolve warnings → Confirm import**. Parse locally by default; no upload is necessary for this personal catalog. Give the user a cancel action and keep the existing catalog unchanged until confirmation.

The preview should show source format, records found, collection versus wishlist membership, coverage status, duplicates/conflicts, and missing artwork, genre, URL, or embed information. Include a handful of representative records and an actionable row-level error report. Counts for “found,” “valid,” “new,” and “updated” must mean different things; do not call them all “albums.”

For instance, an HTML snapshot containing 20 collection records and a reported collection total of 1,296 should say **“20 records found; the source reports 1,296 collection items. This file is incomplete.”** The saved profile HTML inspected during planning had exactly this limitation. Importing those 20 as a partial batch is acceptable; marking the collection complete or deleting the other records is not. [2]

### CSV adapter: Papa Parse, not string splitting

Use **Papa Parse** with a local File or decoded string. It handles quoted commas, multiline cells, delimiter detection, and parse errors. Start with `header: true`, `dynamicTyping: false`, and `skipEmptyLines: 'greedy'`. Keep IDs and title-like numeric strings as strings; explicitly convert only validated typed fields afterward. Worker/chunk parsing can keep the interface responsive if files grow. [16]

Normalize header names for matching while retaining the originals for the mapping screen. Suggested aliases include `album`, `release`, or `title` → title; `artist` or `band_name` → artist; `url` or `item_url` → canonical source URL; and `genres` or `tags` → source tags. Ambiguous columns require confirmation, not an invisible guess.

Support UTF-8/BOM and common delimiter variants. Offer an encoding choice if characters look wrong. Surface duplicate headers, malformed quoting, and row-length mismatches. Do not discard rows silently.

Define the separator for multiple genres explicitly, such as semicolon, because a comma may belong to the CSV syntax or a label. Keep membership as `unknown` unless the format or a user-confirmed mapping establishes collection/wishlist membership. Artist and title are the minimum for a display-ready record; quarantine incomplete rows for correction without rejecting every valid row in the file.

### HTML adapter: extract data, never run the page

Use **parse5** as a text-to-syntax-tree parser in a local Node importer or an appropriately bundled browser worker. Do not open imported HTML in an iframe, execute its scripts, insert its nodes into the live app, or follow its links. parse5 is an HTML parsing toolset, not a browser. Native DOMParser is not an absolute no-network guarantee: MDN notes that parsed documents can load image/iframe resources and that inserted content can introduce XSS. [17] [18]

For a compatible saved Bandcamp snapshot, prefer structured data already present in the file. The inspected snapshot had a `#pagedata` element with a `data-blob` JSON attribute. An HTML parser decodes attribute entities; feed the resulting attribute value to `JSON.parse` and validate it. Do not double-decode JSON strings or use `eval`/`new Function` to execute a JavaScript assignment. A future layout without a recognized data shape should produce **Unsupported format**, not a guessed import.

Use the selected `item_cache.collection` or `item_cache.wishlist` namespace and its matching sequence when available. Do not import every cache entry: the page also contains gifts-given and social data. A fallback adapter can extract supported record-card text and links from the supplied file, but it must flag missing identity information and uncertain parent-album links.

Map observed fields explicitly:

- `item_id` plus `item_type` provide the source item identity. Preserve album, track, and package distinctions.
- `item_title` maps to title; `band_name` maps to artist; `item_url` maps to the record’s Bandcamp URL when valid.
- `tralbum_id` and `tralbum_type` identify an associated playable album or track. They are **not** interchangeable with a package ID or a Subsonic ID.
- `album_id`, when present and verified, can support a parent-album relationship.
- `item_art_id` is an artwork identifier, not an image file or a verified embed ID. Preserve it separately; an approved source or supplied asset must resolve artwork access.

Compare extracted sequence length, unique records, and any reported total. Do not use an anonymous page’s hidden-item count as proof that no hidden purchases exist. The parser cannot recover records that are not in the supplied file; do not add a network fetch or “load more” scraper behind the scenes.

### Normalization, identity, and validation

Use Zod to validate the normalized output and version the catalog, for example `schemaVersion: 1`. Extend the earlier model with import provenance: adapter/version, batch ID, source row or item pointer, and import timestamp. Track batch coverage separately as `complete`, `partial`, or `unknown`, with evidence supporting any completeness claim. “Complete” applies to a stated input scope, not automatically to all lifetime purchases.

For known Bandcamp item identities, use a cross-adapter source key such as **`bandcamp:track:1122227494`**. Importing the same item from CSV and HTML should match that key rather than create duplicates because file formats differ. Keep adapter provenance separate from the underlying provider identity. Maintain aliases if an official API uses a different identity namespace; never assume numeric IDs match across services.

If IDs are missing, a normalized exact track/album URL can be a candidate identity only when item type and record context make it unambiguous. A parent album URL shared by multiple tracks is not sufficient. Otherwise allocate a stable local ID, flag candidate matches using artist/title/type, and ask the user to resolve ambiguous collisions. Text similarity is a review aid, not permission to merge distinct purchases. Persist approved mappings for future imports.

Trim incidental whitespace and normalize Unicode without changing displayed names or stripping accents. Preserve raw source genre tags. Store dates only when their format and precision are known. Validate URLs with `URL`, require permitted schemes, reject embedded credentials, and allowlist Bandcamp player host/path for embeds. Never interpret titles or notes as HTML.

Imports will often lack genre, artwork, and embed information. Leave those fields missing and use the planned fallbacks. Genre comes from confirmed source tags or manual edits; embeds come from verified music identity or the user’s provider-generated embed URL. A file of titles and URLs alone cannot guarantee a correct playable embed for every row.

### Commit safely and preserve your work

Stage parsed data, normalize, validate, and show a merge preview before changing the catalog. Use a database transaction where supported, or an atomic replacement/version pointer for file-based catalogs. The outcome should be either the accepted batch or no batch, not half an import.

Re-imports should be idempotent: same confirmed source identity updates the same item. Merge only fields actually supplied by the new batch, distinguishing missing values from an intentional clear. Preserve favorites, notes, personal crate assignments, genre overrides, and manually corrected embed mappings. Conflicts should be visible; missing entries in a partial batch should never trigger deletion.

Allowlist only the catalog fields needed for browsing. Exclude email addresses, session tokens, gift recipient messages, download/redownload URLs, and payment details. Do not retain raw HTML indefinitely by default or place it in the public repository. If CSV backups are offered, enable formula-injection protection when writing CSV; Papa Parse documents `escapeFormulae` for export. [16]

### Claude Code implementation boundaries

Implement shared types and pure functions first. A practical directory layout is `src/import/adapters/csv.ts`, `src/import/adapters/bandcamp-html.ts`, `src/import/normalize.ts`, `src/import/schema.ts`, and `src/import/merge.ts`, with `ImportWizard.tsx` for the UI. A local script can call the same core logic; do not create a second incompatible catalog format for Node.

Build fixtures from sanitized, authorized sample files. Tests should cover quoted/multiline CSV, encoding, duplicate headers, malformed rows, HTML entities, unsupported HTML, dangerous URLs, partial snapshots, collection/wishlist separation, track versus package identities, repeated imports, ambiguous matches, and preservation of curation. Add a no-network/no-script-execution test for the HTML adapter.

Before locking down selectors and column mappings, obtain **one representative CSV or saved HTML file** from the actual export tool or workflow you intend to use. We can specify the pipeline now; exact format compatibility needs that sample.

## Core interaction: an engaging album modal

**Click or tap a sleeve → open a polished album modal → listen through that album’s Bandcamp embed.** This is a first-version requirement, not an optional finishing touch. Both the 3D store and the cover grid should open the same modal component.

On desktop, use a spacious two-column layout: large cover artwork on the left, with artist, album title, the official player, and record actions on the right. Use a softly dimmed backdrop, restrained blur, warm borders, and a short fade/scale entrance. The sleeve can lift slightly before the modal appears, but do not delay access to the player for a long animation. Keep the treatment consistent with the record shop rather than looking like a generic admin dialog.

On phones, use a full-height or near-full-height dialog with artwork above the player. Keep the close button visible and the content scrollable. Respect reduced-motion preferences. A warm static accent is enough initially; artwork-derived colors can be added later without making them a dependency.

The modal should contain the artwork, artist/title, available release details, the embedded player with a tracklist where supported by the chosen embed, and an **Open on Bandcamp** action. Favorites and **Add to crate** can arrive with the curation milestone. Show only metadata you actually have.

### Getting the correct player for each album

Bandcamp’s Share / Embed workflow supplies the iframe player. Store its validated `src` URL as `embedSrc`; do not inject user-supplied embed HTML directly into the page. Accept only HTTPS URLs on the exact Bandcamp player host with an expected `/EmbeddedPlayer/` path. Give each iframe an informative title. [10]

Do not assume a Subsonic album ID is also a Bandcamp embed ID. Add a small mapping test to the import feasibility milestone: verify that a sample of actual records resolves to the correct player. If the approved source supplies the necessary Bandcamp identity, implement and test a shared URL builder. Otherwise support pasting a provider-generated embed URL or recording it manually. Do not obtain missing IDs through scraping.

An individual purchased track can use its verified track embed or a clearly labeled parent-album embed when that association is known. A package entry can use its associated album player when verified; do not feed a merchandise ID into the music player. Missing, removed, or unavailable embeds should leave an attractive record-details modal with **Open on Bandcamp**, not a broken empty frame. The goal is an embed for every available album, with explicit exceptions rather than fabricated mappings.

### Loading, playback, and accessibility

Mount **only the selected album’s iframe**, when its modal opens. Never preload a player for every collection entry. Reserve space for the player so loading does not shift the layout, show a loading message, and provide a link fallback for blocked embeds. Avoid claiming an iframe `load` event proves its internal player is playable.

No autoplay by default. Closing the modal or switching records should unmount the previous iframe so its playback does not continue behind the store. For version one, playback lives in the modal; a persistent listening bar is a separate feature. Do not promise custom seek controls, a cross-album queue, or synchronized playback state unless Bandcamp exposes and you verify an appropriate player-control API.

Use an accessible HTML dialog, such as native `<dialog>` with `showModal()`, or a proven dialog primitive if the implementation needs it. Include a visible close button, a named dialog, background interaction blocking, managed focus, and focus restoration to the originating sleeve/card. For canvas selections, restore focus to an appropriate HTML store control. Test keyboard navigation and Escape behavior, including when focus enters the third-party player.

**Acceptance checks:** the clicked album matches the displayed artwork and player; grid and store behave identically; only one player iframe exists at a time; closing/switching ends the old player; mobile scrolling and closing work; keyboard users can enter and leave the modal; reduced motion works; and a missing embed never blocks access to the record’s details.

## Record animation: tactile, subtle, and fast

**Recommendation: use small lift, tilt, and slide movements—not spinning records, elaborate fly-throughs, or a first-person shop.** Animation should help identify the selected record and connect it to the listening modal. It should never be required to find music or delay access to playback.

### What each interaction looks like

Each record is a thin 3D sleeve with album artwork as its front texture. Use simple plane/box geometry, not an individually modeled object or a video. Sleeves sit slightly staggered inside the crate so their edges suggest a real collection; the focused sleeve sits forward enough to read its cover.

On desktop hover, lift the sleeve slightly and tilt it toward the viewer. Show its artist/title and **Open album** hint in an HTML overlay. On pointer exit, ease back to the resting pose. Keyboard focus on the corresponding HTML record control should offer the same preview; preview alone must not open a player.

On click or keyboard activation, move the sleeve a little forward while the background dims and the HTML album modal fades/scales into view. Open the modal promptly and load its selected embed; do not wait for a long “pull the record out” sequence. A simple coordinated transition is enough—do not make a complex shared-element morph from WebGL to HTML a first-version dependency.

On modal close, stop/unmount the player immediately, even if a short visual exit animation remains. Fade out the dialog and settle the sleeve back to its resting or focused pose. Restore the user's record anchor and keyboard focus without resetting filters or the crate page.

Previous/Next browsing changes the focused record with a restrained slide or pose adjustment among the visible sleeves. Genre/page changes use a short fade or small shift between the old and new visible set; they do not send hundreds of records flying through the room. Keep the camera fixed or tightly constrained.

Use roughly **150–220 ms** for hover/focus motion and **180–260 ms** for modal or page transitions as initial tuning values, not universal requirements. Keep overshoot minimal and avoid bouncing. Tune sleeve displacement relative to sleeve size so movement stays modest on every viewport. Content should remain usable as soon as it is available, not only when an animation finishes.

### Mobile and reduced motion

Touch has no hover requirement: one tap opens the record modal directly. Use visible Previous/Next controls rather than depending on a swipe gesture; add gestures only if they do not interfere with scrolling or taps. Never require a first tap to “hover” and a second to open.

Honor `prefers-reduced-motion` in both CSS and the 3D interaction layer. Disable sleeve travel, rotation, spring effects, and camera motion; apply the final pose directly and use no transition or a brief opacity change. Preserve clear selection, focus, and all browsing actions. The grid fallback remains fully functional without 3D or animations.

### How Claude Code should implement it

Use React Three Fiber for rendering and pointer selection. Store discrete interaction state in React—focused item, selected item, active page, and whether the modal is open. Use mesh refs and frame updates to interpolate sleeve transforms; do not call React state setters for every animation frame.

Define deterministic resting, preview, and selected target poses, with selected taking precedence over preview. Use time-based damping/easing so motion behaves consistently at different frame rates. Start with this small animation helper rather than adding a physics engine or another animation dependency. Use CSS transform/opacity transitions for the HTML modal; the iframe and readable text stay outside the canvas.

If using Fiber's on-demand frame loop, request frames when an interaction starts and while a pose is still moving. Stop requesting frames once transforms settle within a small tolerance. Merely setting demand mode is not enough: the animation must invalidate frames until it finishes. Avoid decorative perpetual motion that keeps the renderer active while idle.

Animate only the active page's visible sleeves. Reuse geometry and appropriate shared materials, cache artwork deliberately, and release unused resources without disposing a texture still used by another record. Keep stable item keys and prevent an obsolete animation callback from overriding a newer selection. Rapid pointer changes, modal closing, and page changes must resolve to the latest intended state.

Use real HTML buttons or links for keyboard access and selection, with suitable focus indicators. Keep their identities synchronized with scene meshes. Handle overlapping sleeve pointer events so activating one does not also activate a sleeve behind it. Do not intercept record-browsing arrow keys while focus is inside search, another input, the modal, or its player.

A practical split is `src/scene/RecordSleeve.tsx`, `src/scene/RecordCrate.tsx`, a small `src/scene/useSleeveMotion.ts` helper, and `src/components/AlbumModal.tsx`. Keep the shared catalog/filter logic independent of all animation code.

**Acceptance checks:** hover/focus previews the correct sleeve; a single click/tap opens the correct modal; closing stops its player immediately; rapid selection never produces the wrong record; page/genre changes preserve ordering; mobile navigation works without hover; reduced motion suppresses spatial movement; and an idle scene stops requesting frames when no animation or other work requires them.

## Build in this order

### 1. Prove the data connection

Run the official API feasibility test and produce a small sanitized sample plus a coverage report. If using CSV/HTML, inspect an authorized representative file and implement that adapter through validation and a dry-run merge preview before relying on its catalog. Test partial-file detection. Keep a manual fixture so frontend work is not blocked by the beta or an unavailable export.

### 2. Build one useful vertical slice

Create an attractive cover grid with about 20 sample items. Selecting a cover opens the engaging album modal specified above, with artwork, artist, title, item type, a verified Bandcamp embed where available, and an **Open on Bandcamp** link. Add search, genre filtering with an Unclassified fallback, artist/title alphabetical sorting, and A–Z navigation. Include a basic manual genre editor now; bulk editing can follow when scaling the grid. Add loading/error states and missing-artwork/embed fallbacks. Test several real, correctly mapped players before expanding the catalog.

Finish when this works on mobile and with a keyboard. This is a functional foundation, not the final visual experience.

### 3. Add the record-shop scene

Build one wooden crate with roughly 24 visible sleeves initially, a fixed or tightly constrained camera, and the lift/tilt/slide interactions specified in **Record animation: tactile, subtle, and fast**. Add genre bins, alphabetical divider tabs, separate personal-crate navigation, and a **Store / Collection** switch. Both views must use the same catalog, filters, sort order, and selected-item state. Validate hover, keyboard focus, single-tap opening, interruption handling, and idle-frame behavior before adding more decorative motion.

Keep controls and details in HTML. On WebGL failure, show the grid rather than a blank room. Respect reduced-motion preferences.

### 4. Scale to the whole imported catalog

Make every imported item searchable, but do not create full-size artwork textures for all 1,296 entries at once. Render the active crate/page, load artwork on demand, release unused GPU resources, and keep image sizes modest. Use a paginated grid initially; add virtualization only if measurement warrants it.

Show import progress, missing-field warnings, and the last successful refresh. Re-importing the same source must not create duplicates or erase curation. Do not silently delete an item simply because a partial refresh did not return it.

### 5. Add curation and optional advanced listening

Add custom crates, favorites, notes, and backup import/export. Album-modal embeds already belong in milestone 2; save advanced listening until the catalog and scene work well.

Treat the modal’s iframe as Bandcamp’s embedded playback experience, not guaranteed authenticated full-purchase playback. A Bandcamp link remains the fallback when an embed is unavailable. [10]

Private Subsonic playback can follow if the feasibility test succeeds. Keep credentials and credential-bearing stream URLs out of public exports. Remote artwork access, caching, and public redistribution need appropriate rights; buying music is not blanket permission to rehost it.

## Set up Claude Code project context

Use the exact uppercase filenames **`CLAUDE.md`** and **`AGENTS.md`**. Keep project instructions short and durable. Put the detailed product plan in `docs/BUILD-PLAN.md` instead of loading the entire plan into every conversation. Claude Code’s official guidance covers root context, imports, and modular rules. [11] [12]

A practical layout is:

```text
rhythm-lab-record-store/
  CLAUDE.md
  AGENTS.md
  .claude/
    rules/
      data-and-security.md
      frontend.md
    agents/
      record-store-reviewer.md  # Optional, later.
  docs/
    BUILD-PLAN.md
    IMPORT-COVERAGE.md
  src/
    catalog/
    components/
    scene/
    storage/
  scripts/
  public/
    demo/                      # Sanitized data only.
```

### Create `CLAUDE.md`

After scaffolding, `/init` can generate a starting file. Edit it to match the actual project. Use this example:

```md
@AGENTS.md

# Rhythm Lab Record Store

Personal Bandcamp collection browser, not an ecommerce store.
Stack: React, TypeScript, Vite, Tailwind; Fiber/Drei for the 3D view.
Detailed scope: docs/BUILD-PLAN.md.

## Architecture
- Grid and 3D scene use the same normalized catalog and selection state.
- Keep imported metadata separate from personal curation.
- All essential actions must work outside the canvas.
- Sleeve clicks open one shared accessible album modal with its verified embed.
- Mount only the selected player; unmount it on close or record switch.
- Keep sleeve motion subtle; respect reduced motion and stop rendering when idle.
- Do not use animation to delay modal access or require touch hover.

## Workflow
- Plan nontrivial changes before editing; deliver one milestone at a time.
- Inspect package.json before running or proposing project commands.
- Implement tests for identity, import, and refresh behavior.
- Report checks actually run; never invent passing results.
- Do not deploy or publish private data without my approval.

## Boundaries
- Use the official Subsonic service or my supplied files; no scraping.
- Never put credentials in VITE_* variables, public assets, logs, or git.
- Do not assume wishlist entries are owned, or digital items are vinyl.
```

Once defined in `package.json`, add the actual development, test, lint, typecheck, and build commands. Do not document scripts that do not exist.

### Create `AGENTS.md`

This is a shared **role and handoff guide**, not a mechanism that creates Claude subagents. Include it explicitly with `@AGENTS.md` in `CLAUDE.md` so loading does not depend on version-specific discovery behavior. [11]

```md
# Working roles

## Planner
Inspect first. Define the user-visible outcome, data flow,
files to change, risks, and acceptance checks. Do not implement yet.

## Implementer
Follow the accepted milestone. Preserve item identity and curation.
Keep changes focused and validate the affected behavior.

## Reviewer
Check data loss, credential exposure, accessibility, and regressions.
State actionable findings and distinguish executed checks from suggestions.
```

### Organize multiple rules

Use one topic per Markdown file under `.claude/rules/`. Unscoped rules load broadly; use path-scoped rules for instructions relevant only to a part of the app. Avoid repeating the same instruction across many files. [11]

For example, `.claude/rules/frontend.md`:

```md
---
paths:
  - "src/**/*.tsx"
  - "src/scene/**/*.ts"
---

- Keep search, filters, and record details accessible as HTML controls.
- Provide a grid fallback if WebGL or artwork loading fails.
- Limit active scene textures; do not eagerly render the whole collection.
```

Keep security and data-loss rules unconditional in `data-and-security.md`, because they affect scripts as well as frontend code.

### Actual custom agents, only when useful

Claude Code custom agents live in **`.claude/agents/*.md`** with YAML configuration. They are different from the roles described in `AGENTS.md`. Use built-in planning first; add one reviewer if you repeatedly need that handoff. [13]

```md
---
name: record-store-reviewer
description: Review record-store changes for data loss, credential leaks, accessibility, and 3D performance risks.
tools: Read, Glob, Grep
model: inherit
---

Review the diff and relevant code. Do not edit files.
Check identity preservation, refresh merge behavior, secret exposure,
canvas fallbacks, and unnecessary eager loading.
Return actionable findings with file locations.
Do not claim to have executed tests; request command results when needed.
```

Repeat critical constraints in delegated task prompts rather than assuming every agent has the full conversation context.

## Your first Claude Code session

Start in an empty project directory. Use Plan Mode for the uncertain integration work:

```bash
claude --permission-mode plan
```

You can also switch permission modes with `Shift+Tab`. Review the plan before allowing implementation. [14]

Paste this first:

```text
I want to build a personal Rhythm Lab record-store interface inspired by:
https://bookshelf-aea8f1.netlify.app/?view=covers
My public Bandcamp profile is https://bandcamp.com/rhythmlab.
It displayed 1,296 collection items and 71 wishlist items on Oct 19, 2026.
That is a baseline, not verified purchase completeness.

Read docs/BUILD-PLAN.md. Stay in Plan Mode; do not build the whole app.
First plan a small local feasibility test of Bandcamp's official Subsonic
beta, announced July 16, 2026, at https://bandcamp.com/api/subsonic.
Use dedicated credentials supplied locally, never my main password,
browser cookies, scraping, or undocumented fan endpoints.

Determine authentication, enumeration, item identity, artwork,
canonical links, coverage gaps, and one-item private playback feasibility.
Do not assume all standard endpoints work or that music enumeration
includes wishlist/merchandise or matches public collection-item counts.

Return the smallest test plan, files, dependencies, secret handling,
acceptance criteria, and fallback to my JSON/CSV/local music metadata.
No bulk downloads, playlist writes, deployment, or credential logging.
```

After that test, scaffold the frontend separately:

```bash
npm create vite@latest rhythm-lab-record-store -- --template react-ts
cd rhythm-lab-record-store
npm install
```

Then ask Claude to plan **milestone 2 only**: the shared catalog, cover grid, and record details using the sanitized sample. Add the 3D dependencies when beginning the scene milestone, after checking compatibility. Avoid “build everything in one go” prompts.

## Optional Linear workflow

You do not need Linear for a personal project; `docs/BUILD-PLAN.md` is enough. If you already use it, create one issue per milestone with acceptance criteria and keep issue IDs in your branch names or handoffs.

Linear documents a Claude Code MCP connection. For planning-only access, its read-only endpoint is the narrower choice: [15]

```bash
claude mcp add --transport http linear-readonly https://mcp.linear.app/mcp/readonly
```

Run `/mcp` in Claude Code to complete authorization. Connect a write-capable server only if you want Claude to update issues, and review the intended changes first. No Linear integration is required to start this build.

## Decisions to leave open until the prototype

Whether the finished store is private or publicly shareable changes hosting and playback security. How much of your collection is already downloaded changes the fallback importer. Whether you want a full music player or simply record browsing changes scope substantially.

You can defer those choices while proving the official data connection and building one crate. The first successful deliverable should be **a small catalog you can browse beautifully**, not an elaborate backend with no records in it.

## References

[1]: https://bookshelf-aea8f1.netlify.app/?view=covers "Bookshelf reference application"
[2]: https://bandcamp.com/rhythmlab "Rhythm Lab public Bandcamp collection, inspected October 19, 2026"
[3]: https://blog.bandcamp.com/2026/07/16/discover-improvements-and-subsonic-implementation/ "Bandcamp official Subsonic beta announcement"
[4]: https://bandcamp.com/developer "Bandcamp developer API access and scope"
[5]: https://get.bandcamp.help/en/articles/15263124-bandcamp-s-acceptable-use-and-moderation-policy "Bandcamp acceptable use and moderation policy"
[6]: https://vite.dev/guide/ "Vite getting started and React TypeScript template"
[7]: https://tailwindcss.com/docs "Tailwind CSS installation with Vite"
[8]: https://r3f.docs.pmnd.rs/getting-started/introduction "React Three Fiber introduction and React compatibility"
[9]: https://drei.docs.pmnd.rs/ "Drei helpers for React Three Fiber"
[10]: https://www.portfoliobox.com/documentation/embed-bandcamp-tracks-and-albums "Bandcamp Share Embed workflow documented by Portfoliobox"
[11]: https://code.claude.com/docs/en/memory "Claude Code project memory, imports, and modular rules"
[12]: https://code.claude.com/docs/en/best-practices "Claude Code best practices"
[13]: https://code.claude.com/docs/en/sub-agents "Claude Code custom subagents"
[14]: https://code.claude.com/docs/en/permission-modes "Claude Code permission modes and planning"
[15]: https://linear.app/docs/mcp "Linear MCP setup and read-only access"
[16]: https://www.papaparse.com/docs "Papa Parse CSV parsing, error reporting, and safe export"
[17]: https://github.com/inikulin/parse5 "parse5 HTML parsing toolset"
[18]: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString "MDN HTML parsing resource-loading and XSS considerations"
[19]: https://www.nngroup.com/articles/filter-categories-values/ "Nielsen Norman Group filter categories and values"
[20]: https://www.nngroup.com/articles/infinite-scrolling-tips/ "Nielsen Norman Group infinite scrolling and navigation landmarks"
[21]: https://www.w3.org/WAI/WCAG22/Techniques/html/H102 "W3C native dialog accessibility technique"
