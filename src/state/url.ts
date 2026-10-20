// Browsing state lives in the URL (docs/BUILD-PLAN.md "Preserve your place when opening a record"),
// so filters, sort, page and the open record survive reloads, Back, and sharing.
import { SORT_KEYS, type Query, type SortKey } from '../catalog/query.ts';

export type UrlState = Query & { record: string | null; shared: string | null; view: 'store' | 'grid'; section: string | null; bin: number | null };
export const DEFAULT_STATE: UrlState = { q: '', genres: [], crate: null, country: null, sort: 'artist-asc', page: 1, record: null, shared: null, view: 'store', section: null, bin: null };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  const page = Number(p.get('page'));
  const crate = p.get('crate');
  const record = p.get('record');
  const shared = p.get('shared');
  const country = p.get('country');
  const section = p.get('section');
  const bin = Number(p.get('bin') ?? NaN);
  return {
    q: (p.get('q') ?? '').slice(0, 100),
    genres: [...new Set((p.get('genre') ?? '').split(',').filter((g) => SLUG.test(g)))],
    crate: crate && SLUG.test(crate) ? crate : null,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'artist-asc',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    // Kept as given (when short) so the UI can say "that record link didn't match anything".
    record: record && record.length <= 24 ? record : null,
    shared: shared && shared.length <= 16_000 ? shared : null,
    view: p.get('view') === 'grid' ? 'grid' : 'store',
    section: section && SLUG.test(section) ? section : null,
    bin: Number.isInteger(bin) && bin >= 0 && bin < 1000 ? bin : null,
  };
}

export function toSearch(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.genres.length) p.set('genre', s.genres.join(','));
  if (s.crate) p.set('crate', s.crate);
  if (s.country) p.set('country', s.country);
  if (s.sort !== DEFAULT_STATE.sort) p.set('sort', s.sort);
  if (s.page !== 1) p.set('page', String(s.page));
  if (s.record) p.set('record', s.record);
  if (s.shared) p.set('shared', s.shared);
  if (s.view === 'grid') p.set('view', 'grid');
  if (s.section) p.set('section', s.section);
  if (s.bin !== null) p.set('bin', String(s.bin));
  const out = p.toString();
  return out ? `?${out}` : '';
}
