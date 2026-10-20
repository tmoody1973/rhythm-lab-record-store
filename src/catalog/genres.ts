// Bandcamp's genre strings → browsing labels. Edit ALIASES to rename; unknown genres get a capitalised label.
import type { PublicAlbum } from './schema.ts';

export type Genre = { slug: string; label: string };
export type GenreCount = Genre & { count: number };

const ALIASES: Record<string, Genre> = {
  jazz: { slug: 'jazz', label: 'Jazz' },
  electronic: { slug: 'electronic', label: 'Electronic' },
  'r&b soul': { slug: 'soul-rnb', label: 'Soul / R&B' },
  'hip hop rap': { slug: 'hip-hop', label: 'Hip-hop' },
  world: { slug: 'global', label: 'Global sounds' },
  experimental: { slug: 'experimental', label: 'Experimental' },
  funk: { slug: 'funk', label: 'Funk' },
  alternative: { slug: 'alternative', label: 'Alternative' },
};
export const UNCLASSIFIED: Genre = { slug: 'unclassified', label: 'Unclassified' };

export function genreOf(raw: string | null): Genre {
  if (!raw) return UNCLASSIFIED;
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? {
    slug: key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    label: key.replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

/** Genres with at least `minCount` records get a chip; the rest go under "More", with Unclassified always last. */
export function genreChips(albums: PublicAlbum[], minCount = 50): { visible: GenreCount[]; more: GenreCount[] } {
  const counts = new Map<string, GenreCount>();
  for (const a of albums) {
    const g = genreOf(a.genre);
    const c = counts.get(g.slug) ?? { ...g, count: 0 };
    counts.set(g.slug, { ...c, count: c.count + 1 });
  }
  const byCount = [...counts.values()].sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
  const named = byCount.filter((g) => g.slug !== UNCLASSIFIED.slug);
  const unclassified = byCount.filter((g) => g.slug === UNCLASSIFIED.slug);
  return {
    visible: named.filter((g) => g.count >= minCount),
    more: [...named.filter((g) => g.count < minCount), ...unclassified],
  };
}
