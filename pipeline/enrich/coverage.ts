// Coverage numbers for docs/ENRICHMENT-COVERAGE.md. Re-asks every source for the same records; with a warm
// cache this makes no network requests. node --env-file=.env.local pipeline/enrich/coverage.ts [--pilot]
import { readFileSync } from 'node:fs';
import { EnrichmentFileSchema } from '../../src/catalog/enrichment.ts';
import { CatalogSchema, type PublicAlbum } from '../../src/catalog/schema.ts';
import { appleSource, appleToken } from './apple.ts';
import { discogsSource } from './discogs.ts';
import { createSourceFetcher } from './http.ts';
import { confidence } from './match.ts';
import { musicbrainzSource } from './musicbrainz.ts';
import { pilotSample } from './run.ts';

const env = (k: string) => process.env[k] ?? '';
const catalog = CatalogSchema.parse(JSON.parse(readFileSync('public/catalog.json', 'utf8')));
const published = EnrichmentFileSchema.parse(JSON.parse(readFileSync('public/enrichment.json', 'utf8'))).entries;
const records = process.argv.includes('--pilot') ? pilotSample(catalog.albums) : catalog.albums;
const token = env('APPLE_KEY_ID') ? appleToken(env('APPLE_TEAM_ID'), env('APPLE_KEY_ID'), readFileSync(env('APPLE_PRIVATE_KEY_PATH'), 'utf8'), Math.floor(Date.now() / 1000)) : '';
const fetchers = {
  apple: createSourceFetcher({ name: 'apple', minIntervalMs: 250, cacheDir: 'data/.cache/enrich/apple', headers: () => ({ Authorization: `Bearer ${token}` }) }),
  musicbrainz: createSourceFetcher({ name: 'musicbrainz', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/musicbrainz', headers: () => ({ 'User-Agent': `RhythmLabRecordStore/0.1 ( ${env('MUSICBRAINZ_CONTACT')} )` }) }),
  discogs: createSourceFetcher({ name: 'discogs', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/discogs', headers: () => ({ Authorization: `Discogs key=${env('DISCOGS_KEY')}, secret=${env('DISCOGS_SECRET')}` }) }),
};
const sources = [appleSource(fetchers.apple), musicbrainzSource(fetchers.musicbrainz), discogsSource(fetchers.discogs)];
const oneSong = (r: PublicAlbum) => r.kind === 'track' || r.songCount === 1;

const rows: Record<string, Record<'one' | 'multi', { high: number; medium: number; none: number }>> = {};
for (const s of sources) rows[s.name] = { one: { high: 0, medium: 0, none: 0 }, multi: { high: 0, medium: 0, none: 0 } };
for (const r of records) {
  for (const s of sources) {
    const [best] = await s.candidates(r);
    const level = best ? confidence(r, best) : 'low';
    rows[s.name]![oneSong(r) ? 'one' : 'multi'][level === 'low' ? 'none' : level]++;
  }
}
const ids = new Set(records.map((r) => r.id));
const entries = Object.entries(published).filter(([id]) => ids.has(id));
const multiSource = entries.filter(([, e]) => e.sources.filter((s) => s !== 'override').length >= 2).length;
const byId = new Map(catalog.albums.map((a) => [a.id, a]));
// Hand-check list: up to 15 published values, spread across fields.
const order = ['label', 'artistCountry', 'bandcampUrl', 'styles', 'catalogNumber', 'releaseDate'] as const;
const checks: { record: string; field: string; value: unknown; sources: string }[] = [];
for (let round = 0; checks.length < 15 && round < 20; round++) {
  for (const field of order) {
    const hits = entries.filter(([, e]) => e[field] !== undefined);
    const pick = hits[round];
    if (pick && checks.length < 15) {
      const r = byId.get(pick[0])!;
      checks.push({ record: `${r.title} — ${r.artist}`, field, value: field === 'artistCountry' ? `${pick[1].artistCountry} (${pick[1].artistArea ?? '?'})` : pick[1][field], sources: pick[1].sources.join('+') });
    }
  }
}
process.stdout.write(JSON.stringify({
  records: records.length, oneSong: records.filter(oneSong).length, multi: records.filter((r) => !oneSong(r)).length,
  publishedRecords: entries.length, multiSourceRecords: multiSource, perSource: rows, checks,
  networkRequests: Object.fromEntries(Object.entries(fetchers).map(([n, f]) => [n, f.stats().requests])),
}, null, 2) + '\n');
