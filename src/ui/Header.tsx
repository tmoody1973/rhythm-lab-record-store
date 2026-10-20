// Header from docs/design/rhythm-lab-record-shop.png: vinyl mark, wordmark, search, My crates. No avatar (no accounts).
type Props = { query?: string; onQuery?: (q: string) => void; onOpenCrates?: () => void };

function VinylMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 text-ink" aria-hidden="true">
      {[19, 15, 11].map((r) => <circle key={r} cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth={r === 19 ? 2 : 1} />)}
      <circle cx="20" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}

// The logo links home; the About page reuses it.
export function Wordmark() {
  return (
    <a href="/" className="flex items-center gap-3 rounded-sm text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
      <VinylMark />
      <span className="leading-tight">
        <span className="block text-2xl font-bold tracking-wide">RHYTHM LAB</span>
        <span className="block text-sm text-ink-soft">Tarik's record collection</span>
      </span>
    </a>
  );
}

export function Header({ query = '', onQuery, onOpenCrates }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Wordmark />
        <div className="ml-auto flex w-full items-center gap-3 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-80">
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery?.(e.target.value)}
              placeholder="Search records, artists…"
              aria-label="Search records, artists…"
              className="w-full rounded-full border border-line bg-card py-2 pl-10 pr-4 text-sm placeholder:text-ink-soft focus:outline-2 focus:outline-forest"
            />
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </label>
          <a
            href="/about.html"
            className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-ink underline-offset-4 hover:bg-chip hover:underline focus-visible:outline-2 focus-visible:outline-forest"
          >
            About
          </a>
          <button
            type="button"
            onClick={onOpenCrates}
            className="flex shrink-0 items-center gap-2 rounded-full border border-ink/40 bg-card px-4 py-2 text-sm font-medium hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M3 7h14v9H3zM2 4h16v3H2zM8 10h4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            My crates
          </button>
        </div>
      </div>
    </header>
  );
}
