import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fromCompact, toCompact } from './catalog/ids.ts';
import { useCatalog, type LoadFailure } from './catalog/load.ts';
import type { PublicAlbum } from './catalog/schema.ts';
import { useAppState } from './state/useAppState.ts';
import { AlbumDialog } from './ui/AlbumDialog.tsx';
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
  const [notice, setNotice] = useState<string | null>(null);
  const pushed = useRef(false); // true when the open record added a history entry (so Back closes it)
  const lastOpened = useRef<string | null>(null);

  const byId = useMemo(
    () => new Map(catalog.status === 'ready' ? catalog.catalog.albums.map((a) => [a.id, a]) : []),
    [catalog],
  );
  const recordId = state.record ? fromCompact(state.record) : null;
  const open = recordId ? byId.get(recordId) ?? null : null;

  // A record link that doesn't resolve: explain, then drop it from the URL.
  useEffect(() => {
    if (catalog.status !== 'ready' || !state.record || open) return;
    setNotice("That record link didn't match anything in the collection.");
    patch({ record: null });
  }, [catalog.status, state.record, open, patch]);

  // When the pop-up goes away (button, Escape, or browser Back), return focus to its card.
  useEffect(() => {
    if (open) {
      lastOpened.current = open.id;
      return;
    }
    pushed.current = false;
    if (lastOpened.current) {
      document.querySelector<HTMLElement>(`[data-id="${lastOpened.current}"]`)?.focus();
      lastOpened.current = null;
    }
  }, [open]);

  const openRecord = useCallback((r: PublicAlbum) => {
    setNotice(null);
    pushed.current = true;
    patch({ record: toCompact(r.id) }, { push: true });
  }, [patch]);

  const close = useCallback(() => {
    const wasPushed = pushed.current;
    patch({ record: null });
    if (wasPushed) window.history.back(); // drop the entry we added, so Back/Forward stay tidy
  }, [patch]);

  return (
    <>
      <Header query={state.q} onQuery={(q) => patch({ q })} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        {notice && (
          <p role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="text-forest underline-offset-4 hover:underline">Dismiss</button>
          </p>
        )}
        {catalog.status === 'loading' && <p className="text-ink-soft">Pulling up the crates…</p>}
        {catalog.status === 'error' && (
          <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-6">
            <h1 className="font-serif text-2xl">Couldn't load the record collection.</h1>
            <p className="mt-2 text-ink-soft">{HINTS[catalog.reason]}</p>
          </div>
        )}
        {catalog.status === 'ready' && <Collection catalog={catalog.catalog} state={state} patch={patch} onOpen={openRecord} />}
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 pb-10 text-sm text-ink-soft sm:px-8">
        <span>A personal collection. Powered by Bandcamp.</span>
        <span>Album art © its owners.</span>
      </footer>
      {open && <AlbumDialog key={open.id} record={open} onClose={close} />}
    </>
  );
}
