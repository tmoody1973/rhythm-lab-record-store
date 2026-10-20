import { describe, expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { confidence, gate, normalize, type Candidate } from '../../pipeline/enrich/match.ts';

const album: PublicAlbum = {
  id: 'bandcamp:album:1', kind: 'album', bandcampId: 1, title: 'Universal Beings', artist: 'Makaya McCraven',
  genre: 'jazz', cover: null, songCount: 17, durationSec: 4000,
};
const single: PublicAlbum = { ...album, id: 'bandcamp:track:2', kind: 'track', bandcampId: 2, title: 'This Love', artist: 'Kadhja Bonet', songCount: 1 };
const cand = (source: Candidate['source'], over: Partial<Candidate> = {}): Candidate => ({
  source, artist: 'Makaya McCraven', title: 'Universal Beings', trackCount: 17, fields: {}, ...over,
});

describe('normalize', () => {
  test('folds accents, case, punctuation and whitespace', () => {
    expect(normalize('Björk')).toBe('bjork');
    expect(normalize('  Days,  As   Echoes! ')).toBe('days as echoes');
    expect(normalize('Simon & Garfunkel')).toBe(normalize('Simon and Garfunkel'));
  });
  test('drops edition and featuring noise, keeps meaningful brackets', () => {
    expect(normalize('Universal Beings (Remastered)')).toBe('universal beings');
    expect(normalize('Universal Beings [Deluxe Edition]')).toBe('universal beings');
    expect(normalize('Song (feat. X)')).toBe('song');
    expect(normalize('Song feat. X & Y')).toBe('song');
    expect(normalize('Song ft. X')).toBe('song');
    expect(normalize('Days As Echoes – EP')).toBe('days as echoes');
    expect(normalize('Days As Echoes - EP')).toBe('days as echoes');
    expect(normalize("Don't Wanna Be Normal (Sunship Remix)")).toBe('dont wanna be normal sunship remix');
    expect(normalize('EP1')).toBe('ep1');
    expect(normalize('This Love - Single')).toBe('this love');
  });
});

describe('confidence', () => {
  test('exact artist + title + same track count is high', () => {
    expect(confidence(album, cand('discogs'))).toBe('high');
    expect(confidence(album, cand('discogs', { title: 'Universal Beings (Remastered)' }))).toBe('high');
  });
  test('a different edition (track count differs) is only medium', () => {
    expect(confidence(album, cand('discogs', { trackCount: 23 }))).toBe('medium');
    expect(confidence(album, cand('discogs', { trackCount: null }))).toBe('medium');
  });
  test('wrong title or wrong artist is low', () => {
    expect(confidence(album, cand('discogs', { title: 'In The Moment' }))).toBe('low');
    expect(confidence(album, cand('discogs', { artist: 'Someone Else' }))).toBe('low');
  });
  test('a one-song record is never high on its own', () => {
    expect(confidence(single, cand('apple', { artist: 'Kadhja Bonet', title: 'This Love', trackCount: 1 }))).toBe('medium');
  });
});

describe('gate', () => {
  test('one high match publishes its fields', () => {
    const r = gate(album, [cand('discogs', { fields: { label: 'International Anthem', styles: ['Contemporary Jazz'] } })]);
    expect(r.published).toEqual({ label: 'International Anthem', styles: ['Contemporary Jazz'], sources: ['discogs'] });
    expect(r.review).toEqual([]);
  });
  test('two medium matches that agree publish the agreed field only', () => {
    const r = gate(album, [
      cand('apple', { trackCount: 23, fields: { label: 'International Anthem', releaseDate: '2018-10-12' } }),
      cand('musicbrainz', { trackCount: 23, fields: { label: 'Nonesuch' } }),
      cand('discogs', { trackCount: 23, fields: { label: 'international anthem' } }),
    ]);
    expect(r.published).toEqual({ label: 'International Anthem', sources: ['apple', 'discogs'] });
    expect(r.review.map((x) => x.field)).toContain('releaseDate');
  });
  test('label spellings with company words agree, and the shortest spelling is published', () => {
    const r = gate(album, [
      cand('apple', { fields: { label: 'International Anthem' } }),
      cand('musicbrainz', { fields: { label: 'International Anthem Recording Co.' } }),
      cand('discogs', { fields: { label: 'International Anthem Recording Company' } }),
    ]);
    expect(r.published).toEqual({ label: 'International Anthem', sources: ['apple', 'musicbrainz', 'discogs'] });
    expect(r.review).toEqual([]);
  });
  test('sources that disagree publish nothing for that field and go to review', () => {
    const r = gate(album, [
      cand('apple', { fields: { label: 'Label A' } }),
      cand('discogs', { fields: { label: 'Label B' } }),
    ]);
    expect(r.published?.label).toBeUndefined();
    expect(r.review).toContainEqual({ field: 'label', values: [{ source: 'apple', value: 'Label A' }, { source: 'discogs', value: 'Label B' }] });
  });
  test('a one-song record with a single exact match publishes nothing but is reviewed', () => {
    const r = gate(single, [cand('apple', { artist: 'Kadhja Bonet', title: 'This Love', trackCount: 1, fields: { label: 'Fat Possum' } })]);
    expect(r.published).toBeNull();
    expect(r.review).toEqual([{ field: 'label', values: [{ source: 'apple', value: 'Fat Possum' }] }]);
  });
  test('low matches are ignored entirely', () => {
    expect(gate(album, [cand('discogs', { title: 'Nope', fields: { label: 'X' } })])).toEqual({ published: null, review: [] });
  });
  test('overrides win, and null suppresses a field even when sources agree', () => {
    const agreed = [cand('discogs', { fields: { label: 'International Anthem', artistCountry: 'US' } })];
    expect(gate(album, agreed, { label: null })?.published).toEqual({ artistCountry: 'US', sources: ['discogs', 'override'] });
    expect(gate(album, agreed, { label: 'Nonesuch' })?.published).toMatchObject({ label: 'Nonesuch', artistCountry: 'US' });
  });
  test('placeholder catalog numbers like [none] are never published', () => {
    for (const placeholder of ['[none]', 'none', 'N/A', '-', '[no label]']) {
      const r = gate(album, [cand('musicbrainz', { fields: { catalogNumber: placeholder } })]);
      expect(r.published).toBeNull();
    }
    expect(gate(album, [cand('musicbrainz', { fields: { catalogNumber: 'ATH018' } })]).published?.catalogNumber).toBe('ATH018');
  });
  test('a Bandcamp URL that is not on bandcamp.com is never published', () => {
    const r = gate(album, [cand('musicbrainz', { fields: { bandcampUrl: 'https://evil.example/album/x' } })]);
    expect(r.published).toBeNull();
    const ok = gate(album, [cand('musicbrainz', { fields: { bandcampUrl: 'https://intlanthem.bandcamp.com/album/universal-beings' } })]);
    expect(ok.published?.bandcampUrl).toBe('https://intlanthem.bandcamp.com/album/universal-beings');
  });
});
