// Read-only feasibility probe for Bandcamp's Subsonic beta.
// Spec: docs/superpowers/specs/2026-10-19-subsonic-feasibility-design.md
// Run:  node --env-file=.env.local scripts/subsonic-probe.mts <auth|enumerate [--ids-only]|art|play <songId>|check-secrets>
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

export const OUT = 'out';
const OFFICIAL_URL = 'https://bandcamp.com/api/subsonic';
const CRED_PARAMS = ['u', 'p', 't', 's', 'apiKey'];
const ALLOWED = new Set([
  'ping', 'getOpenSubsonicExtensions', 'getMusicFolders', 'getArtists', 'getArtist', 'getAlbumList2',
  'getAlbum', 'search3', 'getStarred2', 'getPlaylists', 'getGenres', 'getCoverArt', 'stream',
]);
// Read-only, used only after a primary endpoint has failed (spec: "Read-only fallbacks").
const FALLBACK = new Set(['getIndexes', 'getMusicDirectory', 'getAlbumList', 'getSong']);

type Config = { baseUrl: string; user: string; password: string };
type Auth = 'token' | 'enc' | 'none';
type CallOpts = { fallback?: boolean; auth?: Auth };
type ClientOpts = { fetchImpl?: typeof fetch; gapMs?: number; cap?: number; prefix?: string; auth?: Auth; log?: (...p: unknown[]) => void };

export class SubsonicError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function redact(url: string): string {
  try {
    const u = new URL(url);
    for (const k of CRED_PARAMS) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url.replace(/[?&](?:u|p|t|s|apiKey)=[^&\s]*/g, '');
  }
}

