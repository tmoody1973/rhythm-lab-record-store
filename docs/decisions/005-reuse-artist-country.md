# 005 — Reuse a confirmed artist country across that artist's other records

**Decision** — When the gate confirms an artist's country on one record, give the same country to that artist's other records, instead of matching every record on its own.

**Why this came up** — The full run put a country on only 174 of 1,215 records (14.3%), under the 20% bar Tarik set for showing the Country filter. The cause was structural, not bad matching: only MusicBrainz knows where an artist is from, and a one-song record needs two agreeing sources (decision 004), so **none of the 761 one-song records could ever get a country**. But country belongs to the artist, not the release: if Makaya McCraven's album is confirmed as Chicago, his single is from Chicago too.

**Options**
1. **Reuse the artist's confirmed country** — 174 → 257 records (21.2%), so the filter appears. Cost: one more rule in the pipeline, and a small risk that two different artists with the same name share a country.
2. **Lower the bar to 14%** — a one-line change. Cost: the filter would only ever cover albums, so a visitor filtering by a country sees a fraction of what Tarik actually owns from there.
3. **Keep the filter hidden** — no work. Cost: the "jazz from England" view that motivated enrichment never appears.

**What we chose and why** — Option 1 (Claude proposed and measured it; Tarik chose it). The rule only reuses a country the gate itself confirmed, and it holds back when the artist has two different confirmed countries, when Tarik's overrides clear the country, or when MusicBrainz named a different country for that particular record. Area (city) is reused only when the artist has a single confirmed area.

**What we gave up** — Strictness. A reused country rests on an artist-name match alone, which is weaker than the release match decision 004 requires. Two artists sharing a name across Tarik's collection would share a country. In the full run, 83 records got a reused country; the only one under five characters was MRCY → GB.

**How we'll know if this was right** — Spot-check a handful of reused countries (especially short or generic artist names) and find no wrong ones; the Country filter shows and its counts look like Tarik's collection.

**What actually happened** —
