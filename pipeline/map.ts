// Subsonic album objects → the public catalog shape. Everything not listed here is dropped
// (e.g. `created`, whose meaning is unconfirmed, and `playCount`).
import type { Catalog, Cover, PublicAlbum } from '../src/catalog/schema.ts';

export function parseTaggedId(value: unknown, tag: 'a' | 't' | 'b' | 'ca'): number | null {
  if (typeof value !== 'string') return null;
  const m = new RegExp(`^${tag}:(\\d+)$`).exec(value);
  return m ? Number(m[1]) : null;
}

const KINDS = { a: 'album', t: 'track' } as const;

/** Subsonic record id → its kind and Bandcamp number; albums are a:<n>, single-track purchases t:<n>. */
function recordId(value: unknown): { kind: 'album' | 'track'; n: number } | null {
  for (const tag of ['a', 't'] as const) {
    const n = parseTaggedId(value, tag);
    if (n !== null) return { kind: KINDS[tag], n };
  }
  return null;
}

/** File-safe key for a record ('album-7', 'track-7'): album and track numbers are separate spaces. */
export function recordKey(value: unknown): string | null {
  const r = recordId(value);
  return r ? `${r.kind}-${r.n}` : null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toPublicAlbum(raw: Record<string, unknown>, cover: Cover | null): PublicAlbum | null {
  const rid = recordId(raw.id);
  const title = str(raw.name ?? raw.title);
  if (rid === null || !title) return null;
  return {
    id: `bandcamp:${rid.kind}:${rid.n}`,
    kind: rid.kind,
    bandcampId: rid.n,
    title,
    artist: str(raw.artist),
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