// Strips credential params from URLs and from any URL-like text (e.g. "Failed to parse URL from bandcamp.com/...?u=...").
const redactText = (text: string) =>
  text.replace(/https?:\/\/\S+/g, (m) => redact(m)).replace(/[?&](?:u|p|t|s|apiKey)=[^&\s"']*/g, '');

export function log(...parts: unknown[]): void {
  const line = redactText(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' '));
  process.stdout.write(line + '\n');
  mkdirSync(OUT, { recursive: true });
  appendFileSync(join(OUT, 'run.log'), `${new Date().toISOString()} ${line}\n`);
}

export function assertAllowed(endpoint: string, opts: { fallback?: boolean } = {}): void {
  if (FALLBACK.has(endpoint)) {
    if (!opts.fallback) throw new Error(`${endpoint} is a fallback endpoint; only use it after a primary endpoint failed`);
    return;
  }
  if (!ALLOWED.has(endpoint)) throw new Error(`${endpoint} is not allowed (read-only allowlist)`);
}

export function tokenAuth(user: string, password: string, salt = randomBytes(6).toString('hex')): URLSearchParams {
  const t = createHash('md5').update(password + salt).digest('hex');
  return new URLSearchParams({ u: user, t, s: salt });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  for (const k of ['SUBSONIC_URL', 'SUBSONIC_USER', 'SUBSONIC_PASSWORD']) {
    if (!env[k]) throw new Error(`Missing ${k} in .env.local`);
  }
  // Only the official endpoint: a typo'd URL must never receive credentials or echo them in an error.
  const bad = new Error(`SUBSONIC_URL must be ${OFFICIAL_URL}`);
  let u: URL;
  try {
    u = new URL(env.SUBSONIC_URL!);
  } catch {
    throw bad;
  }
  if (u.protocol !== 'https:' || u.host !== 'bandcamp.com' || u.pathname.replace(/\/+$/, '') !== '/api/subsonic') throw bad;
  return { baseUrl: OFFICIAL_URL, user: env.SUBSONIC_USER!, password: env.SUBSONIC_PASSWORD! };
}

// Flags files holding the password, its enc: hex form, or any token/salt/password query param.
export function scanForSecret(dir: string, secret: string): string[] {
  if (!secret) throw new Error('secret not loaded; run with --env-file=.env.local');
  if (!existsSync(dir)) return [];
  const hex = Buffer.from(secret).toString('hex');
  const leaks = (text: string) => text.includes(secret) || text.includes(hex) || /[?&](?:t|s|p)=[^&\s"']+/.test(text);
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => statSync(join(dir, f)).isFile() && leaks(readFileSync(join(dir, f), 'utf8')))
    .sort();
}

const retryAfterMs = (res: Response, attempt: number) => {
  const s = Number(res.headers.get('retry-after'));
  return Number.isFinite(s) && res.headers.has('retry-after') ? s * 1000 : 2000 * 2 ** attempt;
};

export function createClient(cfg: Config, opts: ClientOpts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const gapMs = opts.gapMs ?? 250;
  const cap = opts.cap ?? 400;
  const prefix = opts.prefix ?? '/rest';
  const say = opts.log ?? log;
  let sent = 0;
  let last = 0;

  function buildUrl(endpoint: string, params: Record<string, string>, auth: Auth): string {
    const q = new URLSearchParams({ v: '1.16.1', c: 'rl-record-store-probe', f: 'json', ...params });
    if (auth === 'token') for (const [k, v] of tokenAuth(cfg.user, cfg.password)) q.set(k, v);
    if (auth === 'enc') {
      q.set('u', cfg.user);
      q.set('p', 'enc:' + Buffer.from(cfg.password).toString('hex'));
    }
    return `${cfg.baseUrl}${prefix}/${endpoint}?${q}`;
  }

  async function raw(endpoint: string, params: Record<string, string> = {}, init: RequestInit = {}, o: CallOpts = {}): Promise<Response> {
    assertAllowed(endpoint, o);
    let serverErrors = 0;
    for (let attempt = 0; ; attempt++) {
      if (sent >= cap) throw new Error(`request cap of ${cap} reached`);
      const wait = last + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      const url = buildUrl(endpoint, params, o.auth ?? opts.auth ?? 'token');
      sent++;
      last = Date.now();
      let res: Response;
      try {
        res = await fetchImpl(url, init);
      } catch (e) {
        throw new Error(`${endpoint}: network error (${redactText(String((e as Error).message))}) at ${redact(url)}`);
      }
      say(`${endpoint} HTTP ${res.status} ${Date.now() - last}ms`);
      if (res.redirected) say(`${endpoint} redirected to ${new URL(res.url).host}`); // Host only; query may carry tokens.
      if (res.status === 429 && attempt < 3) {
        await sleep(retryAfterMs(res, attempt));
        continue;
      }
      if (res.status >= 500) {
        if (++serverErrors >= 3) throw new Error(`${endpoint}: HTTP ${res.status} three times in a row, aborting`);
        continue;
      }
      return res;
    }
  }

  async function call(endpoint: string, params: Record<string, string> = {}, o: CallOpts = {}): Promise<any> {
    const res = await raw(endpoint, params, {}, o);
    if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
    let body: any;
    try {
      body = JSON.parse(await res.text());
    } catch {
      throw new Error(`${endpoint}: non-JSON response (HTTP ${res.status}, content-type ${res.headers.get('content-type')})`);
    }
    const sr = body?.['subsonic-response'];
    if (!sr) throw new Error(`${endpoint}: response has no subsonic-response`);
    if (sr.status === 'failed') throw new SubsonicError(sr.error?.code ?? -1, `${endpoint}: error ${sr.error?.code} ${sr.error?.message}`);
    return sr;
  }

  return { call, raw, count: () => sent };
}

export function writeOut(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n');
}

const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const SERVER_KEYS = ['version', 'type', 'serverVersion', 'openSubsonic'];

async function stageAuth(cfg: Config): Promise<void> {
  // 1. Find the path prefix with an authenticated ping. (Bandcamp answers an unauthenticated
  //    getOpenSubsonicExtensions with HTTP 500, so it cannot be used for discovery.)
  //    Token auth first; hex-encoded password only if token auth is unsupported (41/42).
  let prefix: string | undefined;
  let method: Auth = 'token';
  let sr: any;
  for (const p of ['/rest', '']) {
    try {
      sr = await createClient(cfg, { prefix: p, auth: 'token' }).call('ping');
      prefix = p;
      break;
    } catch (e) {
      if (!(e instanceof SubsonicError)) {
        log(`ping at "${p || '(no prefix)'}": ${(e as Error).message}`);
        continue;
      }
      if (![41, 42].includes(e.code)) throw e; // e.g. 40 wrong credentials: stop, do not retry.
      log(`FLAG: token auth rejected (${e.message}); trying hex-encoded password`);
      sr = await createClient(cfg, { prefix: p, auth: 'enc' }).call('ping');
      [prefix, method] = [p, 'enc'];
      break;
    }
  }
  if (prefix === undefined) throw new Error('server did not answer ping as Subsonic at "/rest" or without a prefix');
  const server = pick(sr, SERVER_KEYS);
  log(`ping ok via ${method} at "${prefix}"`, server);

  // 2. Extensions: record the unauthenticated outcome (a finding), then fetch them authenticated.
  let unauthenticatedExtensions: string;
  try {
    await createClient(cfg, { prefix, cap: 3 }).call('getOpenSubsonicExtensions', {}, { auth: 'none' });
    unauthenticatedExtensions = 'ok';
  } catch (e) {
    unauthenticatedExtensions = (e as Error).message;
  }
  let extensions: unknown = null;
  try {
    extensions = (await createClient(cfg, { prefix, auth: method }).call('getOpenSubsonicExtensions')).openSubsonicExtensions ?? null;
  } catch (e) {
    log(`authenticated getOpenSubsonicExtensions: ${(e as Error).message}`);
  }
  log('unauthenticated extensions:', unauthenticatedExtensions);
  log('extensions:', extensions);

  // 3. Negative test. Bandcamp's ping accepts any credentials, so test a data endpoint instead.
  const wrong = createClient({ ...cfg, password: 'definitely-wrong' }, { prefix, auth: method, cap: 4 });
  const attempt = async (endpoint: string) => {
    try {
      await wrong.call(endpoint);
      return { accepted: true };
    } catch (e) {
      return { accepted: false, code: e instanceof SubsonicError ? e.code : null, message: (e as Error).message };
    }
  };
  const negative = { ping: await attempt('ping'), getMusicFolders: await attempt('getMusicFolders') };
  if (negative.getMusicFolders.accepted) log('WARNING: wrong password could read library data');
  log('negative:', negative);
  writeOut('auth.json', { prefix, method, server, unauthenticatedExtensions, extensions, negative, at: new Date().toISOString() });
}

type PageResult<T> = { items: T[]; pages: number; duplicates: string[]; stoppedBy: 'short-page' | 'cap' | 'error'; error?: string };

export async function pageAll<T>(fetchPage: (offset: number) => Promise<T[]>, size: number, idOf: (t: T) => string): Promise<PageResult<T>> {
  const items: T[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (let pages = 0; ; pages++) {
    let page: T[];
    try {
      page = await fetchPage(pages * size);
    } catch (e) {
      const error = (e as Error).message;
      return { items, pages, duplicates, stoppedBy: /request cap/.test(error) ? 'cap' : 'error', error };
    }
    for (const item of page) {
      const id = idOf(item);
      if (seen.has(id)) duplicates.push(id);
      else seen.add(id);
      items.push(item);
    }
    if (page.length < size) return { items, pages: pages + (page.length ? 1 : 0), duplicates, stoppedBy: 'short-page' };
  }
}

const BANDCAMP_ID = /^\d{8,12}$/;

export function fieldCoverage(objs: Record<string, unknown>[]): Record<string, { pct: number; flagged: boolean }> {
  const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))].sort();
  return Object.fromEntries(keys.map((k) => {
    const values = objs.map((o) => o[k]).filter((v) => v !== undefined && v !== null && v !== '');
    const flagged = values.some((v) => {
      const s = typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v);
      return /http|bandcamp/i.test(s) || BANDCAMP_ID.test(s);
    });
    return [k, { pct: Math.round((values.length / objs.length) * 1000) / 10, flagged }];
  }));
}

