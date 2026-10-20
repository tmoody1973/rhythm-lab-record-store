import type { GenreCount } from '../catalog/genres.ts';

type Props = {
  crates: { id: string; name: string }[];
  visible: GenreCount[];
  more: GenreCount[];
  genres: string[];
  crate: string | null;
  onAll: () => void;
  onToggleGenre: (slug: string) => void;
  onCrate: (id: string) => void;
};

const chip = (on: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:px-5 sm:py-2 sm:text-base ${
    on ? 'border-forest bg-forest text-card' : 'border-ink/25 bg-chip/70 text-ink hover:bg-chip'
  }`;

/** "All records" · Tarik's crates · big genres · More (small genres and Unclassified). Genres multi-select (OR). */
export function ChipRow({ crates, visible, more, genres, crate, onAll, onToggleGenre, onCrate }: Props) {
  const genreButton = (g: GenreCount) => (
    <button key={g.slug} type="button" aria-pressed={genres.includes(g.slug)} onClick={() => onToggleGenre(g.slug)} className={chip(genres.includes(g.slug))}>
      {g.label} <span className="sr-only">({g.count})</span>
    </button>
  );
  const moreActive = more.some((g) => genres.includes(g.slug));
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <button type="button" aria-pressed={!genres.length && !crate} onClick={onAll} className={chip(!genres.length && !crate)}>All records</button>
      {crates.map((c) => (
        <button key={c.id} type="button" aria-pressed={crate === c.id} onClick={() => onCrate(c.id)} className={chip(crate === c.id)}>{c.name}</button>
      ))}
      {visible.map(genreButton)}
      {more.length > 0 && (
        <details className="relative">
          <summary className={`${chip(moreActive)} cursor-pointer list-none`}><span>More</span> <span aria-hidden="true">▾</span></summary>
          <div className="absolute left-0 z-20 mt-2 flex w-64 flex-wrap gap-2 rounded-2xl border border-line bg-card p-3 shadow-lg">
            {more.map((g) => (
              <button key={g.slug} type="button" aria-pressed={genres.includes(g.slug)} onClick={() => onToggleGenre(g.slug)} className={chip(genres.includes(g.slug))}>
                {g.label} <span className="text-xs opacity-70">{g.count}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
