import { expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import type { TarikCrate } from '../../src/crates/curation.ts';
import { staffPicks } from '../../src/shop/staffPicks.ts';

const rec = (n: number): PublicAlbum => ({ id: `bandcamp:album:${n}`, kind: 'album', bandcampId: n, title: `T${n}`, artist: 'A', genre: null, cover: null, songCount: 1, durationSec: 1 });
const byId = new Map([1, 2, 3].map((n) => [`bandcamp:album:${n}`, rec(n)]));
const crate = (records: string[]): TarikCrate => ({ id: 'staff-picks', name: 'Staff picks', note: '', records });

test('no staff-picks crate → no picks', () => {
  expect(staffPicks([], byId)).toEqual([]);
  expect(staffPicks([{ ...crate(['bandcamp:album:1']), id: 'late-night' }], byId)).toEqual([]);
});
test("keeps Tarik's order", () => {
  expect(staffPicks([crate(['bandcamp:album:3', 'bandcamp:album:1'])], byId).map((r) => r.bandcampId)).toEqual([3, 1]);
});
test('records no longer in the catalog are dropped', () => {
  expect(staffPicks([crate(['bandcamp:album:2', 'bandcamp:album:999'])], byId).map((r) => r.bandcampId)).toEqual([2]);
});
