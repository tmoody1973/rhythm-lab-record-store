// Matching and the publish gate. Blank beats wrong (docs/decisions/004-enrichment-confidence-gate.md):
// - high   = exact normalized artist + title AND track count equal to the record's songCount
// - medium = exact normalized artist + title, but track count differs/unknown, or a one-song record
// - low    = anything else (ignored)
// A field is published when the high matches agree on it, or (with only medium matches) when two or
// more sources agree. Disagreement publishes nothing and lands in the review list.
import { BANDCAMP_URL, FIELDS, type Enriched, type EnrichedFields, type Overrides } from '../../src/catalog/enrichment.ts';
import type { PublicAlbum } from '../../src/catalog/schema.ts';

export type Candidate = { source: 'apple' | 'musicbrainz' | 'discogs'; artist: string; title: string; trackCount: number | null; fields: Partial<EnrichedFields> };
export type ReviewEntry = { field: string; values: { source: string; value: unknown }[] };
type Level = 'high' | 'medium' | 'low';

const NOISE = /\s*[([][^)\]]*\b(remaster(ed)?|deluxe|expanded|anniversary|edition|feat\.?|ft\.?|featuring|bonus tracks?)\b[^)\]]*[)\]]/gi;

export function normalize(s: string): string {
  return s
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(NOISE, ' ')
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, '')
    .replace(/\s*[-–—]\s*(ep|single)\s*$/i, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const oneSong = (r: PublicAlbum) => r.kind === 'track' || r.songCount === 1;

export function confidence(record: PublicAlbum, c: Candidate): Level {
  if (normalize(record.artist) !== normalize(c.artist) || normalize(record.title) !== normalize(c.title)) return 'low';
  if (oneSong(record)) return 'medium';
  return c.trackCount === record.songCount ? 'high' : 'medium';
}

/** Label names without company words: "International Anthem Recording Co." ≈ "International Anthem". */
const LABEL_SUFFIX = /\s+(recording|recordings|records|record|company|co|llc|inc|ltd|limited|gmbh|music|label)$/;
function labelKey(v: string): string {
  let k = normalize(v);
  for (let prev = ''; prev !== k; ) { prev = k; k = k.replace(LABEL_SUFFIX, ''); }
  return k;
}

/** Values count as "the same" after normalizing; labels without company words; dates on the year; styles as a set. */
function sameKey(field: string, v: unknown): string {
  if (field === 'label') return labelKey(String(v));
  if (field === 'releaseDate') return String(v).slice(0, 4);
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => normalize(String(x))).sort());
  return normalize(String(v));
}

const valid = (field: string, v: unknown) => v !== undefined && v !== null && v !== '' && (field !== 'bandcampUrl' || BANDCAMP_URL.test(String(v)));

export function gate(record: PublicAlbum, best: Candidate[], overrides?: Overrides): { published: Enriched | null; review: ReviewEntry[] } {
  const scored = best.map((c) => ({ c, level: confidence(record, c) })).filter((x) => x.level !== 'low');
  const out: Partial<EnrichedFields> = {};
  const sources: Enriched['sources'] = [];
  const review: ReviewEntry[] = [];
  const credit = (s: Enriched['sources'][number]) => { if (!sources.includes(s)) sources.push(s); };

  for (const field of FIELDS) {
    const values = scored
      .filter(({ c }) => valid(field, c.fields[field]))
      .map(({ c, level }) => ({ source: c.source, value: c.fields[field], high: level === 'high', key: sameKey(field, c.fields[field]) }));
    if (!values.length) continue;
    const pool = values.some((v) => v.high) ? values.filter((v) => v.high) : values;
    const groups = new Map<string, typeof values>();
    for (const v of pool) groups.set(v.key, [...(groups.get(v.key) ?? []), v]);
    const ranked = [...groups.values()].sort((a, b) => b.length - a.length);
    const top = ranked[0]!;
    const decided = pool[0]!.high ? ranked.length === 1 : top.length >= 2 && (ranked[1]?.length ?? 0) < top.length;
    if (!decided) {
      review.push({ field, values: values.map(({ source, value }) => ({ source, value })) });
      continue;
    }
    // Dates: the most precise agreeing value. Labels: the shortest (cleanest) spelling. Others: first source.
    const byLength = [...top].sort((a, b) => String(a.value).length - String(b.value).length);
    const chosen = field === 'releaseDate' ? byLength.at(-1)! : field === 'label' ? byLength[0]! : top[0]!;
    (out as Record<string, unknown>)[field] = chosen.value;
    top.forEach((v) => credit(v.source));
  }

  if (overrides) {
    for (const [field, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      if (value === null) delete (out as Record<string, unknown>)[field];
      else (out as Record<string, unknown>)[field] = value;
    }
    credit('override');
  }
  const hasFields = FIELDS.some((f) => out[f] !== undefined);
  return { published: hasFields ? { ...out, sources } : null, review };
}

/** Candidates worth keeping, best first (high before medium); low matches dropped. */
export function ranked(record: PublicAlbum, candidates: Candidate[]): Candidate[] {
  const order = { high: 0, medium: 1, low: 2 } as const;
  return candidates
    .map((c) => ({ c, level: confidence(record, c) }))
    .filter((x) => x.level !== 'low')
    .sort((a, b) => order[a.level] - order[b.level])
    .map((x) => x.c);
}
