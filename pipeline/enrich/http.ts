// One polite, disk-cached JSON fetcher per enrichment source. Requests are spaced at least
// minIntervalMs apart (retries included), 429/503 back off, 401/403 switch the source off.
// Only status + body are cached (never headers), so credentials can't land on disk.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export class AuthError extends Error {}

type Opts = {
  name: string;
  minIntervalMs: number;
  cacheDir: string;
  headers: () => Record<string, string>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};
export type JsonResult = { status: number; body: unknown; cached: boolean };
const MAX_RETRIES = 3;
const RETRYABLE = new Set([0, 429, 500, 502, 503, 504]);

export function createSourceFetcher(opts: Opts) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => delay(ms).then(() => undefined));
  const stats = { requests: 0, cacheHits: 0, retries: 0, failures: 0 };
  let last = -Infinity;

  async function send(url: string): Promise<Response | null> {
    const wait = last + opts.minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    const headers = opts.headers(); // outside the try: a config error must surface, not be retried as a network error
    last = now();
    stats.requests++;
    try {
      return await fetchImpl(url, { headers });
    } catch {
      return null; // network error: retried like a 503
    }
  }

  /** fresh: always ask the network and never cache the answer (for checks that must see the live response). */
  async function getJson(url: string, { fresh = false } = {}): Promise<JsonResult> {
    const file = join(opts.cacheDir, `${createHash('sha256').update(url).digest('hex')}.json`);
    if (!fresh && existsSync(file)) {
      stats.cacheHits++;
      const hit = JSON.parse(await readFile(file, 'utf8'));
      return { status: hit.status, body: hit.body, cached: true };
    }
    for (let attempt = 0; ; attempt++) {
      const res = await send(url);
      const status = res?.status ?? 0;
      if (status === 401 || status === 403) throw new AuthError(`${opts.name}: credentials rejected (HTTP ${status})`);
      if (RETRYABLE.has(status)) {
        if (attempt >= MAX_RETRIES) {
          stats.failures++;
          return { status, body: null, cached: false };
        }
        stats.retries++;
        const retryAfter = Number(res?.headers.get('retry-after'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt);
        continue;
      }
      let body: unknown = null;
      try {
        body = JSON.parse(await res!.text());
      } catch {
        body = null;
      }
      if (fresh && (status === 200 || status === 404)) return { status, body, cached: false };
      if (status === 200 || status === 404) {
        await mkdir(opts.cacheDir, { recursive: true });
        const tmp = `${file}.tmp-${process.pid}`;
        await writeFile(tmp, JSON.stringify({ url, status, body, fetchedAt: new Date(now()).toISOString() }));
        await rename(tmp, file);
      } else stats.failures++;
      return { status, body, cached: false };
    }
  }

  return { getJson, stats: () => ({ ...stats }) };
}

/** What adapters need from a fetcher (tests pass a fake that serves recorded responses). */
export type SourceFetcher = { getJson(url: string, opts?: { fresh?: boolean }): Promise<JsonResult> };
