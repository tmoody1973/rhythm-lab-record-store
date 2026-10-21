// npm run about — each record's description, credits and tags from its public Bandcamp album page
// (the JSON-LD block search engines read), into public/about/<compact id>.json. Tarik OK'd reading
// these pages on 2026-10-21 (decision 008): one polite pass, ~1 request/second, cached, no cookies.
// Usage: npm run about [-- --only a123,t456]
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { MAX_TAGS, MAX_TEXT, type About } from '../src/catalog/about.ts';
import { BANDCAMP_URL, EnrichmentFileSchema } from '../src/catalog/enrichment.ts';
import { embedUrl, toCompact } from '../src/catalog/ids.ts';
import { CatalogSchema, type PublicAlbum } from '../src/catalog/schema.ts';

const CACHE = 'data/.cache/about';
const OUT = 'public/about';
const GAP_MS = 1000;
// Node's default user-agent: a custom one got ~5 s tarpit responses from Bandcamp (measured 2026-10-21).
const LD = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/;

type Kind = PublicAlbum['kind'];
type Cached = { url: string | null; about: Omit<About, 'url'> | null; status: number };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_TEXT) : undefined);

/** The page's JSON-LD as About fields; null when the page has no readable JSON-LD. */
export function parseAboutPage(html: string): Omit<About, 'url'> | null {
  const m = LD.exec(html);
  if (!m) return null;
  let ld: any;
  try { ld = JSON.parse(m[1]); } catch { return null; }
  const tags = Array.isArray(ld.keywords)
    ? [...new Set(ld.keywords.filter((k: unknown) => typeof k === 'string').map((k: string) => k.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_TAGS) as string[]
    : [];
  const about: Omit<About, 'url'> = {};
  const description = text(ld.description);
  const credits = text(ld.creditText);
  if (description) about.description = description;
  if (credits) about.credits = credits;
  if (tags.length) about.tags = tags;
  return about;
}

/** The record's own page in Bandcamp's player page: the first <sub>.bandcamp.com/<kind>/<slug> link. */
export function findPageUrl(html: string, kind: Kind): string | null {
  return new RegExp(`https://[a-z0-9-]+\\.bandcamp\\.com/${kind}/[a-z0-9-]+`).exec(html)?.[0] ?? null;
}

/** Node's fetch gives up on endless redirects; Bandcamp does that to cookie-less visitors on some pages. */
export function isRedirectLoop(e: unknown): boolean {
  return e instanceof Error && /redirect count exceeded/.test(String((e.cause as Error | undefined)?.message));
}

let last = 0;
/** Polite GET: spaced GAP_MS apart, 429/5xx retried with backoff. Reads only until `done` says stop. */
async function get(url: string, done: (soFar: string) => boolean, maxBytes: number): Promise<{ status: number; body: string }> {
  for (let attempt = 0; ; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await delay(wait);
    last = Date.now();
    let res: Response;
    try { res = await fetch(url); } catch (e) {
      // 310 is ours: the page only loads with cookies, which this project never keeps. An answer, cached.
      if (isRedirectLoop(e)) return { status: 310, body: '' };
      res = new Response(null, { status: 599 });
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await delay(5000 * 2 ** attempt); continue; }
    if (!res.ok || !res.body) return { status: res.status, body: '' };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let body = '';
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      body += dec.decode(value, { stream: true });
      if (done(body) || body.length > maxBytes) { await reader.cancel(); break; }
    }
    return { status: res.status, body };
  }
}

async function writeAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, path);
}

async function fetchOne(r: PublicAlbum, knownUrl: string | undefined): Promise<Cached> {
  let url = knownUrl && new RegExp(`/${r.kind}/`).test(knownUrl) ? knownUrl.split('?')[0] : null;
  if (!url) {
    const player = await get(embedUrl(r), (s) => findPageUrl(s, r.kind) !== null, 1_000_000);
    url = findPageUrl(player.body, r.kind);
    if (!url) return { url: null, about: null, status: player.status };
  }
  if (!BANDCAMP_URL.test(url)) return { url: null, about: null, status: 0 };
  const page = await get(url, (s) => LD.test(s), 3_000_000);
  return { url, about: page.status === 200 ? parseAboutPage(page.body) : null, status: page.status };
}

async function main(): Promise<void> {
  const only = process.argv.includes('--only') ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(',')) : null;
  const catalog = CatalogSchema.parse(JSON.parse(await readFile('public/catalog.json', 'utf8')));
  const enrichment = existsSync('public/enrichment.json')
    ? EnrichmentFileSchema.parse(JSON.parse(await readFile('public/enrichment.json', 'utf8'))).entries
    : {};
  await mkdir(CACHE, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const counts = { records: 0, fetched: 0, description: 0, credits: 0, tags: 0, noPage: 0, failed: 0 };
  let failStreak = 0;
  for (const r of catalog.albums) {
    const compact = toCompact(r.id)!;
    if (only && !only.has(compact)) continue;
    counts.records++;
    const cacheFile = join(CACHE, `${compact}.json`);
    let c: Cached;
    if (existsSync(cacheFile)) c = JSON.parse(await readFile(cacheFile, 'utf8'));
    else {
      c = await fetchOne(r, enrichment[r.id]?.bandcampUrl);
      counts.fetched++;
      // Server trouble is not cached, so a rerun retries it; "no page" and 404 are answers and are cached.
      if (c.status === 429 || c.status >= 500) {
        counts.failed++;
        if (++failStreak >= 3) throw new Error(`Bandcamp answered HTTP ${c.status} three times in a row; stopping. Rerun later; finished records are cached.`);
        continue;
      }
      failStreak = 0;
      await writeAtomic(cacheFile, c);
    }
    if (!c.url) counts.noPage++;
    if (c.about?.description) counts.description++;
    if (c.about?.credits) counts.credits++;
    if (c.about?.tags?.length) counts.tags++;
    // Every record gets a file, even an empty one, so the site never asks for a missing file.
    await writeAtomic(join(OUT, `${compact}.json`), c.url ? { url: c.url, ...c.about } : {});
    if (counts.fetched && counts.fetched % 50 === 0) process.stdout.write(`… ${counts.records} records, ${counts.fetched} fetched\n`);
  }
  process.stdout.write(`${JSON.stringify(counts)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
