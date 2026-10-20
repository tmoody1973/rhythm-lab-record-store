// npm run catalog — Subsonic → public/catalog.json + self-hosted covers.
// Refuses to write when the album listing is incomplete; never touches content/ curation files.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createClient, loadConfig, pageAll } from '../scripts/subsonic-probe.mts';
import { CatalogSchema, type PublicAlbum } from '../src/catalog/schema.ts';
import { bandcampFetcher, ensureCover, subsonicFetcher } from './covers.ts';
import { buildCatalog, parseTaggedId, recordKey, toPublicAlbum } from './map.ts';
import { danglingCrateRefs, diffCatalogs, writeJsonAtomic } from './report.ts';

const CATALOG = 'public/catalog.json';
const CRATES = 'content/crates.json';
const say = (line: string) => process.stdout.write(line + '\n');
const readJson = async (path: string): Promise<unknown> => (existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : null);

async function main(): Promise<void> {
  const started = Date.now();
  // Proven by the probe (out/auth.json): token auth at /rest. Cap covers ~1,215 cover requests + list pages.
  const client = createClient(loadConfig(), { prefix: '/rest', auth: 'token', cap: 1500, log: () => {} });

  const listing = await pageAll(
    async (offset) => {
      const sr = await client.call('getAlbumList2', { type: 'alphabeticalByName', size: '500', offset: String(offset) });
      const album = sr.albumList2?.album;
      return album === undefined ? [] : Array.isArray(album) ? album : [album];
    },
    500,
    (a: any) => String(a.id),
  );
  if (listing.stoppedBy !== 'short-page') {
    say(`REFUSED: album listing incomplete (${listing.stoppedBy}: ${listing.error}). ${CATALOG} left unchanged.`);
    process.exitCode = 1;
    return;
  }
  say(`listed ${listing.items.length} albums in ${listing.pages} pages`);

  const sources = { cache: 0, subsonic: 0, bandcamp: 0, none: 0 };
  let paletteFallbacks = 0;
  let fetchFailures = 0;
  const onFallback = (key: string, err: Error) => {
    if (key.startsWith('fetch:')) fetchFailures++;
    else {
      paletteFallbacks++;
      say(`palette fallback for ${key}: ${err.message}`);
    }
  };
  const fetchers = [subsonicFetcher(client), bandcampFetcher()];

  const albums: PublicAlbum[] = [];
  let skipped = 0;
  for (const [i, raw] of (listing.items as Record<string, unknown>[]).entries()) {
    const key = recordKey(raw.id);
    if (key === null) {
      skipped++;
      say(`skipped album with unusable id ${JSON.stringify(raw.id)}`);
      continue;
    }
    const { cover, source } = await ensureCover(key, parseTaggedId(raw.coverArt, 'ca'), {
      fetchers, cacheDir: 'data/.cache/covers', outDir: 'public/covers', onFallback,
    });
    sources[source]++;
    const album = toPublicAlbum(raw, cover);
    if (album) albums.push(album);
    else {
      skipped++;
      say(`skipped ${key}: no title`);
    }
    if ((i + 1) % 50 === 0) say(`covers ${i + 1}/${listing.items.length} (${client.count()} requests so far)`);
  }

  const catalog = CatalogSchema.parse(buildCatalog(albums, new Date().toISOString()));
  const prev = CatalogSchema.safeParse(await readJson(CATALOG));
  const { added, removed } = diffCatalogs(prev.success ? prev.data : null, catalog);
  const dangling = danglingCrateRefs(await readJson(CRATES), catalog);
  await writeJsonAtomic(CATALOG, catalog);

  const prevTitles = new Map((prev.success ? prev.data.albums : []).map((a) => [a.id, `${a.title} — ${a.artist}`]));
  say('');
  say(`records written: ${catalog.count} (${catalog.albums.filter((a) => a.kind === 'album').length} albums, ${catalog.albums.filter((a) => a.kind === 'track').length} single tracks) → ${CATALOG}`);
  say(`skipped: ${skipped}`);
  say(`covers: cache ${sources.cache}, subsonic ${sources.subsonic}, bandcamp ${sources.bandcamp}, none ${sources.none}`);
  say(`cover fetch failures (fell through to next source): ${fetchFailures}; palette fallbacks: ${paletteFallbacks}`);
  say(`vs previous catalog: ${added.length} added, ${removed.length} removed`);
  for (const id of removed.slice(0, 10)) say(`  removed: ${prevTitles.get(id) ?? id}`);
  say(`crate entries pointing at missing albums: ${dangling.length}`);
  for (const d of dangling.slice(0, 10)) say(`  ${d.crateId}: ${prevTitles.get(d.recordId) ?? d.recordId}`);
  say(`requests: ${client.count()}; elapsed ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((e: Error) => {
  say(`ERROR ${e.message}`);
  process.exitCode = 1;
});

