import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  redact, assertAllowed, tokenAuth, loadConfig, scanForSecret, createClient, SubsonicError,
  pageAll, fieldCoverage, toCatalogItem, startPlayer,
} from './subsonic-probe.mts';

const cfg = { baseUrl: 'https://x.test/api/subsonic', user: 'tarik', password: 'hunter2' };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const ok = (extra = {}) => json({ 'subsonic-response': { status: 'ok', version: '1.16.1', ...extra } });

test('redact strips credential params and keeps the rest', () => {
  const out = redact('https://x/rest/ping?u=tarik&t=abc&s=def&p=enc:41&apiKey=k&v=1.16.1&f=json');
  assert.match(out, /v=1\.16\.1/);
  assert.match(out, /f=json/);
  for (const bad of ['tarik', 'abc', 'def', 'enc:41', '=k&', '=k$']) assert.doesNotMatch(out, new RegExp(bad));
});

test('assertAllowed refuses write and download endpoints', () => {
  for (const e of ['download', 'createPlaylist', 'updatePlaylist', 'deletePlaylist', 'star', 'unstar', 'scrobble']) {
    assert.throws(() => assertAllowed(e), /not allowed/);
  }
  assert.doesNotThrow(() => assertAllowed('getAlbumList2'));
});

test('assertAllowed gates fallback endpoints', () => {
  assert.throws(() => assertAllowed('getSong'), /fallback/);
  assert.doesNotThrow(() => assertAllowed('getSong', { fallback: true }));
});

test('tokenAuth sends md5(password + salt), never the password', () => {
  const p = tokenAuth('u', 'sesame', 'c19b2d');
  assert.equal(p.get('t'), createHash('md5').update('sesamec19b2d').digest('hex'));
  assert.equal(p.get('s'), 'c19b2d');
  assert.equal(p.get('p'), null);
  assert.match(tokenAuth('u', 'x').get('s')!, /^[0-9a-f]{12}$/);
});

test('loadConfig names the missing variable', () => {
  assert.throws(() => loadConfig({ SUBSONIC_URL: 'https://x' }), /SUBSONIC_USER/);
  assert.throws(() => loadConfig({ SUBSONIC_URL: 'https://x', SUBSONIC_USER: 'a', SUBSONIC_PASSWORD: '' }), /SUBSONIC_PASSWORD/);
});

test('scanForSecret refuses an empty secret', () => {
  assert.throws(() => scanForSecret(tmpdir(), ''), /secret not loaded/);
  assert.throws(() => scanForSecret(tmpdir(), undefined as unknown as string), /secret not loaded/);
});

test('scanForSecret finds files containing the secret', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  writeFileSync(join(dir, 'clean.json'), '{"a":1}');
  assert.deepEqual(scanForSecret(dir, 'hunter2'), []);
  writeFileSync(join(dir, 'leak.log'), 'oops hunter2 here');
  assert.deepEqual(scanForSecret(dir, 'hunter2'), ['leak.log']);
  assert.deepEqual(scanForSecret(join(dir, 'missing'), 'hunter2'), []);
});

test('a 200 response with status failed is a SubsonicError', async () => {
  const c = createClient(cfg, { log: () => {},
    gapMs: 0,
    fetchImpl: async () => json({ 'subsonic-response': { status: 'failed', error: { code: 40, message: 'Wrong username or password' } } }),
  });
  await assert.rejects(c.call('ping'), (e: unknown) => e instanceof SubsonicError && e.code === 40);
});

test('network and non-JSON errors never leak credentials', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('ECONNRESET'); },
    async () => new Response('<html>gateway</html>', { status: 200 }),
  ]) {
    const c = createClient(cfg, { log: () => {}, gapMs: 0, fetchImpl: fetchImpl as typeof fetch });
    await assert.rejects(c.call('ping'), (e: Error) => {
      assert.doesNotMatch(e.message, /hunter2|[?&](t|s|p|u)=/);
      return true;
    });
  }
});

