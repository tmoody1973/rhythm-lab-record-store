# 009 — Count what visitors do in the shop, without keeping what they type

**Decision** — Vercel Web Analytics runs on the live site only, sends the page's path and never its query string, and ten named custom events (a custom event is a named action the page reports, like "Record Opened") record what people do inside the shop. Each event has at most two details, and none of them is visitor-typed text.

**Why this came up** — Tarik wanted to know which records people actually click on, and how they use the shop. Vercel Agent opened PR #14 with the standard install. Reading Vercel's own script (2026-10-21) showed three things that install would get wrong for this site:
- **Page views alone see almost nothing.** A page view only counts when the path changes, and the whole shop lives on `/`: opening a record, entering a section and searching all change the query string, not the path. Without custom events the dashboard would show "people visited", not what they did.
- **Every event sends the full address.** The address holds the search box's text and, for shared crates, the whole crate (up to 16 KB). The standard install would send both to Vercel with every page view and event.
- **In development it fetches a debug script from Vercel's servers.** The browser tests run against the development server, so every test run would have depended on Vercel's CDN.

Getting this wrong cost either a blind dashboard or a quiet privacy leak.

**Options**
1. **Merge the standard install as it was** — Cost: a dashboard of `/` and `/about.html` visits only, plus search text and shared crates sent to Vercel.
2. **Standard install, trimmed URLs, plus custom events with a fixed list of details** — Cost: about 150 lines of wiring, and the Pro plan's two-detail limit forces choices (see below).
3. **Add the $10/month Web Analytics Plus add-on** for 8 details per event — Cost: money every month, for detail a personal site doesn't need yet.

**What we chose and why** — Option 2 (joint: Tarik chose to build on PR #14 rather than replace it, and that searches report only "some" vs "no results"; Claude chose the event list). PR #14's commit is kept and built on. The events:

| Event | Details | Question it answers |
|---|---|---|
| Record Opened | record, from (shop / grid / crates / shared / link) | Which releases pull people in, and how they got there |
| Bandcamp Clicked | record, link (open-button / player-fallback / notes) | Does the shop send people to Bandcamp |
| Section Entered | section | Which parts of the 3D shop get explored |
| View Switched | to (store / grid) | Do people prefer the shop or the grid |
| 3D Unavailable | reason (unsupported / crashed), once per browser session | How many visitors never see the shop |
| Crate Action | action (favorite / add-to-crate / new-crate), record | Do visitors build their own crates, and with what |
| Shared Crate | action (opened / saved), records | Do shared links get opened and kept |
| Share Link Copied | records | Do people share crates |
| Notes Expanded | part (read-more / credits) | Does anyone read the album notes (decision 008) |
| Search | results (some / none), once typing stops; not for a search already in the link | How often search comes up empty |

"Record" is `Artist — Title`, public catalog text. The list lives in `src/analytics.ts` as a type, so adding a third detail or a free-text detail fails the typecheck.

**What we gave up**
- **Plays can't be seen.** The Bandcamp player is another site's frame; the shop can't tell if someone pressed play.
- **Search words aren't kept**, so there's no list of what people looked for and didn't find.
- **Development and test runs report nothing**, so a broken event shows up only on a deployed build.
- **Every event costs money:** $0.03 per 1,000 on Pro, page views included.
- **Back and Forward don't count.** Reopening a record with the browser's Back button sends no Record Opened, so opens are slightly undercounted.
- **Middle-clicks aren't counted.** A middle-click on a Bandcamp link opens a tab without a click event, so it goes uncounted.

**How we'll know if this was right** — Within a week of deploying, the Vercel Analytics Events tab shows Record Opened broken down by record; the Pages list shows `/` with no `?q=` or `?shared=` entries; and the month's analytics cost stays under a dollar.

**What actually happened** —
