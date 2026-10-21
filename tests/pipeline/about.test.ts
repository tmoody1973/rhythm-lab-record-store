import { expect, test } from 'vitest';
import { findPageUrl, isRedirectLoop, parseAboutPage } from '../../pipeline/about.ts';

const page = (ld: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><div class="tralbum-about">x</div></body></html>`;

test('reads description, credits and tags from the album page JSON-LD', () => {
  const about = parseAboutPage(page({
    '@type': 'MusicAlbum',
    description: '  First paragraph.\n\nSecond paragraph.  ',
    creditText: 'Mixed by Dave.\nMastered by David.',
    keywords: ['Electronic', 'Jazz', 'jazz', ' Chicago '],
  }));
  expect(about).toEqual({
    description: 'First paragraph.\n\nSecond paragraph.',
    credits: 'Mixed by Dave.\nMastered by David.',
    tags: ['electronic', 'jazz', 'chicago'],
  });
});

test('leaves out what the page does not have', () => {
  expect(parseAboutPage(page({ '@type': 'MusicAlbum', description: '   ', keywords: 'not-an-array' }))).toEqual({});
});

test('a page without JSON-LD, or with broken JSON-LD, gives nothing rather than a guess', () => {
  expect(parseAboutPage('<html><body>no data</body></html>')).toBeNull();
  expect(parseAboutPage('<script type="application/ld+json">{oops</script>')).toBeNull();
});

test('caps very long text and very many tags', () => {
  const about = parseAboutPage(page({ description: 'a'.repeat(30_000), keywords: Array.from({ length: 50 }, (_, i) => `t${i}`) }))!;
  expect(about.description).toHaveLength(20_000);
  expect(about.tags).toHaveLength(30);
});

test("finds the record's own page link in the player page, matching album or track", () => {
  const html = 'x https://bandcamp.com/foo https://intlanthem.bandcamp.com/track/way-in y https://intlanthem.bandcamp.com/album/edge-conditions?from=embed';
  expect(findPageUrl(html, 'album')).toBe('https://intlanthem.bandcamp.com/album/edge-conditions');
  expect(findPageUrl(html, 'track')).toBe('https://intlanthem.bandcamp.com/track/way-in');
  expect(findPageUrl('nothing here', 'album')).toBeNull();
});

test('a redirect loop (a page that wants cookies) is an answer, not a network error to retry', () => {
  expect(isRedirectLoop(new TypeError('fetch failed', { cause: new Error('redirect count exceeded') }))).toBe(true);
  expect(isRedirectLoop(new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') }))).toBe(false);
  expect(isRedirectLoop('nope')).toBe(false);
});
