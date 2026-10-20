import { describe, expect, test } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog, toPublicAlbum } from '../../pipeline/map.ts';
import { danglingCrateRefs, diffCatalogs, writeJsonAtomic } from '../../pipeline/report.ts';

const catalogWith = (ids: number[]) =>
  buildCatalog(ids.map((n) => toPublicAlbum({ id: `a:${n}`, name: `Album ${n}` }, null)!), '2026-10-19T00:00:00.000Z');

describe('diffCatalogs', () => {
  test('with no previous catalog everything is added', () => {
    expect(diffCatalogs(null, catalogWith([1, 2]))).toEqual({ added: ['bandcamp:album:1', 'bandcamp:album:2'], removed: [] });
  });
  test('reports albums that disappeared', () => {
    expect(diffCatalogs(catalogWith([1, 2]), catalogWith([2, 3]))).toEqual({ added: ['bandcamp:album:3'], removed: ['bandcamp:album:1'] });
  });
});

describe('danglingCrateRefs', () => {
  test('finds crate entries pointing at albums no longer in the catalog', () => {
    expect(danglingCrateRefs([{ id: 'staff-picks', records: ['bandcamp:album:1', 'bandcamp:album:2'] }], catalogWith([2])))
      .toEqual([{ crateId: 'staff-picks', recordId: 'bandcamp:album:1' }]);
  });
  test('missing or malformed crates file means nothing to report', () => {
    expect(danglingCrateRefs(null, catalogWith([2]))).toEqual([]);
    expect(danglingCrateRefs({ not: 'an array' }, catalogWith([2]))).toEqual([]);
  });
});

describe('writeJsonAtomic', () => {
  test('replaces the file in one step and leaves no temp files behind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atomic-'));
    const file = join(dir, 'catalog.json');
    await writeJsonAtomic(file, { v: 1 });
    await writeJsonAtomic(file, { v: 2 });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ v: 2 });
    expect(readdirSync(dir)).toEqual(['catalog.json']);
  });
});
