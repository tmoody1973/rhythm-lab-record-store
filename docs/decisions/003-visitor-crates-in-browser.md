# 003 — Visitors' saved picks live in their own browser, shareable by link

**Decision** — Visitors can heart records and build their own crates without an account; everything is stored in their browser, and a crate can be shared as a link that rebuilds it elsewhere.

**Why this came up** — Tarik wants visitors to save their own picks and crates, not just look at his. Where that data lives decides whether the project needs accounts, a database, and a privacy policy.

**Options**
1. **Browser storage + share link** — no sign-up, no server, no personal data held by us. Cost: picks are lost if a visitor clears their browser or switches devices, and there's no view of what everyone saves.
2. **Accounts and a database** — picks follow people across devices; popular picks become visible. Cost: roughly doubles the project (login, storage, deletion, abuse) and puts a sign-up wall in front of saving.
3. **Browser storage, no sharing** — simplest. Cost: crates can't leave the device.

**What we chose and why** — Option 1 (Claude recommended; Tarik chose it). It delivers the feature with no new infrastructure, and accounts can be added later without throwing it away.

**What we gave up** — Cross-device crates and any aggregate "most saved" insight.

**How we'll know if this was right** — Visitors actually create and share crates (visible only if Tarik later adds privacy-respecting analytics), and nobody asks for sync.

**What actually happened** —