test('429 is retried, repeated 5xx aborts, cap is enforced', async () => {
  let n = 0;
  const flaky = createClient(cfg, { log: () => {},
    gapMs: 0,
    fetchImpl: async () => (n++ === 0 ? new Response('', { status: 429, headers: { 'retry-after': '0' } }) : ok()),
  });
  assert.equal((await flaky.call('ping')).status, 'ok');

  const down = createClient(cfg, { log: () => {}, gapMs: 0, fetchImpl: async () => new Response('', { status: 500 }) });
  await assert.rejects(down.call('ping'), /5\d\d/);

  const capped = createClient(cfg, { log: () => {}, gapMs: 0, cap: 2, fetchImpl: async () => ok() });
  await capped.call('ping');
  await capped.call('ping');
  await assert.rejects(capped.call('ping'), /request cap/);
});

test('client refuses forbidden endpoints before sending anything', async () => {
  let sent = 0;
  const c = createClient(cfg, { log: () => {}, gapMs: 0, fetchImpl: async () => { sent++; return ok(); } });
  await assert.rejects(c.call('createPlaylist'), /not allowed/);
  assert.equal(sent, 0);
});

const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `a${from + i}` }));

test('pageAll walks pages until a short page', async () => {
  const pages = [ids(0, 500), ids(500, 500), ids(1000, 296)];
  const r = await pageAll(async (offset) => pages[offset / 500] ?? [], 500, (x) => x.id);
  assert.equal(r.items.length, 1296);
  assert.equal(r.pages, 3);
  assert.equal(r.stoppedBy, 'short-page');
  assert.deepEqual(r.duplicates, []);
});

test('pageAll reports IDs repeated across pages', async () => {
  const pages = [ids(0, 500), [{ id: 'a7' }, ...ids(500, 10)]];
  const r = await pageAll(async (offset) => pages[offset / 500] ?? [], 500, (x) => x.id);
  assert.deepEqual(r.duplicates, ['a7']);
});

test('pageAll marks a cap stop as partial, not complete', async () => {
  const r = await pageAll(async (offset) => {
    if (offset > 0) throw new Error('request cap of 400 reached');
    return ids(0, 500);
  }, 500, (x) => x.id);
  assert.equal(r.stoppedBy, 'cap');
  assert.equal(r.items.length, 500);
});

test('pageAll records other errors as stoppedBy error', async () => {
  const r = await pageAll(async () => { throw new Error('getAlbumList2: HTTP 404'); }, 500, (x: { id: string }) => x.id);
  assert.equal(r.stoppedBy, 'error');
  assert.match(r.error!, /404/);
});

test('fieldCoverage gives percent present and flags link-like values', () => {
  const cov = fieldCoverage([{ id: '1', coverArt: 'a' }, { id: '2' }]);
  assert.equal(cov.coverArt.pct, 50);
  assert.equal(cov.id.pct, 100);
  assert.equal(cov.id.flagged, false);
  assert.equal(fieldCoverage([{ x: 'https://foo.bandcamp.com' }]).x.flagged, true);
  assert.equal(fieldCoverage([{ y: 1122227494 }]).y.flagged, true);
});

test('toCatalogItem namespaces the id and keeps artwork as an ID, not a URL', () => {
  const item = toCatalogItem({ id: 'al-9', name: 'Edge Conditions', artist: 'A', coverArt: 'c9', year: 2024 });
  assert.equal(item.id, 'bandcamp-subsonic:album:al-9');
  assert.equal(item.source, 'bandcamp-subsonic');
  assert.equal(item.sourceId, 'al-9');
  assert.equal(item.kind, 'album');
  assert.equal(item.title, 'Edge Conditions');
  assert.equal(item.artworkRef, 'c9');
  assert.equal(item.membership, 'collection');
  assert.doesNotMatch(JSON.stringify(item), /http/);
});

