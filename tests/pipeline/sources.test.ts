import { generateKeyPairSync, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { appleSource, appleToken } from '../../pipeline/enrich/apple.ts';
import { discogsSource } from '../../pipeline/enrich/discogs.ts';
import { gate } from '../../pipeline/enrich/match.ts';
import { musicbrainzSource } from '../../pipeline/enrich/musicbrainz.ts';

const fx = (name: string) => JSON.parse(readFileSync(`tests/fixtures/enrich/${name}.json`, 'utf8'));
// A full purchase of the album (22 tracks) so the track-count signal applies.
const universal: PublicAlbum = {
  id: 'bandcamp:album:1', kind: 'album', bandcampId: 1, title: 'Universal Beings', artist: 'Makaya McCraven',
  genre: 'jazz', cover: null, songCount: 22, durationSec: 4800,
};

/** A fetcher that serves recorded fixtures by URL pattern and remembers what was asked. */
function recorded(routes: [RegExp, string][]) {
  const asked: string[] = [];
  return {
    asked,
    getJson: async (url: string) => {
      asked.push(url);
      const hit = routes.find(([re]) => re.test(url));
      return hit ? { status: 200, body: fx(hit[1]), cached: false } : { status: 404, body: null, cached: false };
    },
    stats: () => ({ requests: asked.length, cacheHits: 0, retries: 0, failures: 0 }),
  };
}

describe('appleToken', () => {
  test('is an ES256 JWT with kid, iss, iat, exp and a valid signature', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const token = appleToken('TEAMID1234', 'KEYID56789', pem, 1_800_000_000);
    const [h, c, sig] = token.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEYID56789' });
    expect(JSON.parse(Buffer.from(c!, 'base64url').toString())).toEqual({ iss: 'TEAMID1234', iat: 1_800_000_000, exp: 1_800_003_600 });
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'))).toBe(true);
  });
});

describe('adapters on recorded responses', () => {
  test('Apple: album search gives label, release date and track count', async () => {
    const f = recorded([[/\/catalog\/us\/search/, 'apple-albums']]);
    const best = (await appleSource(f).candidates(universal))[0]!;
    expect(best).toMatchObject({ source: 'apple', artist: 'Makaya McCraven', title: 'Universal Beings', trackCount: 22 });
    expect(best.fields).toMatchObject({ label: 'International Anthem', releaseDate: '2018-10-26' });
    expect(f.asked[0]).toContain('types=albums');
  });

  test('MusicBrainz: search, then release and artist lookups for the best match', async () => {
    const f = recorded([[/\/ws\/2\/release\?/, 'musicbrainz-search'], [/\/ws\/2\/release\/[0-9a-f-]+\?/, 'musicbrainz-release'], [/\/ws\/2\/artist\//, 'musicbrainz-artist']]);
    const [best] = await musicbrainzSource(f).candidates(universal);
    expect(best).toMatchObject({ source: 'musicbrainz', artist: 'Makaya McCraven', title: 'Universal Beings', trackCount: 22 });
    expect(best!.fields).toMatchObject({ label: 'International Anthem Recording Co.', catalogNumber: 'IARC 0022', releaseDate: '2018-10-26', artistCountry: 'US', artistArea: 'Chicago' });
    expect(best!.fields.bandcampUrl).toBeUndefined(); // this release lists no Bandcamp link
    expect(f.asked[0]).toContain(encodeURIComponent('release:"Universal Beings" AND artist:"Makaya McCraven"'));
  });

  test('Discogs: master search → master → main release (the original edition)', async () => {
    const f = recorded([[/type=master/, 'discogs-master-search'], [/\/masters\/\d+/, 'discogs-master'], [/\/releases\/12716187/, 'discogs-main-release']]);
    const [best] = await discogsSource(f).candidates(universal);
    expect(best).toMatchObject({ source: 'discogs', artist: 'Makaya McCraven', title: 'Universal Beings', trackCount: 22 });
    expect(best!.fields).toMatchObject({ label: 'International Anthem Recording Company', catalogNumber: 'IARC0022', releaseDate: '2018-10-26' });
  });

  test('all three together publish one clean label', async () => {
    const apple = await appleSource(recorded([[/search/, 'apple-albums']])).candidates(universal);
    const mb = await musicbrainzSource(recorded([[/\/ws\/2\/release\?/, 'musicbrainz-search'], [/\/ws\/2\/release\/[0-9a-f-]+\?/, 'musicbrainz-release'], [/\/ws\/2\/artist\//, 'musicbrainz-artist']])).candidates(universal);
    const dc = await discogsSource(recorded([[/type=master/, 'discogs-master-search'], [/\/masters\/\d+/, 'discogs-master'], [/\/releases\/12716187/, 'discogs-main-release']])).candidates(universal);
    const { published } = gate(universal, [apple[0]!, mb[0]!, dc[0]!]);
    expect(published).toMatchObject({ label: 'International Anthem', releaseDate: '2018-10-26', artistCountry: 'US', artistArea: 'Chicago' });
  });

  test('no match anywhere gives no candidates, not an error', async () => {
    expect(await musicbrainzSource(recorded([])).candidates(universal)).toEqual([]);
    expect(await discogsSource(recorded([])).candidates(universal)).toEqual([]);
    expect(await appleSource(recorded([])).candidates(universal)).toEqual([]);
  });
});

test('Discogs label numbering like "Brainfeeder (2)" is stripped', async () => {
  const main = { ...fx('discogs-main-release'), labels: [{ name: 'Brainfeeder (2)', catno: 'BF123' }] };
  const f = {
    getJson: async (url: string) => ({
      status: 200, cached: false,
      body: /type=master/.test(url) ? fx('discogs-master-search') : /\/masters\//.test(url) ? fx('discogs-master') : main,
    }),
  };
  const [best] = await discogsSource(f).candidates(universal);
  expect(best!.fields.label).toBe('Brainfeeder');
});
