// Subsonic album objects → the public catalog shape. Everything not listed here is dropped
// (e.g. `created`, whose meaning is unconfirmed, and `playCount`).
import type { Catalog, Cover, PublicAlbum } from '../src/catalog/schema.ts';

export function parseTaggedId(value: unknown, tag: 'a' | 'b' | 'ca'): number | null {
  if (typeof value !== 'string') return null;
  const m = new RegExp(`^${tag}:(\\d+)$`).exec(value);
  return m ? Number(m[1]) : null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toPublicAlbum(raw: Record<string, unknown>, cover: Cover | null): PublicAlbum | null {
  const albumId = parseTaggedId(raw.id, 'a');
  const title = str(raw.name ?? raw.title);
  if (albumId === null || !title) return null;
  return {
    id: `bandcamp:album:${albumId}`,
    albumId,
    title,
    artist: str(raw.artist),
    artistKey: str(raw.artistId),
    genre: str(raw.genre) || null,
    cover,
    songCount: num(raw.songCount),
    durationSec: num(raw.duration),
  };
}

export function buildCatalog(albums: PublicAlbum[], generatedAt: string): Catalog {
  const sorted = [...albums].sort((x, y) => x.id.localeCompare(y.id));
  return { schemaVersion: 1, generatedAt, source: 'bandcamp-subsonic', count: sorted.length, albums: sorted };
}
