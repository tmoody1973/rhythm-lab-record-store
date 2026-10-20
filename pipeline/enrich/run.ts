// The enrichment run: per record, ask every enabled source, keep each source's best candidate, gate.
// Credentials rejected → that source is off for the rest of the run. Other errors are counted.
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EnrichmentFileSchema, type Enriched, type EnrichmentFile, type Overrides } from '../../src/catalog/enrichment.ts';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { writeJsonAtomic } from '../report.ts';
import { AuthError } from './http.ts';
import { gate, normalize, type Candidate, type ReviewEntry } from './match.ts';

export type EnrichSource = { name: Candidate['source']; candidates(r: PublicAlbum): Promise<Candidate[]> };
export type RunResult = {
  file: EnrichmentFile;
  review: { record: PublicAlbum; entries: ReviewEntry[] }[];
  processed: string[];
  stats: { records: number; published: number; perField: Record<string, number>; disabled: string[]; errors: Record<string, number> };
};

const oneSong = (r: PublicAlbum) => r.kind === 'track' || r.songCount === 1;

/** 25 one-song + 25 multi-song records, every k-th by id, so the pilot is the same every time. */
export function pilotSample(albums: PublicAlbum[], n = 50): PublicAlbum[] {
  const pick = (xs: PublicAlbum[], k: number) => {
    const sorted = [...xs].sort((a, b) => a.id.localeCompare(b.id));
    const step = Math.max(1, Math.floor(sorted.length / k));
    return sorted.filter((_, i) => i % step === 0).slice(0, k);
  };
  return [...pick(albums.filter(oneSong), n / 2), ...pick(albums.filter((r) => !oneSong(r)), n / 2)];
}

export async function runEnrichment(
  records: PublicAlbum[], sources: EnrichSource[], overrides: Record<string, Overrides>, say: (line: string) => void,
): Promise<RunResult> {
  const disabled = new Set<string>();
  const errors: Record<string, number> = {};
  const gated: EnrichmentFile['entries'] = {};
  const review: RunResult['review'] = [];

  for (const [i, record] of records.entries()) {
    const best = await Promise.all(sources.filter((s) => !disabled.has(s.name)).map(async (s) => {
      try {
        return (await s.candidates(record))[0] ?? null;
      } catch (e) {
        if (e instanceof AuthError) {
          disabled.add(s.name);
          say(`${s.name} switched off for this run: ${e.message}`);
        } else errors[s.name] = (errors[s.name] ?? 0) + 1;
        return null;
      }
    }));
    const { published, review: open } = gate(record, best.filter((c): c is Candidate => c !== null), overrides[record.id]);
    if (published) gated[record.id] = published;
    if (open.length) review.push({ record, entries: open });
    if ((i + 1) % 10 === 0) say(`${i + 1}/${records.length} records`);
  }

  const entries = shareArtistCountry(records, gated, review, overrides);
  const perField: Record<string, number> = {};
  for (const e of Object.values(entries)) for (const f of Object.keys(e)) if (f !== 'sources') perField[f] = (perField[f] ?? 0) + 1;
  return {
    file: { schemaVersion: 1, generatedAt: new Date().toISOString(), entries },
    review,
    processed: records.map((r) => r.id),
    stats: { records: records.length, published: Object.keys(entries).length, perField, disabled: [...disabled], errors },
  };
}

/**
 * Country belongs to the artist, not the release, and only MusicBrainz knows it; a one-song record can never
 * pass the gate on one source. So a country the gate confirmed on one record is reused for the same artist's
 * other records, unless the artist has two confirmed countries, an override clears it, or MusicBrainz named a
 * different country for that record. Area is reused only when the artist has a single confirmed area.
 */
export function shareArtistCountry(
  records: PublicAlbum[], entries: EnrichmentFile['entries'], review: RunResult['review'], overrides: Record<string, Overrides>,
): EnrichmentFile['entries'] {
  const known = new Map<string, { countries: Set<string>; areas: Set<string> }>();
  for (const r of records) {
    const e = entries[r.id];
    if (!e?.artistCountry) continue;
    const k = known.get(normalize(r.artist)) ?? { countries: new Set(), areas: new Set() };
    k.countries.add(e.artistCountry);
    if (e.artistArea) k.areas.add(e.artistArea);
    known.set(normalize(r.artist), k);
  }
  const said = new Map(review.map(({ record, entries: open }) => [record.id, open.find((x) => x.field === 'artistCountry')?.values ?? []]));

  const out = { ...entries };
  for (const r of records) {
    const k = known.get(normalize(r.artist));
    const prev = entries[r.id];
    if (!k || k.countries.size !== 1 || prev?.artistCountry || overrides[r.id]?.artistCountry === null) continue;
    const [country] = k.countries;
    if ((said.get(r.id) ?? []).some((v) => v.value !== country)) continue;
    const area = k.areas.size === 1 && !prev?.artistArea && overrides[r.id]?.artistArea !== null ? [...k.areas][0] : undefined;
    const sources: Enriched['sources'] = [...(prev?.sources ?? [])];
    if (!sources.includes('musicbrainz')) sources.push('musicbrainz');
    out[r.id] = { ...prev, artistCountry: country, ...(area ? { artistArea: area } : {}), sources };
  }
  return out;
}

/**
 * Why this run must not overwrite public/enrichment.json, or null if it may. A run missing a source (switched
 * off for bad credentials, or limited with --only) would replace good published values with thinner ones, and so
 * would one where a request still failed after its retries (adapters read that as "no match").
 */
export function writeBlocker(stats: { disabled: string[] }, only: string | null, failures: Record<string, number> = {}): string | null {
  if (only) return `--only ${only} is a dry run; nothing is written`;
  if (stats.disabled.length) return `${stats.disabled.join(', ')} was switched off during the run; nothing is written`;
  const failed = Object.entries(failures).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${s} request(s)`);
  if (failed.length) return `${failed.join(', ')} still failed after retries; nothing is written. Run again: answers already received are cached, so only the failed ones are asked again`;
  return null;
}

function reviewMarkdown(review: RunResult['review']): string {
  const q = encodeURIComponent;
  const lines = ['# Enrichment review', '', 'Matches the gate would not publish on its own. To accept a value, add it to `content/overrides.json`.', ''];
  for (const { record, entries } of review) {
    lines.push(`## ${record.title} — ${record.artist}`, `\`${record.id}\` · [MusicBrainz](https://musicbrainz.org/search?type=release&query=${q(`${record.title} ${record.artist}`)}) · [Discogs](https://www.discogs.com/search/?type=all&q=${q(`${record.artist} ${record.title}`)})`, '');
    for (const e of entries) lines.push(`- **${e.field}**: ${e.values.map((v) => `${v.source}: ${JSON.stringify(v.value)}`).join(' · ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Merge into the existing enrichment.json (records processed this run are replaced; others kept) and write
 * it atomically; write the review list separately (never into public/). Overrides are only ever read.
 */
export async function writeOutputs(result: Pick<RunResult, 'file' | 'review' | 'processed'>, jsonDir: string, reviewDir = jsonDir): Promise<void> {
  const path = join(jsonDir, 'enrichment.json');
  const prev = existsSync(path) ? EnrichmentFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8'))) : null;
  const kept = Object.fromEntries(Object.entries(prev?.success ? prev.data.entries : {}).filter(([id]) => !result.processed.includes(id)));
  await writeJsonAtomic(path, EnrichmentFileSchema.parse({ ...result.file, entries: { ...kept, ...result.file.entries } }));
  await writeFile(join(reviewDir, 'enrichment-review.md'), reviewMarkdown(result.review));
}
