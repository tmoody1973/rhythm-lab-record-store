# 002 — Make it a public, static site; visitors listen through Bandcamp's own player

**Decision** — The record store is a public website that loads a pre-built catalog file, with no server, no login, and no connection to Bandcamp's private Subsonic service. Visitors listen through Bandcamp's embedded player.

**Why this came up** — The original plan assumed a private tool just for Tarik. Tarik then said it's a portfolio piece for other people to explore his taste. A public site that streamed his purchased files through Subsonic would be redistributing music he bought, and it would put his private credentials one mistake away from the internet.

**Options**
1. **Static site + Bandcamp's embedded player** — nothing secret ever leaves Tarik's Mac; every play is also an invitation to buy. Cost: playback looks like Bandcamp's player, not a custom one, and depends on Bandcamp keeping embeds working.
2. **Site with a private server that streams via Subsonic** — custom player, full control. Cost: redistributes purchased audio, needs hosting and security work, and breaks Bandcamp's terms in spirit.
3. **Private-only tool** — no public risk at all. Cost: defeats the point; nobody else can see it.

**What we chose and why** — Option 1 (Tarik set the public/portfolio goal; Claude proposed the architecture). It's the only option that is public *and* safe, and Subsonic's album numbers turned out to be Bandcamp's own, which makes the embedded player work for every record (checked on 4 record types).

**What we gave up** — A fully custom-styled player (the mockup's player is approximated, not reproduced). Covers are downloaded and served from our own site, which means hosting album art we don't own the rights to — common practice for collection sites, but a real trade-off.

**How we'll know if this was right** — The deployed site contains no credentials or stream links (checked automatically before deploy), and every record's player opens the right album.

**What actually happened** —
