import { useCatalog, type LoadFailure } from './catalog/load.ts';
import { Header } from './ui/Header.tsx';

const HINTS: Record<LoadFailure, string> = {
  missing: "The catalog file isn't there yet. If you're running this locally, run npm run catalog first.",
  invalid: 'The catalog file is damaged or out of date. Run npm run catalog again.',
  network: 'Check your connection and reload the page.',
};

export function App() {
  const catalog = useCatalog();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {catalog.status === 'loading' && <p className="text-ink-soft">Pulling up the crates…</p>}
        {catalog.status === 'error' && (
          <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-6">
            <h1 className="font-serif text-2xl">Couldn't load the record collection.</h1>
            <p className="mt-2 text-ink-soft">{HINTS[catalog.reason]}</p>
          </div>
        )}
        {catalog.status === 'ready' && <p className="text-ink-soft">{catalog.catalog.count.toLocaleString('en-US')} records</p>}
      </main>
    </>
  );
}
