import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { AuthError, createSourceFetcher } from '../../pipeline/enrich/http.ts';

function harness(replies: (Response | (() => Response))[]) {
  let clock = 1_000_000;
  const calls: { url: string; at: number; auth: string | null }[] = [];
  const slept: number[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, at: clock, auth: new Headers(init?.headers).get('authorization') });
    const r = replies.shift() ?? new Response('{}', { status: 200 });
    return typeof r === 'function' ? r() : r;
  }) as unknown as typeof fetch;
  const cacheDir = mkdtempSync(join(tmpdir(), 'enrich-cache-'));
  const fetcher = createSourceFetcher({
    name: 'test', minIntervalMs: 1100, cacheDir, fetchImpl,
    headers: () => ({ Authorization: 'Discogs key=SECRETKEY, secret=SECRETSECRET' }),
    now: () => clock,
    sleep: async (ms) => { slept.push(ms); clock += ms; },
  });
  return { fetcher, calls, slept, cacheDir };
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('createSourceFetcher', () => {
  test('spaces requests at least minIntervalMs apart', async () => {
    const h = harness([ok({ a: 1 }), ok({ b: 2 })]);
    await h.fetcher.getJson('https://api.test/a');
    await h.fetcher.getJson('https://api.test/b');
    expect(h.calls[1]!.at - h.calls[0]!.at).toBeGreaterThanOrEqual(1100);
  });

  test('429 waits Retry-After, and the retry still respects the interval', async () => {
    const h = harness([new Response('', { status: 429, headers: { 'retry-after': '2' } }), ok({ fine: true })]);
    const r = await h.fetcher.getJson('https://api.test/x');
    expect(r).toEqual({ status: 200, body: { fine: true }, cached: false });
    expect(h.slept).toContain(2000);
    expect(h.calls[1]!.at - h.calls[0]!.at).toBeGreaterThanOrEqual(2000);
    expect(h.fetcher.stats().retries).toBe(1);
  });

  test('three 503s give up on that request without throwing', async () => {
    const h = harness([503, 503, 503, 503].map((s) => new Response('', { status: s })));
    expect(await h.fetcher.getJson('https://api.test/down')).toMatchObject({ status: 503 });
    expect(h.fetcher.stats().failures).toBe(1);
    expect(h.calls).toHaveLength(4); // first try + 3 retries
  });

  test('cached responses are reused without a network call', async () => {
    const h = harness([ok({ v: 1 })]);
    await h.fetcher.getJson('https://api.test/c');
    const again = await h.fetcher.getJson('https://api.test/c');
    expect(again).toEqual({ status: 200, body: { v: 1 }, cached: true });
    expect(h.calls).toHaveLength(1);
    expect(h.fetcher.stats()).toMatchObject({ requests: 1, cacheHits: 1 });
  });

  test('404 is cached too, so a known miss is not asked again', async () => {
    const h = harness([new Response('{"message":"not found"}', { status: 404 })]);
    await h.fetcher.getJson('https://api.test/none');
    expect((await h.fetcher.getJson('https://api.test/none')).cached).toBe(true);
  });

  test('401/403 throw AuthError so the run can switch the source off', async () => {
    const h = harness([new Response('', { status: 401 })]);
    await expect(h.fetcher.getJson('https://api.test/auth')).rejects.toBeInstanceOf(AuthError);
  });

  test('credentials are sent but never written to the cache', async () => {
    const h = harness([ok({ v: 1 })]);
    await h.fetcher.getJson('https://api.test/s');
    expect(h.calls[0]!.auth).toContain('SECRETKEY');
    const files = readdirSync(h.cacheDir);
    expect(files.filter((f) => f.includes('.tmp-'))).toEqual([]);
    for (const f of files) expect(readFileSync(join(h.cacheDir, f), 'utf8')).not.toMatch(/SECRET/);
  });
});
