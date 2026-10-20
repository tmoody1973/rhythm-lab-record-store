// Published enrichment (public/enrichment.json), shared by `npm run enrich` (writer) and the site (reader).
// Spec: docs/superpowers/specs/2026-10-19-record-store-v1-design.md, "2. Enrichment".
import { z } from 'zod';

export const SOURCES = ['apple', 'musicbrainz', 'discogs', 'override'] as const;
export type Source = (typeof SOURCES)[number];
const RecordId = z.string().regex(/^bandcamp:(album|track):\d+$/);
export const BANDCAMP_URL = /^https:\/\/[a-z0-9-]+\.bandcamp\.com\/\S*$/;

export const EnrichedSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  catalogNumber: z.string().min(1).max(100).optional(),
  releaseDate: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  artistCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
  artistArea: z.string().min(1).max(200).optional(),
  styles: z.array(z.string().min(1).max(100)).max(20).optional(),
  bandcampUrl: z.string().regex(BANDCAMP_URL).optional(),
  sources: z.array(z.enum(SOURCES)).min(1),
});
export type Enriched = z.infer<typeof EnrichedSchema>;
export type EnrichedFields = Omit<Enriched, 'sources'>;
export const FIELDS = ['label', 'catalogNumber', 'releaseDate', 'artistCountry', 'artistArea', 'styles', 'bandcampUrl'] as const;

export const EnrichmentFileSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  entries: z.record(RecordId, EnrichedSchema),
});
export type EnrichmentFile = z.infer<typeof EnrichmentFileSchema>;

/** content/overrides.json: Tarik's corrections. A value replaces the field; null hides it. */
const S = EnrichedSchema.shape;
export const OverridesFileSchema = z.record(RecordId, z.object({
  label: S.label.unwrap().nullable().optional(),
  catalogNumber: S.catalogNumber.unwrap().nullable().optional(),
  releaseDate: S.releaseDate.unwrap().nullable().optional(),
  artistCountry: S.artistCountry.unwrap().nullable().optional(),
  artistArea: S.artistArea.unwrap().nullable().optional(),
  styles: S.styles.unwrap().nullable().optional(),
  bandcampUrl: S.bandcampUrl.unwrap().nullable().optional(),
}).strict());
export type Overrides = z.infer<typeof OverridesFileSchema>[string];
