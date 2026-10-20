# 004 — Add labels and countries from Apple Music, MusicBrainz and Discogs, but only when the match is trustworthy

**Decision** — Fill in record label, country, styles and release date from three outside music databases, and publish a value only when the match is clearly right; uncertain matches go to Tarik for review instead of onto the site.

**Why this came up** — Bandcamp's Subsonic service gives no record label and no location, so "jazz from England" (the kind of search Tarik actually does) is impossible. Outside databases have that information, but none of them knows Bandcamp's IDs, so every match is a guess based on artist and title.

**Options**
1. **Enrich with a confidence gate** — richer records, and the "UK jazz" view becomes possible. Cost: three integrations to build and maintain; many small Bandcamp-only releases will stay blank.
2. **Enrich and publish best guesses** — maximum coverage. Cost: wrong labels shown confidently on a portfolio site, which is worse than blank.
3. **No enrichment; Tarik tags by hand** — perfectly accurate. Cost: impractical across 1,215 records.

**What we chose and why** — Option 1 (Tarik asked for the three sources; Claude proposed the gate). A match counts when artist, title and track count all agree, or when two sources agree on the value; one-song records need two sources. A 50-record pilot measures real match rates before the full run.

**What we gave up** — Coverage. Some records — likely many of the 761 one-song releases — will show no label or country.

**How we'll know if this was right** — The pilot's hand-checked sample shows no wrong published values, and enough records get a country to make a country filter worth showing.

**What actually happened** —
