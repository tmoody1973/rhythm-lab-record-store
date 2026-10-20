import { describe, expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { embedUrl, fromCompact, toCompact } from '../../src/catalog/ids.ts';
import { genreChips, genreOf } from '../../src/catalog/genres.ts';
import {
  applyQuery, firstIndexForLetter, letterOf, letters, pageCount, pageOf, pageSlice, type Query,
} from '../../src/catalog/query.ts';

let n = 0;
const rec = (artist: string, title: string, genre: string | null = null, kind: 'album' | 'track' = 'album'): PublicAlbum => {
  n++;
  return { id: `bandcamp:${kind}:${n}`, kind, bandcampId: n, title, artist, genre, cover: null, songCount: 1, durationSec: 60 };
};
const base: Query = { q: '', genres: [], crate: null, country: null, sort: 'artist-asc', page: 1 };
const order = (xs: PublicAlbum[]) => xs.map((x) => `${x.artist}/${x.title}`);

describe('ids', () => {
  test('compact form round-trips and rejects junk', () => {
    expect(toCompact('bandcamp:track:45593149')).toBe('t45593149');
    expect(toCompact('bandcamp:album:7')).toBe('a7');
    expect(fromCompact('a7')).toBe('bandcamp:album:7');
    expect(fromCompact('t45593149')).toBe('bandcamp:track:45593149');
    for (const bad of ['x7', 'a7x', 'a', '', 'a-1']) expect(fromCompact(bad)).toBeNull();
    expect(toCompact('nope')).toBeNull();
  });
  test('embed URL uses album= or track= with the site palette', () => {
    expect(embedUrl({ kind: 'track', bandcampId: 45593149 })).toBe(
      'https://bandcamp.com/EmbeddedPlayer/track=45593149/size=large/bgcol=f3efe8/linkcol=364c43/artwork=small/tracklist=false/transparent=true/',
    );
    expect(embedUrl({ kind: 'album', bandcampId: 1 })).toContain('/artwork=small/tracklist=true/');
    expect(embedUrl({ kind: 'album', bandcampId: 1 })).toMatch(/^https:\/\/bandcamp\.com\/EmbeddedPlayer\/album=1\//);
  });
});

describe('genres', () => {
  test('aliases, unknowns and missing genres', () => {
    expect(genreOf('r&b soul')).toEqual({ slug: 'soul-rnb', label: 'Soul / R&B' });
    expect(genreOf('world').label).toBe('Global sounds');
    expect(genreOf('hip hop rap').label).toBe('Hip-hop');
    expect(genreOf(null)).toEqual({ slug: 'unclassified', label: 'Unclassified' });
    expect(genreOf('soundtrack')).toEqual({ slug: 'soundtrack', label: 'Soundtrack' });
  });
  test('chips: big genres visible by count, small ones and Unclassified under More', () => {
    const albums = [
      ...Array.from({ length: 3 }, () => rec('A', 'x', 'jazz')),
      ...Array.from({ length: 2 }, () => rec('A', 'x', 'electronic')),
      rec('A', 'x', 'funk'),
      ...Array.from({ length: 5 }, () => rec('A', 'x', null)),
    ];
    const { visible, more } = genreChips(albums, 2);
    expect(visible.map((g) => [g.slug, g.count])).toEqual([['jazz', 3], ['electronic', 2]]);
    expect(more.map((g) => g.slug)).toEqual(['funk', 'unclassified']);
  });
});

describe('sorting', () => {
  test('artist A–Z: accents, case, numbers, then title, then id', () => {
    const xs = [rec('Ólafur Arnalds', 'b'), rec('beck', 'a'), rec('Björk', 'a'), rec('10cc', 'a'), rec('2Pac', 'a'), rec('Nas', 'b'), rec('Nas', 'a'), rec('Oscar', 'a')];
    const sorted = applyQuery(xs, base, null);
    expect(order(sorted)).toEqual(['2Pac/a', '10cc/a', 'beck/a', 'Björk/a', 'Nas/a', 'Nas/b', 'Ólafur Arnalds/b', 'Oscar/a']);
    expect(order(applyQuery(xs, { ...base, sort: 'artist-desc' }, null))).toEqual(order(sorted).reverse());
  });
  test('equal artist and title fall back to id', () => {
    const [a, b] = [rec('Same', 'Same'), rec('Same', 'Same')];
    expect(applyQuery([b, a], base, null).map((x) => x.id)).toEqual([a!.id, b!.id]);
  });
  test('title A–Z sorts by title then artist', () => {
    const xs = [rec('Zed', 'Alpha'), rec('Amy', 'Beta'), rec('Abe', 'Alpha')];
    expect(order(applyQuery(xs, { ...base, sort: 'title-asc' }, null))).toEqual(['Abe/Alpha', 'Zed/Alpha', 'Amy/Beta']);
  });
});

describe('filtering', () => {
  const jazz = rec('Jeremiah Chiu', 'Edge Conditions', 'jazz');
  const soul = rec('Kadhja Bonet', 'This Love', 'r&b soul', 'track');
  const elec = rec('Waajeed', 'Acts of Love', 'electronic');
  const none = rec('Unknown', 'Mystery', null);
  const all = [jazz, soul, elec, none];
  test('genres combine with OR, search with AND, accent- and case-insensitive', () => {
    expect(applyQuery(all, { ...base, genres: ['jazz', 'soul-rnb'] }, null)).toEqual([jazz, soul]);
    expect(applyQuery(all, { ...base, genres: ['jazz', 'soul-rnb'], q: 'CHIU' }, null)).toEqual([jazz]);
    expect(applyQuery(all, { ...base, q: 'love' }, null)).toEqual([soul, elec]);
    expect(applyQuery([rec('Björk', 'Homogenic')], { ...base, q: 'bjork' }, null)).toHaveLength(1);
  });
  test('Unclassified finds records with no genre', () => {
    expect(applyQuery(all, { ...base, genres: ['unclassified'] }, null)).toEqual([none]);
  });
  test('crate membership narrows the set', () => {
    expect(applyQuery(all, { ...base, crate: 'staff-picks' }, new Set([elec.id]))).toEqual([elec]);
  });
  test('a record never appears twice', () => {
    const r = applyQuery(all, { ...base, genres: ['jazz', 'jazz'] }, null);
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });
});

describe('letters and pages', () => {
  test('letterOf strips accents; digits and symbols are #', () => {
    expect(letterOf('Ólafur')).toBe('O');
    expect(letterOf('2Pac')).toBe('#');
    expect(letterOf('!!!')).toBe('#');
    expect(letterOf('beck')).toBe('B');
  });
  test('jumping to a letter reaches records beyond the first page', () => {
    const xs = [
      ...Array.from({ length: 100 }, (_, i) => rec(`A Artist ${String(i).padStart(3, '0')}`, 't')),
      ...Array.from({ length: 20 }, (_, i) => rec(`M Artist ${i}`, 't')),
    ];
    const sorted = applyQuery(xs, base, null);
    const i = firstIndexForLetter(sorted, 'artist-asc', 'M');
    expect(i).toBe(100);
    expect(pageOf(i)).toBe(3);
    expect(firstIndexForLetter(sorted, 'artist-asc', 'Q')).toBe(-1);
    expect(letters(sorted, 'artist-asc').has('Q')).toBe(false);
    expect(letters(sorted, 'artist-asc').has('M')).toBe(true);
    expect(pageCount(120)).toBe(3);
    expect(pageSlice(sorted, 3)).toHaveLength(24);
  });
});
