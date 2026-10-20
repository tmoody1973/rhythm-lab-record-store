// The public catalog shape, shared by the pipeline (writer) and the site (reader).
// Spec: docs/superpowers/specs/2026-10-19-record-store-v1-design.md, "1. Catalog export".
import { z } from 'zod';

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const CoverSchema = z.object({
  grid: z.string().startsWith('/covers/'),
  large: z.string().startsWith('/covers/'),
  dominant: Hex,
  accent: Hex,
  text: Hex,
});

export const PublicAlbumSchema = z.object({
  id: z.string().regex(/^bandcamp:album:\d+$/),
  albumId: z.number().int().positive(),
  title: z.string().min(1),
  artist: z.string(),
  artistKey: z.string(),
  genre: z.string().min(1).nullable(),
  cover: CoverSchema.nullable(),
  songCount: z.number().int().nonnegative(),
  durationSec: z.number().nonnegative(),
});

export const CatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  source: z.literal('bandcamp-subsonic'),
  count: z.number().int().nonnegative(),
  albums: z.array(PublicAlbumSchema),
});

export type Cover = z.infer<typeof CoverSchema>;
export type PublicAlbum = z.infer<typeof PublicAlbumSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
