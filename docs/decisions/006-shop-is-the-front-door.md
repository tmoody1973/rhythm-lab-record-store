# 006 — The 3D record shop is the front door, on phones too

**Decision** — Visitors land in the 3D record shop at the site's main address, on desktop and on phones; the cover grid is one tap away.

**Why this came up** — Milestone 2 shipped the grid as an "interim" front door. A prototype of the 3D shop (branch `spike/iso-shop`) showed it could feel like a real shop: a dollhouse room you can turn, sections you step up to, and crates you flip through like the cratedigger demo. The question was whether that shop greets everyone, or waits behind a button.

**Options**
1. **Shop as the front door, tuned for phones** — everyone meets the idea that makes the site different. Cost: every first visit downloads the 3D code and the decor (about 9 MB in the prototype, which must shrink), and every screen size needs its own camera framing.
2. **Grid first with a "Walk in" button** — lighter and nothing changes for people who just want to find a record. Cost: many visitors never see the shop.
3. **Shop on desktop only** — least work. Cost: phone visitors, likely a large share, never see it.

**What we chose and why** — Option 1 (Tarik's call, 2026-10-20, from Claude's recommendation). The shop is the reason the site exists as a portfolio piece; a reviewer opening the link on a phone should see it. Browsers that can't draw 3D still get the grid.

**What we gave up** — Speed of the first visit, and simplicity: the build has to slim the 3D assets, frame the camera for tall phone screens, and keep the grid one tap away for people who came to find one record.

**How we'll know if this was right** — On a mid-range phone and an ordinary laptop, the shop is usable within a few seconds of opening the link and digging feels smooth; visitors who want the grid find it without help.

**What actually happened** —
