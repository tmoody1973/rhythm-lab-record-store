// Filter → sort → page, per docs/BUILD-PLAN.md "Organize by genre and alphabetical order".
// Genres combine with OR; search, genre and crate combine with AND. Grid and (later) store share this.
import { genreOf } from './genres.ts';
import type { PublicAlbum } from './schema.ts';

export type SortKey = 'artist-asc' | 'artist-desc' | 'title-asc' | 'title-desc';
export const SORT_KEYS: readonly SortKey[] = ['artist-asc', 'artist-desc', 'title-asc', 'title-desc'];
export type Query = { q: string; genres: string[]; crate: string | null; country: string | null; sort: SortKey; page: number };
export const PER_PAGE = 48;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const field = (sort: SortKey) => (sort.startsWith('artist') ? 'artist' : 'title') as 'artist' | 'title';

function compare(sort: SortKey) {
  const primary = field(sort);
  const secondary = primary === 'artist' ? 'title' : 'artist';
  const dir = sort.endsWith('desc') ? -1 : 1;
  return (x: PublicAlbum, y: PublicAlbum) =>
    dir * (collator.compare(x[primary], y[primary]) || collator.compare(x[secondary], y[secondary]) || collator.compare(x.id, y.id));
}

export function applyQuery(
  albums: PublicAlbum[], query: Query, crateMembers: Set<string> | null, countryOf: (id: string) => string | undefined = () => undefined,
): PublicAlbum[] {
  const wanted = new Set(query.genres);
  const q = fold(query.q.trim());
  return albums
    .filter((a) => (wanted.size === 0 || wanted.has(genreOf(a.genre).slug))
      && (!q || fold(`${a.artist} ${a.title}`).includes(q))
      && (!query.crate || !crateMembers || crateMembers.has(a.id))
      && (!query.country || countryOf(a.id) === query.country))
    .sort(compare(query.sort));
}

export function letterOf(s: string): string {
  const c = fold(s.trim()).charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

export function letters(sorted: PublicAlbum[], sort: SortKey): Set<string> {
  return new Set(sorted.map((a) => letterOf(a[field(sort)])));
}

export function firstIndexForLetter(sorted: PublicAlbum[], sort: SortKey, letter: string): number {
  return sorted.findIndex((a) => letterOf(a[field(sort)]) === letter);
}

export const pageOf = (index: number, perPage = PER_PAGE) => Math.floor(index / perPage) + 1;
export const pageCount = (n: number, perPage = PER_PAGE) => Math.max(1, Math.ceil(n / perPage));
export const pageSlice = (sorted: PublicAlbum[], page: number, perPage = PER_PAGE) =>
  sorted.slice((page - 1) * perPage, page * perPage);
