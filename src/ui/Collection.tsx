import { useEffect, useMemo, useState } from 'react';
import { genreChips } from '../catalog/genres.ts';
import { applyQuery, firstIndexForLetter, letters, pageCount, pageOf, pageSlice, PER_PAGE } from '../catalog/query.ts';
import type { EnrichmentMap } from '../catalog/load.ts';
import type { Catalog, PublicAlbum } from '../catalog/schema.ts';
import type { UrlState } from '../state/url.ts';
import { ChipRow } from './ChipRow.tsx';
import { LetterStrip, Pagination, SortSelect } from './Controls.tsx';
import { RecordCard } from './RecordCard.tsx';

type Props = {
  catalog: Catalog;
  state: UrlState;
  patch: (p: Partial<UrlState>, opts?: { push?: boolean }) => void;
  crates?: { id: string; name: string }[];
  crateMembers?: (crateId: string) => Set<string> | null;
  enrichment?: EnrichmentMap;
  onOpen?: (record: PublicAlbum, el: HTMLButtonElement) => void;
};

const fmt = (n: number) => n.toLocaleString('en-US');
const regionName = (code: string) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code; } catch { return code; } };
/** Show the Country filter only once enrichment covers enough of the catalog to be useful. */
export const COUNTRY_MIN_SHARE = 0.3;

export function Collection({ catalog, state, patch, crates = [], crateMembers = () => null, enrichment = {}, onOpen }: Props) {
  const chips = useMemo(() => genreChips(catalog.albums), [catalog]);
  const sorted = useMemo(
    () => applyQuery(catalog.albums, state, state.crate ? crateMembers(state.crate) : null, (id) => enrichment[id]?.artistCountry),
    [catalog, enrichment, state.q, state.genres, state.crate, state.country, state.sort], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of catalog.albums) {
      const c = enrichment[a.id]?.artistCountry;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const covered = [...counts.values()].reduce((x, y) => x + y, 0);
    if (covered < catalog.albums.length * COUNTRY_MIN_SHARE) return [];
    return [...counts.keys()].map((code) => ({ code, name: regionName(code), n: counts.get(code)! })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, enrichment]);
  const pages = pageCount(sorted.length);
  const page = Math.min(state.page, pages);
  const visible = pageSlice(sorted, page);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    document.querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.focus();
    setFocusId(null);
  }, [focusId, page]);

  const jump = (letter: string) => {
    const i = firstIndexForLetter(sorted, state.sort, letter);
    if (i < 0) return;
    patch({ page: pageOf(i) });
    setFocusId(sorted[i]!.id);
  };
  const toggleGenre = (slug: string) =>
    patch({ genres: state.genres.includes(slug) ? state.genres.filter((g) => g !== slug) : [...state.genres, slug] });
  const start = sorted.length ? (page - 1) * PER_PAGE + 1 : 0;

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-5xl font-bold tracking-tight text-ink sm:text-7xl">Pull up a crate.</h1>
          <p className="mt-3 text-lg text-ink-soft sm:text-2xl">Jazz, soul, electronic &amp; everything in between.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-soft">{fmt(catalog.count)} records</span>
          <div className="flex rounded-full border border-ink/25 bg-card p-1" role="group" aria-label="View">
            <button type="button" disabled title="The 3D record shop is coming soon" className="rounded-full px-4 py-1.5 text-sm text-ink/40">Store</button>
            <button type="button" aria-pressed="true" className="rounded-full bg-forest px-4 py-1.5 text-sm text-card">Grid</button>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <ChipRow
          crates={crates}
          visible={chips.visible}
          more={chips.more}
          genres={state.genres}
          crate={state.crate}
          onAll={() => patch({ genres: [], crate: null })}
          onToggleGenre={toggleGenre}
          onCrate={(id) => patch({ crate: state.crate === id ? null : id })}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-line py-3">
        <div className="flex flex-wrap items-center gap-4">
          <SortSelect value={state.sort} onChange={(sort) => patch({ sort })} />
          {countries.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Country
              <select
                aria-label="Country"
                value={state.country ?? ''}
                onChange={(e) => patch({ country: e.target.value || null })}
                className="rounded-full border border-ink/25 bg-card px-3 py-1.5 text-ink focus-visible:outline-2 focus-visible:outline-forest"
              >
                <option value="">All countries</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <LetterStrip available={letters(sorted, state.sort)} onJump={jump} />
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-ink-soft">
        {sorted.length ? `Showing ${fmt(start)}–${fmt(start + visible.length - 1)} of ${fmt(sorted.length)} records` : 'No records'}
      </p>

      {sorted.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="font-serif text-2xl">No records match.</p>
          <button type="button" onClick={() => patch({ q: '', genres: [], crate: null, country: null })} className="mt-4 rounded-full bg-forest px-5 py-2 text-card">Clear filters</button>
        </div>
      ) : (
        <ul aria-label="Records" className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((r) => <li key={r.id}><RecordCard record={r} onOpen={onOpen} /></li>)}
        </ul>
      )}

      <Pagination page={page} pages={pages} onPage={(p) => { patch({ page: p }); window.scrollTo?.({ top: 0 }); }} />
    </>
  );
}
