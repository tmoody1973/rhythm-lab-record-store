// Browsing state lives in the URL (docs/BUILD-PLAN.md "Preserve your place when opening a record"),
// so filters, sort, page and the open record survive reloads, Back, and sharing.
import { SORT_KEYS, type Query, type SortKey } from '../catalog/query.ts';

export type UrlState = Query & { record: string | null; shared: string | null };
export const DEFAULT_STATE: UrlState = { q: '', genres: [], crate: null, sort: 'artist-asc', page: 1, record: null, shared: null };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  const page = Number(p.get('page'));
  const crate = p.get('crate');
  const record = p.get('record');
  const shared = p.get('shared');
  return {
    q: (p.get('q') ?? '').slice(0, 100),
    genres: [...new Set((p.get('genre') ?? '').split(',').filter((g) => SLUG.test(g)))],
    crate: crate && SLUG.test(crate) ? crate : null,
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'artist-asc',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    // Kept as given (when short) so the UI can say "that record link didn't match anything".
    record: record && record.length <= 24 ? record : null,
    shared: shared && shared.length <= 16_000 ? shared : null,
  };
}

export function toSearch(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.genres.length) p.set('genre', s.genres.join(','));
  if (s.crate) p.set('crate', s.crate);
  if (s.sort !== DEFAULT_STATE.sort) p.set('sort', s.sort);
  if (s.page !== 1) p.set('page', String(s.page));
  if (s.record) p.set('record', s.record);
  if (s.shared) p.set('shared', s.shared);
  const out = p.toString();
  return out ? `?${out}` : '';
}