test('startPlayer serves only the chosen song, on 127.0.0.1, without autoplay', async () => {
  const calls: { endpoint: string; id?: string; range: string | null }[] = [];
  const fake = {
    raw: async (endpoint: string, params: Record<string, string>, init: RequestInit = {}) => {
      calls.push({ endpoint, id: params.id, range: new Headers(init.headers).get('range') });
      return new Response('abc', { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-length': '3', 'content-range': 'bytes 0-2/9' } });
    },
  };
  const server = await startPlayer(fake as any, 't:1', 0, () => {});
  try {
    const { address, port } = server.address() as import('node:net').AddressInfo;
    assert.equal(address, '127.0.0.1');
    const base = `http://127.0.0.1:${port}`;
    const page = await (await fetch(`${base}/`)).text();
    assert.match(page, /<audio controls src="\/stream\/t%3A1">/);
    assert.doesNotMatch(page, /autoplay/);

    const s = await fetch(`${base}/stream/t%3A1`, { headers: { range: 'bytes=0-2' } });
    assert.equal(s.status, 206);
    assert.equal(s.headers.get('content-type'), 'audio/mpeg');
    assert.equal(s.headers.get('content-range'), 'bytes 0-2/9');
    assert.equal(await s.text(), 'abc');
    assert.deepEqual(calls, [{ endpoint: 'stream', id: 't:1', range: 'bytes=0-2' }]);

    assert.equal((await fetch(`${base}/stream/other`)).status, 404);
    assert.equal(calls.length, 1);
  } finally {
    server.close();
  }
});

test('loadConfig only accepts the https Bandcamp Subsonic URL', () => {
  const env = { SUBSONIC_USER: 'a', SUBSONIC_PASSWORD: 'b' };
  for (const bad of ['bandcamp.com/api/subsonic', 'http://bandcamp.com/api/subsonic', 'https://evil.test/api/subsonic']) {
    assert.throws(() => loadConfig({ ...env, SUBSONIC_URL: bad }), /SUBSONIC_URL/);
  }
  assert.equal(loadConfig({ ...env, SUBSONIC_URL: 'https://bandcamp.com/api/subsonic/' }).baseUrl, 'https://bandcamp.com/api/subsonic');
});

test('errors that echo a scheme-less URL still never leak credentials', async () => {
  for (const auth of ['token', 'enc'] as const) {
    const c = createClient(cfg, {
      log: () => {}, gapMs: 0, auth,
      fetchImpl: (async (url: string) => { throw new TypeError(`Failed to parse URL from ${String(url).replace('https://', '')}`); }) as unknown as typeof fetch,
    });
    await assert.rejects(c.call('ping'), (e: Error) => {
      assert.doesNotMatch(e.message, /hunter2|68756e74657232|[?&](t|s|p|u)=/);
      return true;
    });
  }
});

test('scanForSecret also catches the hex-encoded password and token/salt params', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan2-'));
  writeFileSync(join(dir, 'hex.log'), 'p=enc:68756e74657232');
  writeFileSync(join(dir, 'token.log'), 'ping?v=1&t=0123abcd&s=9f9f9f');
  writeFileSync(join(dir, 'clean.json'), '{"title":"Songs & stories","size":6070104}');
  assert.deepEqual(scanForSecret(dir, 'hunter2'), ['hex.log', 'token.log']);
});

test('the client logs the destination host when a response was redirected', async () => {
  const lines: string[] = [];
  const res = new Response('img', { status: 200, headers: { 'content-type': 'image/jpeg' } });
  Object.defineProperty(res, 'redirected', { value: true });
  Object.defineProperty(res, 'url', { value: 'https://cdn.example/img/a1.jpg?token=zzz' });
  const c = createClient(cfg, { log: (...p) => lines.push(p.join(' ')), gapMs: 0, fetchImpl: async () => res });
  await c.raw('getCoverArt', { id: 'ca:1' });
  assert.ok(lines.some((l) => /redirected to cdn\.example/.test(l)), lines.join('\n'));
  assert.ok(!lines.some((l) => /zzz/.test(l)));
});
