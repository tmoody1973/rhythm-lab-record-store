import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Catalog, PublicAlbum } from '../../src/catalog/schema.ts';
import { binsBySection, initialOf, sectionOf } from '../../src/shop/sections.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
let n = 0;
export const rec = (artist: string, genre: string | null): PublicAlbum => ({
  id: `bandcamp:album:${++n}`, kind: 'album', bandcampId: n, title: `T${n}`, artist, genre, cover: null, songCount: 10, durationSec: 100,
});

test('every record lands in exactly one section; counts add up', () => {
  const bins = binsBySection(fixture.albums);
  const all = [...bins.values()].flat().flatMap((b) => b.records.map((r) => r.id));
  expect(all).toHaveLength(fixture.albums.length);
  expect(new Set(all).size).toBe(fixture.albums.length);
});

test('no genre → Fresh Crates; unknown genre → Left Field; case-insensitive', () => {
  expect(sectionOf(rec('A', null))).toBe('fresh');
  expect(sectionOf(rec('A', 'Polka'))).toBe('left-field');
  expect(sectionOf(rec('A', 'Hip Hop Rap'))).toBe('hip-hop');
  expect(sectionOf(rec('A', 'ambient'))).toBe('electronic');
});

test('bins hold 48, milk crates 24, A–Z with initial-range labels', () => {
  const jazz = Array.from({ length: 100 }, (_, i) => rec(String.fromCharCode(65 + (i % 26)) + 'x', 'jazz'));
  const fresh = Array.from({ length: 30 }, () => rec('Zed', null));
  const bins = binsBySection([...jazz, ...fresh]);
  expect(bins.get('jazz')!.map((b) => b.records.length)).toEqual([48, 48, 4]);
  expect(bins.get('fresh')!.map((b) => b.records.length)).toEqual([24, 6]);
  expect(bins.get('fresh')![0]!.label).toBe('Z');
  const first = bins.get('jazz')![0]!;
  expect(first.records.map((r) => r.artist)).toEqual([...first.records.map((r) => r.artist)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  expect(first.label).toBe('A–L'); // 100 artists cycling A–Z: ~4 per letter, so 48 run A to L
  expect(binsBySection([rec('2Pac', 'hip hop rap'), rec('Zz', 'hip hop rap')]).get('hip-hop')![0]!.label).toBe('#–Z');
});

test('accented artists file under their letter, not "#"', () => {
  expect(initialOf('Ólafur Arnalds')).toBe('O');
  expect(initialOf('Émilie Simon')).toBe('E');
  expect(initialOf('2Pac')).toBe('#');
  expect(binsBySection([rec('Ólafur Arnalds', 'jazz'), rec('Pz', 'jazz')]).get('jazz')![0]!.label).toBe('O–P');
});
