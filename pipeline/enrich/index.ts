// npm run enrich [-- --pilot] [-- --only apple|musicbrainz|discogs]
// Adds labels, countries, styles and Bandcamp links from Apple Music, MusicBrainz and Discogs.
// See docs/superpowers/plans/2026-10-19-enrichment.md and docs/decisions/004-enrichment-confidence-gate.md.
import { existsSync, readFileSync } from 'node:fs';
import { OverridesFileSchema } from '../../src/catalog/enrichment.ts';
import { CatalogSchema } from '../../src/catalog/schema.ts';
import { appleSource, appleToken } from './apple.ts';
import { discogsSource } from './discogs.ts';
import { createSourceFetcher } from './http.ts';
import { musicbrainzSource } from './musicbrainz.ts';
import { pilotSample, runEnrichment, writeOutputs, type EnrichSource } from './run.ts';

const say = (line: string) => process.stdout.write(line + '\n');
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.local`);
  return v;
};
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] ?? null : null;
};

if (!existsSync('public/catalog.json')) {
  say('REFUSED: public/catalog.json is missing; run npm run catalog first.');
  process.exit(1);
}
const catalog = CatalogSchema.parse(JSON.parse(readFileSync('public/catalog.json', 'utf8')));
const overrides = existsSync('content/overrides.json') ? OverridesFileSchema.parse(JSON.parse(readFileSync('content/overrides.json', 'utf8'))) : {};
const pilot = process.argv.includes('--pilot');
const only = arg('--only');
const records = pilot ? pilotSample(catalog.albums) : catalog.albums;

// Apple tokens last an hour and a full run takes about that long: refresh every 50 minutes.
let token = { value: '', at: 0 };
const appleAuth = () => {
  if (Date.now() - token.at > 50 * 60_000) {
    token = { value: appleToken(env('APPLE_TEAM_ID'), env('APPLE_KEY_ID'), readFileSync(env('APPLE_PRIVATE_KEY_PATH'), 'utf8'), Math.floor(Date.now() / 1000)), at: Date.now() };
  }
  return { Authorization: `Bearer ${token.value}` };
};
const fetchers = {
  apple: createSourceFetcher({ name: 'apple', minIntervalMs: 250, cacheDir: 'data/.cache/enrich/apple', headers: appleAuth }),
  musicbrainz: createSourceFetcher({
    name: 'musicbrainz', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/musicbrainz',
    headers: () => ({ 'User-Agent': `RhythmLabRecordStore/0.1 ( ${env('MUSICBRAINZ_CONTACT')} )`, Accept: 'application/json' }),
  }),
  discogs: createSourceFetcher({
    name: 'discogs', minIntervalMs: 1100, cacheDir: 'data/.cache/enrich/discogs',
    headers: () => ({ Authorization: `Discogs key=${env('DISCOGS_KEY')}, secret=${env('DISCOGS_SECRET')}`, 'User-Agent': 'RhythmLabRecordStore/0.1' }),
  }),
};
const all: EnrichSource[] = [appleSource(fetchers.apple), musicbrainzSource(fetchers.musicbrainz), discogsSource(fetchers.discogs)];
const sources = only ? all.filter((s) => s.name === only) : all;
if (!sources.length) {
  say(`REFUSED: unknown source "${only}" (use apple, musicbrainz or discogs).`);
  process.exit(1);
}

const started = Date.now();
say(`Enriching ${records.length} records${pilot ? ' (pilot)' : ''} from ${sources.map((s) => s.name).join(', ')}…`);
const result = await runEnrichment(records, sources, overrides, say);
await writeOutputs(result, 'public', 'data');

say('');
say(`records: ${result.stats.records}; published: ${result.stats.published}; for review: ${result.review.length}`);
say(`published fields: ${Object.entries(result.stats.perField).map(([f, n]) => `${f} ${n}`).join(', ') || 'none'}`);
if (result.stats.disabled.length) say(`switched off: ${result.stats.disabled.join(', ')}`);
if (Object.keys(result.stats.errors).length) say(`errors: ${JSON.stringify(result.stats.errors)}`);
for (const [n, f] of Object.entries(fetchers)) say(`${n}: ${JSON.stringify(f.stats())}`);
say(`elapsed ${Math.round((Date.now() - started) / 1000)}s → public/enrichment.json, data/enrichment-review.md`);
