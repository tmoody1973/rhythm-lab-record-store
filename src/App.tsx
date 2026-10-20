import { useCatalog, type LoadFailure } from './catalog/load.ts';
import { useAppState } from './state/useAppState.ts';
import { Collection } from './ui/Collection.tsx';
import { Header } from './ui/Header.tsx';

const HINTS: Record<LoadFailure, string> = {
  missing: "The catalog file isn't there yet. If you're running this locally, run npm run catalog first.",
  invalid: 'The catalog file is damaged or out of date. Run npm run catalog again.',
  network: 'Check your connection and reload the page.',
};

export function App() {
  const catalog = useCatalog();
  const [state, patch] = useAppState();
  return (
    <>
      <Header query={state.q} onQuery={(q) => patch({ q })} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        {catalog.status === 'loading' && <p className="text-ink-soft">Pulling up the crates…</p>}
        {catalog.status === 'error' && (
          <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-6">
            <h1 className="font-serif text-2xl">Couldn't load the record collection.</h1>
            <p className="mt-2 text-ink-soft">{HINTS[catalog.reason]}</p>
          </div>
        )}
        {catalog.status === 'ready' && <Collection catalog={catalog.catalog} state={state} patch={patch} />}
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 pb-10 text-sm text-ink-soft sm:px-8">
        <span>A personal collection. Powered by Bandcamp.</span>
        <span>Album art © its owners.</span>
      </footer>
    </>
  );
}
