// Sort select, A–Z jump strip and pagination for the collection grid.
import type { SortKey } from '../catalog/query.ts';

const SORT_LABELS: Record<SortKey, string> = {
  'artist-asc': 'Artist A–Z', 'artist-desc': 'Artist Z–A', 'title-asc': 'Title A–Z', 'title-desc': 'Title Z–A',
};

export function SortSelect({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Sort by
      <select
        aria-label="Sort by"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="rounded-full border border-ink/25 bg-card px-3 py-1.5 text-ink focus-visible:outline-2 focus-visible:outline-forest"
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
      </select>
    </label>
  );
}

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

export function LetterStrip({ available, onJump }: { available: Set<string>; onJump: (letter: string) => void }) {
  return (
    <nav aria-label="Jump to letter" className="-mx-1 flex overflow-x-auto pb-1">
      {LETTERS.map((l) => (
        <button
          key={l}
          type="button"
          aria-label={`Jump to ${l}`}
          disabled={!available.has(l)}
          onClick={() => onJump(l)}
          className="min-w-7 rounded px-1.5 py-1 text-sm font-medium text-ink hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest disabled:cursor-default disabled:text-ink/25 disabled:hover:bg-transparent"
        >
          {l}
        </button>
      ))}
    </nav>
  );
}

/** Numbered pages with first/last and a window around the current page. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const btn = 'min-w-9 rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-forest disabled:opacity-40';
  return (
    <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      <button type="button" className={`${btn} hover:bg-chip`} disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button>
      {nums.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - nums[i - 1]! > 1 && <span className="px-1 text-ink-soft">…</span>}
          <button type="button" aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)} className={`${btn} ${p === page ? 'bg-forest text-card' : 'hover:bg-chip'}`}>{p}</button>
        </span>
      ))}
      <button type="button" className={`${btn} hover:bg-chip`} disabled={page === pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
