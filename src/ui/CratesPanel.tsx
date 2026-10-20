// "My crates": the visitor's favorites and crates as wooden crates to dig through, one tab per crate,
// with rename, delete and share links for their own crates.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { encodeShare } from '../crates/share.ts';
import { deleteCrate, removeFromCrate, renameCrate, toggleFavorite, type VisitorData } from '../crates/storage.ts';
import { CrateDig } from './CrateDig.tsx';
import { has3D } from '../shop/support.ts';

// My crates as a 3D crate when the browser can draw it (decision 9); this flat dig otherwise.
const CrateStage = lazy(() => import('../shop/CrateStage.tsx'));

export type CratePlace = { crate: string | null; index: number };
const FAVORITES = 'favorites';

export type CratesPanelProps = Props;
type Props = {
  data: VisitorData;
  update: (f: (d: VisitorData) => VisitorData) => void;
  byId: Map<string, PublicAlbum>;
  place: CratePlace;
  onPlace: (p: CratePlace) => void;
  onOpenRecord: (r: PublicAlbum) => void;
  onClose: () => void;
};

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function CratesPanel(props: Props) {
  return has3D() ? <Suspense fallback={null}><CrateStage {...props} /></Suspense> : <FlatCratesPanel {...props} />;
}

function FlatCratesPanel({ data, update, byId, place, onPlace, onOpenRecord, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const crates = [{ id: FAVORITES, name: 'Favorites', records: data.favorites }, ...data.crates];
  // The remembered crate if it still exists, else the first crate with records in it, else Favorites.
  const current = crates.find((c) => c.id === place.crate) ?? crates.find((c) => c.records.length) ?? crates[0]!;
  const records = current.records.map((id) => byId.get(id)).filter((r): r is PublicAlbum => !!r);
  const index = Math.min(place.crate === current.id ? place.index : 0, Math.max(0, records.length - 1));
  const at = (i: number) => onPlace({ crate: current.id, index: i });

  useEffect(() => {
    const d = ref.current!;
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener('cancel', cancel);
    return () => d.removeEventListener('cancel', cancel);
  }, [onClose]);

  // Left/right arrows dig, except while typing (renaming a crate, the share link field).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const next = index + (e.key === 'ArrowRight' ? 1 : -1);
      if (next >= 0 && next < records.length) at(next);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  const shareUrl = (c: { name: string; records: string[] }) => `${window.location.origin}/?shared=${encodeShare(c)}`;
  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
    } catch {
      setCopied(`${id}:manual`); // Clipboard blocked: the link stays visible to copy by hand.
    }
  };
  const remove = (r: PublicAlbum) =>
    update((d) => (current.id === FAVORITES ? toggleFavorite(d, r.id) : removeFromCrate(d, current.id, r.id)));
  const url = current.id === FAVORITES ? '' : shareUrl(current);

  return (
    <dialog ref={ref} aria-labelledby="crates-title" className="m-auto w-[min(44rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/55">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="crates-title" className="font-serif text-3xl font-bold">My crates</h2>
            <p className="mt-1 text-sm text-ink-soft">Saved in this browser only.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-ink/40 hover:bg-chip"><span aria-hidden="true">×</span></button>
        </div>

        <nav aria-label="Your crates" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {crates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={c.id === current.id}
                  onClick={() => { setRenaming(null); onPlace({ crate: c.id, index: 0 }); }}
                  className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-chip aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-white"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {current.id !== FAVORITES && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {renaming === current.id ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRenaming(null); }}>
                <input aria-label={`Rename ${current.name}`} defaultValue={current.name} maxLength={60} autoFocus onChange={(e) => update((d) => renameCrate(d, current.id, e.target.value))} className="rounded-full border border-line bg-card px-3 py-1" />
                <button type="submit" className="text-forest">Done</button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => copy(current.id, url)} className="text-forest hover:underline">{copied === current.id ? 'Link copied' : 'Copy share link'}</button>
                <button type="button" onClick={() => setRenaming(current.id)} className="text-ink-soft hover:text-ink">Rename</button>
                <button type="button" onClick={() => update((d) => deleteCrate(d, current.id))} className="text-ink-soft hover:text-ink">Delete</button>
              </>
            )}
            {copied === `${current.id}:manual` && <input readOnly value={url} aria-label="Share link" className="w-full rounded border border-line bg-wall/40 px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />}
          </div>
        )}

        <CrateDig
          key={current.id}
          name={current.name}
          records={records}
          index={index}
          onIndex={at}
          onOpen={onOpenRecord}
          onRemove={remove}
          emptyHint={current.id === FAVORITES ? 'Nothing in here yet. Open a record and tap the heart.' : 'Nothing in here yet. Open a record and tap Add to crate.'}
        />
      </div>
    </dialog>
  );
}
