# Enrichment coverage — pilot (50 records)

Run: 2026-10-19 · `npm run enrich -- --pilot` · plan: `docs/superpowers/plans/2026-10-19-enrichment.md` · decision: `docs/decisions/004-enrichment-confidence-gate.md`

## Bottom line

Of 50 sample records (25 one-song, 25 multi-song), **33 got at least one published value, and 29 of those are backed by two or more sources.** The gate held: nothing was published from a single uncertain match, and one wrong value the hand-check surfaced (a `[none]` placeholder catalog number) is now blocked for every source. **Artist country reached 13 of 50 (26%), just under the 30% bar**, so on these numbers the Country filter would stay hidden.

## What was published

| Field | Records (of 50) |
|---|---|
| Release date | 32 |
| Label | 22 |
| Artist country + area | 13 |
| Bandcamp page link ("Open on Bandcamp") | 9 |
| Styles | 8 |
| Catalog number | 6 |

28 records have entries in the review list (`data/enrichment-review.md`, not in git): values the gate would not publish on its own because only one source had them for a one-song record, or sources disagreed.

## Match rate per source

"Usable" = the source's best result matched the artist and title exactly (high or medium); "high" = also the same number of tracks as the record.

| Source | One-song records (25) | Multi-song records (25) |
|---|---|---|
| Apple Music | 16 usable (0 high, by design) | 13 usable (12 high) |
| MusicBrainz | 15 usable | 16 usable (15 high) |
| Discogs | 13 usable | 13 usable (9 high) |

One-song records are never "high" on their own (they may be a single bought from a full album: Subsonic's song count is **the tracks owned**, e.g. "Universal Beings" shows 1 of its 22), so they need two sources to agree. Roughly a third to a half of records find no exact match in any one source, mostly small Bandcamp-only releases.

## Cost

- 289 requests (Apple 50, MusicBrainz 111, Discogs 128), 0 retries, 0 failures, 140 seconds. Re-running is free: every response is cached, and a second run made 0 network requests.
- **Projected full run (1,215 records): about 55–60 minutes**, paced by MusicBrainz's one-request-per-second limit; about 7,000 requests across the three services.
- Credential scan (`npm run check-secrets`): PASS.

## Hand-check: please mark each ✅ or ❌

These are published values, spread across fields. A wrong one means the gate needs tightening before the full run.

| # | Record | Field | Value | Sources | ✅/❌ |
|---|---|---|---|---|---|
| 1 | Wastral — Celia Wa | label | Heavenly Sweetness | Apple + MusicBrainz + Discogs | ✅ |
| 2 | Little Spaces — Nu:Tone | artist country | United Kingdom | Apple + MusicBrainz + Discogs | ✅ |
| 3 | VGM.28 — Knxwledge. | Bandcamp link | https://knxwledge.bandcamp.com/album/vgm-28 | MusicBrainz | ✅ |
| 4 | Little Spaces — Nu:Tone | styles | Drum n Bass | Apple + MusicBrainz + Discogs | ✅ |
| 5 | I Think I'm Falling In Love — Leroy Hutson | catalog number | ATH018 | MusicBrainz + Discogs | ✅ |
| 6 | oneiric — del bel | release date | 2011-10-31 | Apple + MusicBrainz + Discogs | ✅ |
| 7 | Motherless Father — LeFtO Early Bird | label | Brownswood Recordings | Apple + MusicBrainz | ✅ |
| 8 | Cloak — Jordan Rakei | artist country / area | United Kingdom (London) | Apple + MusicBrainz | ✅ |
| 9 | 3 Nights In Amsterdam — JessB | Bandcamp link | https://ogjessb.bandcamp.com/album/3-nights-in-amsterdam | MusicBrainz | ✅ |
| 10 | HA Chu — Pan Amsterdam | styles | Abstract, Future Jazz | Apple + MusicBrainz + Discogs | ✅ |
| 11 | HELLA LOVE — MARINERO | catalog number | HAR-135 | Apple + MusicBrainz + Discogs | ✅ |
| 12 | Wastral — Celia Wa | release date | 2021-07-02 | Apple + MusicBrainz + Discogs | ✅ |
| 13 | Colour Theory — Submotion Orchestra | label | Counter Records | Apple + MusicBrainz + Discogs | ✅ |
| 14 | VGM.28 — Knxwledge. | artist country | United States | MusicBrainz | ✅ |
| 15 | The Voice Of Q — Q | Bandcamp link | https://qvoiceofq.bandcamp.com/album/the-voice-of-q | Apple + MusicBrainz | ✅ |

"Sources" lists every source that contributed to the record's published values, not necessarily to that one field.

## Fixed during the pilot

- **Placeholder values.** MusicBrainz writes `[none]` for "no catalog number"; it was published once. Placeholders (`[none]`, `none`, `N/A`, `-`, `[no label]`, `unknown`) are now rejected for every source and field (test: "placeholder catalog numbers like [none] are never published").

## Country filter threshold

The pilot reached **26%** country coverage against a 30% bar. **Tarik lowered the bar to 20%** (2026-10-19) so the filter appears once the full run lands.

# Full run (all 1,215 records)

Run: 2026-10-19/20 · `npm run enrich` · 62 minutes, 6,489 requests (Apple 1,164 · MusicBrainz 2,443 · Discogs 2,882), **0 failures**, 118 MusicBrainz rate-limit retries. Later re-runs replay from the local cache in about a second with no requests.

## What was published

| Field | Records (of 1,215) |
|---|---|
| Release date | 654 |
| Label | 482 |
| Artist country + area | 257 (21.2%) |
| Catalog number | 148 |
| Bandcamp page link | 142 |
| Styles | 118 |

**738 records** have at least one published value; **726** have something waiting in `data/enrichment-review.md`.

## What the stricter gate cost

The final review tightened the gate to match decision 004 exactly: a value is published only when *every* source that has it agrees (a 2-against-1 majority, or a confident match over a less confident one, no longer wins). On the same cached data:

| | Before | After |
|---|---|---|
| Records with any value | 713 | 701 |
| Labels | 541 | 482 |
| Release dates | 692 | 654 |

The 59 labels and 38 dates are not lost: they are in the review list, where Tarik can accept any of them through `content/overrides.json`.

## Country: 14.3% → 21.2%

The gate alone gave a country to 174 records (14.3%), all of them multi-song: only MusicBrainz has artist country, and a one-song record needs two agreeing sources, so 0 of 761 one-song records could get one. **Tarik chose to reuse a confirmed artist country across that artist's other records** (decision 005), which added 83 records with no conflicts. Coverage is 257 / 1,215 = **21.2%**, over the 20% bar, so the Country filter shows. 21 countries; US 86 and GB 48 lead (counts before reuse).
