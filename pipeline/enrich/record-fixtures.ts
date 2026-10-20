// One-off: record one real response per enrichment endpoint so the adapters are built on real shapes.
// node --env-file=.env.local pipeline/enrich/record-fixtures.ts
// Writes response bodies only (no headers, no credentials) to tests/fixtures/enrich/.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { APPLE_BASE, appleToken } from './apple.ts';
import { createSourceFetcher } from './http.ts';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.local`);
  return v;
};
const OUT = 'tests/fixtures/enrich';
const save = async (name: string, body: unknown) => {
  await writeFile(`${OUT}/${name}.json`, JSON.stringify(body, null, 2) + '\n');
  process.stdout.write(`saved ${name}.json\n`);
};
await mkdir(OUT, { recursive: true });
const q = encodeURIComponent;

// Apple Music
const token = appleToken(env('APPLE_TEAM_ID'), env('APPLE_KEY_ID'), readFileSync(env('APPLE_PRIVATE_KEY_PATH'), 'utf8'), Math.floor(Date.now() / 1000));
const apple = createSourceFetcher({ name: 'apple', minIntervalMs: 250, cacheDir: 'data/.cache/enrich/apple', headers: () => ({ Authorization: `Bearer ${token}` }) });
const test = await apple.getJson(`${APPLE_BASE}/test`);
process.stdout.write(`apple /v1/test → HTTP ${test.status}\n`);
await save('apple-albums', (await apple.getJson(`${APPLE_BASE}/catalog/us/search?types=albums&limit=5&term=${q('Makaya McCraven Universal Beings')}`)).body);

// MusicBrainz
const mb = createSourceFetcher({
  name: 'musicbrainz', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/musicbrainz',
  headers: () => ({ 'User-Agent': `RhythmLabRecordStore/0.1 ( ${env('MUSICBRAINZ_CONTACT')} )`, Accept: 'application/json' }),
});
const mbSearch = (await mb.getJson(`https://musicbrainz.org/ws/2/release?fmt=json&limit=3&query=${q('release:"Universal Beings" AND artist:"Makaya McCraven"')}`)).body as any;
await save('musicbrainz-search', mbSearch);
const mbId = mbSearch?.releases?.[0]?.id;
const mbRelease = (await mb.getJson(`https://musicbrainz.org/ws/2/release/${mbId}?fmt=json&inc=labels+url-rels+artist-credits+recordings`)).body as any;
await save('musicbrainz-release', mbRelease);
const artistId = mbRelease?.['artist-credit']?.[0]?.artist?.id;
await save('musicbrainz-artist', (await mb.getJson(`https://musicbrainz.org/ws/2/artist/${artistId}?fmt=json`)).body);

// Discogs
const discogs = createSourceFetcher({
  name: 'discogs', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/discogs',
  headers: () => ({ Authorization: `Discogs key=${env('DISCOGS_KEY')}, secret=${env('DISCOGS_SECRET')}`, 'User-Agent': 'RhythmLabRecordStore/0.1' }),
});
const dSearch = (await discogs.getJson(`https://api.discogs.com/database/search?type=release&per_page=5&artist=${q('Makaya McCraven')}&release_title=${q('Universal Beings')}`)).body as any;
await save('discogs-search', dSearch);
await save('discogs-release', (await discogs.getJson(`https://api.discogs.com/releases/${dSearch?.results?.[0]?.id}`)).body);

// Discogs masters: one entry per album; the master's main_release is the original edition.
const mSearch = (await discogs.getJson(`https://api.discogs.com/database/search?type=master&per_page=5&artist=${q('Makaya McCraven')}&release_title=${q('Universal Beings')}`)).body as any;
await save('discogs-master-search', mSearch);
const master = (await discogs.getJson(`https://api.discogs.com/masters/${mSearch?.results?.[0]?.id}`)).body as any;
await save('discogs-master', master);
await save('discogs-main-release', (await discogs.getJson(`https://api.discogs.com/releases/${master?.main_release}`)).body);

for (const [n, f] of Object.entries({ apple, mb, discogs })) process.stdout.write(`${n}: ${JSON.stringify(f.stats())}\n`);
