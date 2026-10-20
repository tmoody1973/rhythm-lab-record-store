import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '../../src/catalog/load.ts';
import { DEFAULT_STATE, parseUrl, toSearch, type UrlState } from '../../src/state/url.ts';

describe('URL state', () => {
  test('every field round-trips', () => {
    const s: UrlState = { q: 'chiu', genres: ['jazz', 'soul-rnb'], crate: 'staff-picks', country: 'GB', sort: 'title-desc', page: 3, record: 't45593149', shared: 'eyJu', view: 'store' };
    expect(parseUrl(toSearch(s))).toEqual(s);
  });
  test('defaults produce an empty query string and invalid values fall back', () => {
    expect(toSearch(DEFAULT_STATE)).toBe('');
    expect(parseUrl('?sort=bogus&page=-3&genre=jazz,%3Cscript%3E&crate=Bad%20Crate')).toEqual({ ...DEFAULT_STATE, genres: ['jazz'] });
  });
  test('a record param is kept as given so the UI can explain a bad link', () => {
    expect(parseUrl('?record=zzz').record).toBe('zzz');
    expect(parseUrl(`?record=${'a'.repeat(40)}`).record).toBeNull();
  });
});

describe('loadCatalog', () => {
  const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
  const fakeFetch = (res: Response | Error) => (async () => { if (res instanceof Error) throw res; return res; }) as unknown as typeof fetch;

  test('the fixture loads', async () => {
    const r = await loadCatalog(fakeFetch(new Response(fixture, { status: 200 })));
    expect(r.ok && r.catalog.count).toBe(20);
  });
  test('missing, broken and offline catalogs are told apart', async () => {
    expect(await loadCatalog(fakeFetch(new Response('', { status: 404 })))).toEqual({ ok: false, reason: 'missing' });
    // Dev servers and SPA hosts answer a missing file with index.html and status 200.
    expect(await loadCatalog(fakeFetch(new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })))).toEqual({ ok: false, reason: 'missing' });
    expect(await loadCatalog(fakeFetch(new Response('<html>', { status: 200 })))).toEqual({ ok: false, reason: 'invalid' });
    expect(await loadCatalog(fakeFetch(new Response('{"schemaVersion":2}', { status: 200 })))).toEqual({ ok: false, reason: 'invalid' });
    expect(await loadCatalog(fakeFetch(new TypeError('Failed to fetch')))).toEqual({ ok: false, reason: 'network' });
  });
});
