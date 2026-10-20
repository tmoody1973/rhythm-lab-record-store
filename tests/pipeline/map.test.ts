import { describe, expect, test } from 'vitest';
import { CatalogSchema } from '../../src/catalog/schema.ts';
import { buildCatalog, parseTaggedId, recordKey, toPublicAlbum } from '../../pipeline/map.ts';

const edge = {
  id: 'a:3274104668', name: 'Edge Conditions', artist: 'Jeremiah Chiu', artistId: 'b:2239178',
  genre: 'jazz', songCount: 11, duration: 2541, coverArt: 'ca:3951378974', created: '09 Oct 2026', playCount: 0,
};

describe('parseTaggedId', () => {
  test('reads the number behind a matching tag', () => {
    expect(parseTaggedId('a:3274104668', 'a')).toBe(3274104668);
    expect(parseTaggedId('ca:12', 'ca')).toBe(12);
  });
  test('rejects other tags, junk and missing values', () => {
    expect(parseTaggedId('ca:12', 'a')).toBeNull();
    expect(parseTaggedId('a:12x', 'a')).toBeNull();
    expect(parseTaggedId(undefined, 'b')).toBeNull();
    expect(parseTaggedId(12, 'a')).toBeNull();
  });
});

describe('toPublicAlbum', () => {
  test('maps a Subsonic album to the public shape and drops everything else', () => {
    expect(toPublicAlbum(edge, null)).toEqual({
      id: 'bandcamp:album:3274104668', kind: 'album', bandcampId: 3274104668, title: 'Edge Conditions', artist: 'Jeremiah Chiu',
      artistKey: 'b:2239178', genre: 'jazz', cover: null, songCount: 11, durationSec: 2541,
    });
  });
  test('missing or empty genre becomes null', () => {
    expect(toPublicAlbum({ ...edge, genre: undefined }, null)?.genre).toBeNull();
    expect(toPublicAlbum({ ...edge, genre: '' }, null)?.genre).toBeNull();
  });
  test('a single-track purchase (t: id) becomes a track record', () => {
    const t = toPublicAlbum({ id: 't:45593149', name: 'This Love', artist: 'Kadhja Bonet', songCount: 1, duration: 164 }, null);
    expect(t?.id).toBe('bandcamp:track:45593149');
    expect(t?.kind).toBe('track');
    expect(t?.bandcampId).toBe(45593149);
  });
  test('recordKey names cover files by kind so album and track numbers never collide', () => {
    expect(recordKey('a:7')).toBe('album-7');
    expect(recordKey('t:7')).toBe('track-7');
    expect(recordKey('b:7')).toBeNull();
  });
  test('unusable id or missing title gives null, not a broken record', () => {
    expect(toPublicAlbum({ id: 'x:1', name: 'A' }, null)).toBeNull();
    expect(toPublicAlbum({ id: 'a:1' }, null)).toBeNull();
  });
});

describe('buildCatalog', () => {
  const a = toPublicAlbum({ ...edge, id: 'a:2', name: 'B' }, null)!;
  const b = toPublicAlbum({ ...edge, id: 'a:1', name: 'A' }, null)!;
  const catalog = buildCatalog([a, b], '2026-10-19T00:00:00.000Z');

  test('sorts by id, counts, and passes the schema', () => {
    expect(catalog.albums.map((x) => x.id)).toEqual(['bandcamp:album:1', 'bandcamp:album:2']);
    expect(catalog.count).toBe(2);
    expect(() => CatalogSchema.parse(catalog)).not.toThrow();
  });
  test('contains nothing that looks like a Subsonic URL or credential', () => {
    expect(JSON.stringify(catalog)).not.toMatch(/api\/subsonic|\/rest\/|[?&][utsp]=/);
  });
});
