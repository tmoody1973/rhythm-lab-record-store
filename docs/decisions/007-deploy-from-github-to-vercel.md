# 007 — Deploy from GitHub to Vercel, with the catalog and covers in the repo

**Decision** — The site is hosted on Vercel, which builds it from the GitHub repo; the catalog, the credits file and the 2,428 cover images (118 MB) are committed to the repo so every build has them.

**Why this came up** — The shop was finished and green on `main`, and it was time to put it online. The build plan had suggested Netlify; Tarik asked for Vercel. The catch: the catalog, credits and covers had been kept out of git and lived only on Tarik's Mac. Vercel builds from GitHub, so without them it would publish an empty shop. Uploading a build from the Mac instead is capped at 100 MB on Vercel's free plan and 1 GB on Pro; the finished site is 148 MB, and Tarik's account turned out to be on Pro already.

**Options**
1. **Commit the data and covers; Vercel builds from GitHub** — every pull request gets a preview link and every green merge to `main` goes live, with CI (the automatic check) in front of it. Cost: 118 MB of album art sits in the public repo's history for good, and the repo gets heavier to download.
2. **Covers in separate storage (Vercel Blob or similar)** — the repo stays light and deploys stay automatic. Cost: another service, another credential, and about an afternoon of setup.
3. **Upload the build from the Mac (fits Pro's 1 GB cap)** — no artwork in git, and no extra fee on Tarik's Pro plan. Cost: deploys are manual, so nothing forces them to come from a green `main`.

**What we chose and why** — Option 1 (Tarik's call, 2026-10-20, from Claude's recommendation; reconfirmed after learning option 3 costs nothing extra on his plan). It is the least moving parts, and it puts the existing CI check in front of every release. The artwork is already shown publicly on the site (decision 002), so the repo adds another copy rather than new exposure. Vercel's build machines run Node 24 at most, so `package.json` asks for Node 24 or later; the decor download and the build were run on Node 24 before this decision was written.

**What we gave up** — A light repo. Removing the artwork later would need a history rewrite, not just a delete. The README states that the artwork is not covered by the MIT licence.

**How we'll know if this was right** — Preview links appear on pull requests, merges to `main` go live without anyone running a command, and the deployed site shows every cover with no credential or stream link in it (`npm run check-secrets` before each catalog refresh).

**What actually happened** —
