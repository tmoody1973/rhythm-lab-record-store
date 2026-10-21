# 008 — Read each record's public Bandcamp page for its description, credits and tags

**Decision** — A one-off step (`npm run about`) reads each record's public Bandcamp album page once, keeps the description, credits and tags, and the album pop-up shows them under the player.

**Why this came up** — Tarik wanted visitors to learn more about a record than its title and label: the artist's own notes, which Bandcamp shows under the song list. The project's ground rules said "no scraping", so the first stop was Bandcamp's official Subsonic feed. Its album detail has no description, and the standard Subsonic call for album notes (`getAlbumInfo2`) is refused with `bad version` at every API version tried (2026-10-21). The text exists only on the public album page. Getting this wrong had two costs: break the project's own rules quietly, or hammer Bandcamp's servers with 2,000+ page loads.

**Options**
1. **Read the public album pages, once, politely** — the page carries a JSON-LD block (structured data written for search engines) with the full description, credits and tags as plain text. Cost: it relaxes a ground rule; about 2,000 requests over ~35 minutes; the text belongs to artists and labels, not to this project.
2. **Apple Music's editorial notes** — already called during enrichment. Cost: Apple's editors' words, not the artist's, and probably only for better-known releases.
3. **Show nothing; link out to Bandcamp** — no new rules bent. Cost: visitors leave the shop to learn anything.

**What we chose and why** — Option 1 (Tarik's call, 2026-10-21: "a personal project and I purchased the albums"). Limits that still hold: public pages only, no cookies, no logged-in or fan pages, no passwords; requests spaced a second apart, retried gently on errors, stopped after three server errors in a row; every answer saved so a rerun only asks for what's new. Two measurements shaped the script: Bandcamp's player page is 2.1 MB but names the album's page in its first 20 KB, so the script stops reading there; and a custom user-agent label got ~5-second "tarpit" replies, so it sends Node's default one instead.

**What we gave up** — The clean "official sources only" line in the README; it now names this one exception. The notes are copied text, shown with a link back to each Bandcamp page and excluded from the MIT licence, like the artwork. A release removed from Bandcamp keeps its last saved notes until the cache is cleared.

**How we'll know if this was right** — Most records open with an About section (the trial: 10 of 10 with a description, 5 of 10 with credits); the full run finishes without Bandcamp refusing requests; and no visitor sees HTML or a broken page when a record has no notes.

**What actually happened** —