// CatalogItem as proposed in docs/BUILD-PLAN.md ("A simple architecture").
type CatalogItem = {
  id: string;
  source: 'bandcamp-subsonic';
  sourceId: string;
  kind: 'album' | 'track' | 'package' | 'unknown';
  title: string;
  artist: string;
  artworkRef?: string;
  membership: 'collection' | 'wishlist' | 'unknown';
  sourceGenreTags?: string[];
};

export function toCatalogItem(album: Record<string, any>): CatalogItem {
  const tags = [...(album.genres ?? []).map((g: any) => g?.name ?? g), ...(album.genre ? [album.genre] : [])];
  return {
    id: `bandcamp-subsonic:album:${album.id}`,
    source: 'bandcamp-subsonic',
    sourceId: String(album.id),
    kind: 'album',
    title: String(album.name ?? album.title ?? ''),
    artist: String(album.artist ?? ''),
    ...(album.coverArt ? { artworkRef: String(album.coverArt) } : {}),
    membership: 'collection',
    ...(tags.length ? { sourceGenreTags: [...new Set(tags.map(String))] } : {}),
  };
}

function liveClient(cfg: Config, opts: ClientOpts = {}) {
  const authFile = join(OUT, 'auth.json');
  if (!existsSync(authFile)) throw new Error('run "auth" first (out/auth.json missing)');
  const { prefix, method } = JSON.parse(readFileSync(authFile, 'utf8'));
  return createClient(cfg, { prefix, auth: method, ...opts });
}

