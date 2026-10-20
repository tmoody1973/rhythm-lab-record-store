import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fromCompact, toCompact } from './catalog/ids.ts';
import { useCatalog, type LoadFailure } from './catalog/load.ts';
import type { PublicAlbum } from './catalog/schema.ts';
import { decodeShare } from './crates/share.ts';
import { addToCrate, createCrate } from './crates/storage.ts';
import { useVisitor } from './crates/useVisitor.ts';
import { useAppState } from './state/useAppState.ts';
import { AlbumDialog } from './ui/AlbumDialog.tsx';
import { Collection } from './ui/Collection.tsx';
import { CratesPanel } from './ui/CratesPanel.tsx';
import { Header } from './ui/Header.tsx';
import { RecordActions } from './ui/RecordActions.tsx';
import { SharedBanner } from './ui/SharedBanner.tsx';

const HINTS: Record<LoadFailure, string> = {
  missing: "The catalog file isn't there yet. If you're running this locally, run npm run catalog first.",
  invalid: 'The catalog file is damaged or out of date. Run npm run catalog again.',
  network: 'Check your connection and reload the page.',
};
const STORAGE_NOTICES = {
  unavailable: "Saving is off in this browser, so hearts and crates won't be kept after you leave.",
  reset: "Your saved picks couldn't be read and were reset.",
} as const;

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <p role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
      {text}
      <button type="button" onClick={onDismiss} className="shrink-0 text-forest underline-offset-4 hover:underline">Dismiss</button>
    </p>
  );
}

export function App() {
  const catalog = useCatalog();
  const [state, patch] = useAppState();
  const visitor = useVisitor();
  const [notice, setNotice] = useState<string | null>(null);
  const [cratesOpen, setCratesOpen] = useState(false);
  const pushed = useRef(false); // true when the open record added a history entry (so Back closes it)
  const lastOpened = useRef<string | null>(null);

  const byId = useMemo(
    () => new Map(catalog.status === 'ready' ? catalog.catalog.albums.map((a) => [a.id, a]) : []),
    [catalog],
  );
  const recordId = state.record ? fromCompact(state.record) : null;
  const open = recordId ? byId.get(recordId) ?? null : null;
  const shared = useMemo(
    () => (catalog.status === 'ready' && state.shared ? decodeShare(state.shared, new Set(byId.keys())) : null),
    [catalog.status, state.shared, byId],
  );

  // Links that don't resolve: explain, then drop them from the URL.
  useEffect(() => {
    if (catalog.status !== 'ready' || !state.record || open) return;
    setNotice("That record link didn't match anything in the collection.");
    patch({ record: null });
  }, [catalog.status, state.record, open, patch]);
  useEffect(() => {
    if (!shared || shared.ok) return;
    setNotice(shared.reason === 'too-large' ? 'That share link has too many records (the limit is 200).' : 'That share link is broken.');
    patch({ shared: null });
  }, [shared, patch]);

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

  const saveShared = () => {
    if (!shared?.ok) return;
    visitor.update((d) => {
      const withCrate = createCrate(d, shared.name);
      const id = withCrate.crates.at(-1)!.id;
      return shared.records.reduce((acc, r) => addToCrate(acc, id, r), withCrate);
    });
    patch({ shared: null });
  };

  return (
    <>
      <Header query={state.q} onQuery={(q) => patch({ q })} onOpenCrates={() => setCratesOpen(true)} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        {visitor.notice && <Notice text={STORAGE_NOTICES[visitor.notice]} onDismiss={visitor.dismiss} />}
        {notice && <Notice text={notice} onDismiss={() => setNotice(null)} />}
        {shared?.ok && (
          <SharedBanner
            name={shared.name}
            records={shared.records.map((id) => byId.get(id)!).filter(Boolean)}
            dropped={shared.dropped}
            onSave={saveShared}
            onDismiss={() => patch({ shared: null })}
            onOpen={openRecord}
          />
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
      {open && (
        <AlbumDialog
          key={open.id}
          record={open}
          onClose={close}
          actions={<RecordActions record={open} data={visitor.data} update={visitor.update} />}
        />
      )}
      {cratesOpen && (
        <CratesPanel data={visitor.data} update={visitor.update} byId={byId} onOpenRecord={openRecord} onClose={() => setCratesOpen(false)} />
      )}
    </>
  );
}
