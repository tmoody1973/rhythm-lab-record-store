# 001 — Test Bandcamp's official Subsonic service first, with a throwaway probe

**Decision** — Before building any interface, run a small read-only script against Bandcamp's new official Subsonic service to see whether it can supply the collection data; fall back to Tarik's own files only if it can't.

**Why this came up** — The record store is only as good as its list of records. There are three ways to get that list: Bandcamp's official Subsonic service (a standard music-server protocol that apps like Feishin use to browse and play a library), files Tarik exports or already has, or scraping his public Bandcamp page. If we picked wrong, we'd build a beautiful interface on data that is incomplete, breaks, or violates Bandcamp's rules.

**Options**
1. **Probe Subsonic first** — one small script, a few dozen requests, about an afternoon. Cost: the service is a beta with no published list of what works, so the probe may simply say "no."
2. **Start from Tarik's own files** — dependable and fully under his control. Cost: no confirmed fan export exists, files may lack artwork and links, and every refresh is manual.
3. **Scrape the public profile** — would see the 1,296 items. Cost: Bandcamp's acceptable-use policy prohibits automated scraping; it is fragile and off the table.

**What we chose and why** — Option 1, with option 2 as the planned fallback. (Proposed by Claude, approved by Tarik.) It is the only official, automatic route, and a read-only probe costs little while answering the questions that decide everything after it: can we list the library, get artwork, link back to Bandcamp, and play one track privately.

**What we gave up** — Time on a beta that may not work. A probe is throwaway code. And a "yes" from Subsonic still won't show wishlist items, merchandise, or Bandcamp page links unless the service happens to include them — those may need the file route anyway.

**How we'll know if this was right** — The probe's coverage report (`docs/IMPORT-COVERAGE.md`) gives a clear answer on all seven questions in the design (`docs/superpowers/specs/2026-10-19-subsonic-feasibility-design.md`), and the next milestone can start from its sample catalog without re-deciding the data source.

**What actually happened** —