const PAGE = 500;
const SPOT_CHECKS = ['Curandera', 'Edge Conditions', 'Cuban Beat & Fantasia'];
const asList = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const today = () => new Date().toISOString().slice(0, 10);

async function primaryAlbums(c: ReturnType<typeof createClient>) {
  return pageAll(
    async (offset) => asList((await c.call('getAlbumList2', { type: 'alphabeticalByName', size: String(PAGE), offset: String(offset) })).albumList2?.album),
    PAGE,
    (a: any) => String(a.id),
  );
}

function writeIds(albums: any[]): void {
  // Compare against the newest earlier file (including one from earlier today) BEFORE overwriting it.
  const prior = existsSync(OUT) ? readdirSync(OUT).filter((f) => /^ids-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
  const rows = albums
    .map((a) => ({ id: String(a.id), artist: a.artist ?? null, title: a.name ?? null, songCount: a.songCount ?? null }))
    .sort((x, y) => x.id.localeCompare(y.id));
  const earlierFile = prior.at(-1);
  const earlier = earlierFile ? (JSON.parse(readFileSync(join(OUT, earlierFile), 'utf8')) as { id: string }[]) : null;
  writeOut(`ids-${today()}.json`, rows);
  if (!earlier) return log(`saved ${rows.length} ids; no earlier ids file to compare`);
  const before = new Set(earlier.map((r) => r.id));
  const now = new Set(rows.map((r) => r.id));
  const added = [...now].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !now.has(id));
  log(`ids vs ${earlierFile} (saved ${statSync(join(OUT, `ids-${today()}.json`)).mtime.toISOString()}): ${added.length} added, ${removed.length} removed`);
  writeOut(`ids-diff-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, { comparedWith: earlierFile, earlierCount: before.size, nowCount: now.size, added, removed });
}

// Fallback when getAlbumList2 fails: getArtists → getArtist, else getIndexes → getMusicDirectory. Max 300 requests.
async function fallbackAlbums(c: ReturnType<typeof createClient>): Promise<{ via: string; albums: any[]; partial: boolean }> {
  const budget = c.count() + 300;
  const albums: any[] = [];
  try {
    const artists = asList((await c.call('getArtists')).artists?.index).flatMap((i: any) => asList(i.artist));
    for (const a of artists) {
      if (c.count() >= budget) return { via: 'getArtist', albums, partial: true };
      albums.push(...asList((await c.call('getArtist', { id: String(a.id) })).artist?.album));
    }
    return { via: 'getArtist', albums, partial: false };
  } catch (e) {
    log(`getArtists fallback failed: ${(e as Error).message}; trying getIndexes`);
  }
  const dirs = asList((await c.call('getIndexes', {}, { fallback: true })).indexes?.index).flatMap((i: any) => asList(i.artist));
  for (const d of dirs) {
    if (c.count() >= budget) return { via: 'getMusicDirectory', albums, partial: true };
    const children = asList((await c.call('getMusicDirectory', { id: String(d.id) }, { fallback: true })).directory?.child);
    albums.push(...children.filter((ch: any) => ch.isDir));
  }
  return { via: 'getMusicDirectory', albums, partial: false };
}

async function stageEnumerate(cfg: Config, idsOnly: boolean): Promise<void> {
  const c = liveClient(cfg);
  const started = Date.now();
  if (idsOnly) {
    const r = await primaryAlbums(c);
    log(`getAlbumList2: ${r.items.length} albums, ${r.pages} pages, stoppedBy ${r.stoppedBy}`);
    if (r.stoppedBy !== 'short-page') throw new Error(`ID pass incomplete (${r.stoppedBy}: ${r.error}); not saving`);
    return writeIds(r.items);
  }

  const safe = async <T,>(label: string, f: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await f();
    } catch (e) {
      log(`${label}: ${(e as Error).message}`);
      return { error: (e as Error).message };
    }
  };
  const musicFolders = await safe('getMusicFolders', async () => asList((await c.call('getMusicFolders')).musicFolders?.musicFolder));
  const artistCount = await safe('getArtists', async () => asList((await c.call('getArtists')).artists?.index).flatMap((i: any) => asList(i.artist)).length);
  const genres = await safe('getGenres', async () => asList((await c.call('getGenres')).genres?.genre));

  // Primary enumeration, then search3 as a cross-check.
  const primary = await primaryAlbums(c);
  log(`getAlbumList2: ${primary.items.length} albums, ${primary.pages} pages, ${primary.duplicates.length} duplicate ids, stoppedBy ${primary.stoppedBy}`);
  let albums = primary.items as any[];
  let via = 'getAlbumList2';
  let partial = primary.stoppedBy !== 'short-page';
  if (primary.stoppedBy === 'error') {
    const fb = await fallbackAlbums(c);
    [albums, via, partial] = [fb.albums, fb.via, fb.partial];
    log(`fallback via ${via}: ${albums.length} albums${partial ? ' (PARTIAL: cap hit)' : ''}`);
  }
  const search = await pageAll(
    async (offset) => asList((await c.call('search3', { query: '', albumCount: String(PAGE), albumOffset: String(offset), artistCount: '0', songCount: '0' })).searchResult3?.album),
    PAGE,
    (a: any) => String(a.id),
  );
  const primaryIds = new Set(albums.map((a) => String(a.id)));
  const searchIds = new Set(search.items.map((a: any) => String(a.id)));
  const onlyInPrimary = [...primaryIds].filter((id) => !searchIds.has(id));
  const onlyInSearch = [...searchIds].filter((id) => !primaryIds.has(id));
  log(`search3 cross-check: ${search.items.length} albums (stoppedBy ${search.stoppedBy}); only in primary ${onlyInPrimary.length}, only in search ${onlyInSearch.length}`);

  // Sample 25 albums deterministically (every Nth by id) for song-level fields.
  const byId = [...albums].sort((x, y) => String(x.id).localeCompare(String(y.id)));
  const step = Math.max(1, Math.ceil(byId.length / 25));
  const sampleAlbums: any[] = [];
  for (let i = 0; i < byId.length && sampleAlbums.length < 25; i += step) {
    const a = await safe(`getAlbum ${byId[i].id}`, async () => (await c.call('getAlbum', { id: String(byId[i].id) })).album);
    if (!('error' in a)) sampleAlbums.push(a);
  }
  const songs = sampleAlbums.flatMap((a) => asList(a.song));

  const starred = await safe('getStarred2', async () => {
    const s = (await c.call('getStarred2')).starred2 ?? {};
    return { artists: asList(s.artist).length, albums: asList(s.album).length, songs: asList(s.song).length, sample: asList(s.album).slice(0, 5) };
  });
  const playlists = await safe('getPlaylists', async () =>
    asList((await c.call('getPlaylists')).playlists?.playlist).map((p: any) => ({ name: p.name, songCount: p.songCount })));
  const spotChecks: Record<string, unknown> = {};
  for (const q of SPOT_CHECKS) {
    spotChecks[q] = await safe(`search3 "${q}"`, async () => {
      const r = (await c.call('search3', { query: q, albumCount: '5', songCount: '5', artistCount: '0' })).searchResult3 ?? {};
      return { albums: asList(r.album), songs: asList(r.song) };
    });
    const hit = spotChecks[q] as any;
    log(`spot-check "${q}": ${hit.error ? 'ERROR' : `${hit.albums.length} albums, ${hit.songs.length} songs`}`);
  }

  const songCounts = albums.map((a) => Number(a.songCount ?? 0));
  const counts = {
    via, partial, artists: artistCount, albums: albums.length, primaryPages: primary.pages,
    songsSummedFromAlbums: songCounts.reduce((x, y) => x + y, 0),
    singleSongAlbums: songCounts.filter((n) => n === 1).length,
    albumsMissingCoverArt: albums.filter((a) => !a.coverArt).length,
    sampledAlbums: sampleAlbums.length, songsInSample: songs.length,
    requests: c.count(), elapsedSec: Math.round((Date.now() - started) / 1000),
  };
  writeOut('enumerate.json', { albums, sampleAlbums });
  writeOut('coverage.json', {
    note: 'Album/song counts are Subsonic units; the public profile counts 1,296 collection items (albums, tracks, packages) and 71 wishlist items.',
    counts, duplicates: primary.duplicates, primaryError: primary.error ?? null, musicFolders, genres,
    crossCheck: { searchCount: search.items.length, searchStoppedBy: search.stoppedBy, searchError: search.error ?? null, onlyInPrimary, onlyInSearch },
    fieldCoverage: { album: fieldCoverage(albums), sampledAlbumDetail: fieldCoverage(sampleAlbums.map(({ song, ...rest }) => rest)), song: fieldCoverage(songs) },
    starred, playlists, spotChecks,
  });
  writeOut('catalog-sample.json', albums.slice(0, 20).map(toCatalogItem));
  if (!partial) writeIds(albums);
  log('counts:', counts);
}

function readEnumerate(): { albums: any[]; sampleAlbums: any[] } {
  const f = join(OUT, 'enumerate.json');
  if (!existsSync(f)) throw new Error('run "enumerate" first (out/enumerate.json missing)');
  return JSON.parse(readFileSync(f, 'utf8'));
}

async function stageArt(cfg: Config): Promise<void> {
  const c = liveClient(cfg);
  const { albums } = readEnumerate();
  const samples = [];
  for (const a of albums.filter((x) => x.coverArt).slice(0, 5)) {
    const t0 = Date.now();
    const res = await c.raw('getCoverArt', { id: String(a.coverArt), size: '600' });
    const bytes = (await res.arrayBuffer()).byteLength; // Counted, never saved.
    samples.push({ coverArt: a.coverArt, album: a.name, status: res.status, contentType: res.headers.get('content-type'), bytes, ms: Date.now() - t0 });
  }
  const result = { samples, missingCoverArt: albums.filter((a) => !a.coverArt).length, note: 'getCoverArt needs credentials; a public catalog cannot reference these URLs directly.' };
  writeOut('art.json', result);
  log('art:', result);
}

// Local private player: the browser only talks to 127.0.0.1; credentials are added here, server-side.
export async function startPlayer(
  client: Pick<ReturnType<typeof createClient>, 'raw'>, songId: string, port = 4173, say: (...p: unknown[]) => void = log,
): Promise<Server> {
  const streamPath = `/stream/${encodeURIComponent(songId)}`;
  const label = songId.replace(/[<>&"]/g, '');
  const page = `<!doctype html><meta charset="utf-8"><title>Probe player</title>
<body style="font-family:system-ui;padding:2rem"><p>Subsonic probe: song ${label}</p>
<audio controls src="${streamPath}"></audio></body>`;
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') return void res.writeHead(405).end();
      if (req.url === '/') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
      if (req.url !== streamPath) return void res.writeHead(404).end();
      const up = await client.raw('stream', { id: songId }, { headers: req.headers.range ? { range: req.headers.range } : {} });
      const headers: Record<string, string> = {};
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = up.headers.get(h);
        if (v) headers[h] = v;
      }
      say(`stream -> browser: HTTP ${up.status} range ${headers['content-range'] ?? '(none)'} length ${headers['content-length'] ?? '?'}`);
      res.writeHead(up.status, headers);
      if (!up.body) return void res.end();
      const body = Readable.fromWeb(up.body as any);
      res.on('close', () => body.destroy()); // Browser seeked or closed: stop pulling from Bandcamp.
      body.pipe(res);
    } catch (e) {
      say(`player error: ${(e as Error).message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

function findSong(songId: string): any {
  const songs: any[] = [];
  if (existsSync(join(OUT, 'enumerate.json'))) songs.push(...readEnumerate().sampleAlbums.flatMap((a) => asList(a.song)));
  if (existsSync(join(OUT, 'coverage.json'))) {
    const spot = JSON.parse(readFileSync(join(OUT, 'coverage.json'), 'utf8')).spotChecks ?? {};
    songs.push(...Object.values(spot).flatMap((r: any) => asList(r?.songs)));
  }
  return songs.find((s) => String(s.id) === songId);
}

async function stagePlay(cfg: Config, songId: string | undefined): Promise<void> {
  if (!songId) throw new Error('usage: play <songId>');
  const s = findSong(songId);
  log(`song ${songId}: ${s ? `"${s.title}" by ${s.artist}, listed duration ${s.duration}s, size ${s.size ?? 'unknown'}` : 'not in out/ files; duration unknown'}`);
  await startPlayer(liveClient(cfg), songId);
  log('player ready at http://127.0.0.1:4173/ (Ctrl-C to stop)');
}

async function main(args: string[]): Promise<void> {
  const [cmd] = args;
  switch (cmd) {
    case 'auth':
      return stageAuth(loadConfig());
    case 'enumerate':
      return stageEnumerate(loadConfig(), args.includes('--ids-only'));
    case 'art':
      return stageArt(loadConfig());
    case 'play':
      return stagePlay(loadConfig(), args[1]);
    case 'check-secrets': {
      const hits = scanForSecret(OUT, process.env.SUBSONIC_PASSWORD ?? '');
      process.stdout.write(hits.length ? `FAIL: ${hits.join(', ')}\n` : 'PASS\n');
      if (hits.length) process.exitCode = 1;
      return;
    }
    default:
      throw new Error(`unknown subcommand "${cmd ?? ''}"; use auth | enumerate [--ids-only] | art | play <songId> | check-secrets`);
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: Error) => {
    log(`ERROR ${e.message}`);
    process.exitCode = 1;
  });
}
