import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { EnrichmentFileSchema } from '../../src/catalog/enrichment.ts';
import { AuthError } from '../../pipeline/enrich/http.ts';
import type { Candidate } from '../../pipeline/enrich/match.ts';
import { pilotSample, runEnrichment, writeBlocker, writeOutputs, type EnrichSource } from '../../pipeline/enrich/run.ts';

const rec = (n: number, songCount: number, kind: 'album' | 'track' = 'album'): PublicAlbum => ({
  id: `bandcamp:${kind}:${n}`, kind, bandcampId: n, title: `Title ${n}`, artist: `Artist ${n}`, genre: null, cover: null, songCount, durationSec: 100,
});
const catalog = [...Array.from({ length: 60 }, (_, i) => rec(i + 1, 1)), ...Array.from({ length: 60 }, (_, i) => rec(i + 101, 10))];
const hit = (source: Candidate['source'], r: PublicAlbum, fields: Candidate['fields']): Candidate =>
  ({ source, artist: r.artist, title: r.title, trackCount: r.songCount, fields });
const source = (name: EnrichSource['name'], f: (r: PublicAlbum) => Candidate[] | Promise<Candidate[]>) => {
  let calls = 0;
  const s: EnrichSource & { calls: () => number } = { name, candidates: async (r) => { calls++; return f(r); }, calls: () => calls };
  return s;
};

describe('pilotSample', () => {
  test('is deterministic, with 25 one-song and 25 multi-song records', () => {
    const a = pilotSample(catalog);
    expect(pilotSample(catalog)).toEqual(a);
    expect(a.filter((r) => r.songCount === 1)).toHaveLength(25);
    expect(a.filter((r) => r.songCount > 1)).toHaveLength(25);
  });
});

describe('runEnrichment', () => {
  const multi = catalog.slice(60, 63);

  test('a source with bad credentials is switched off; the others still publish', async () => {
    const apple = source('apple', () => { throw new AuthError('apple: credentials rejected (HTTP 401)'); });
    const discogs = source('discogs', (r) => [hit('discogs', r, { label: 'Label X' })]);
    const out = await runEnrichment(multi, [apple, discogs], {}, () => {});
    expect(apple.calls()).toBe(1);
    expect(out.stats.disabled).toEqual(['apple']);
    expect(Object.values(out.file.entries).map((e) => e.label)).toEqual(['Label X', 'Label X', 'Label X']);
  });

  test('disagreeing sources go to the review list, not the published file', async () => {
    const a = source('apple', (r) => [hit('apple', r, { label: 'A' })]);
    const b = source('discogs', (r) => [hit('discogs', r, { label: 'B' })]);
    const out = await runEnrichment(multi.slice(0, 1), [a, b], {}, () => {});
    expect(out.file.entries).toEqual({});
    expect(out.review).toEqual([{ record: multi[0], entries: [{ field: 'label', values: [{ source: 'apple', value: 'A' }, { source: 'discogs', value: 'B' }] }] }]);
  });

  test('other errors from a source are counted, not fatal', async () => {
    const flaky = source('musicbrainz', () => { throw new Error('socket hang up'); });
    const ok = source('discogs', (r) => [hit('discogs', r, { label: 'L' })]);
    const out = await runEnrichment(multi, [flaky, ok], {}, () => {});
    expect(out.stats.errors).toEqual({ musicbrainz: 3 });
    expect(Object.keys(out.file.entries)).toHaveLength(3);
  });
});

describe('writeOutputs', () => {
  test('writes atomically, merges with the previous file, and never touches overrides', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'enrich-out-'));
    const overrides = join(dir, 'overrides.json');
    writeFileSync(overrides, '{ "bandcamp:album:7": { "label": null } }\n');
    const before = readFileSync(overrides, 'utf8');
    const first = { schemaVersion: 1 as const, generatedAt: 't1', entries: { 'bandcamp:album:1': { label: 'Old', sources: ['discogs' as const] } } };
    await writeOutputs({ file: first, review: [], processed: ['bandcamp:album:1'] }, dir);
    const second = { schemaVersion: 1 as const, generatedAt: 't2', entries: { 'bandcamp:album:2': { label: 'New', sources: ['apple' as const] } } };
    await writeOutputs({ file: second, review: [], processed: ['bandcamp:album:2'] }, dir);
    const written = EnrichmentFileSchema.parse(JSON.parse(readFileSync(join(dir, 'enrichment.json'), 'utf8')));
    expect(Object.keys(written.entries).sort()).toEqual(['bandcamp:album:1', 'bandcamp:album:2']);
    expect(readFileSync(overrides, 'utf8')).toBe(before);
    expect(readdirSync(dir).filter((f) => f.includes('.tmp-'))).toEqual([]);
  });
});

describe('writeBlocker', () => {
  test('a run with every source healthy may write', () => {
    expect(writeBlocker({ disabled: [] }, null)).toBeNull();
  });
  test('a run where a source was switched off, or limited with --only, must not overwrite published data', () => {
    expect(writeBlocker({ disabled: ['apple'] }, null)).toMatch(/apple/);
    expect(writeBlocker({ disabled: [] }, 'discogs')).toMatch(/--only/);
  });
});
