// "My crates": the visitor's favorites and crates, with rename, delete, remove and share links.
import { useEffect, useRef, useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { encodeShare } from '../crates/share.ts';
import { deleteCrate, removeFromCrate, renameCrate, toggleFavorite, type VisitorData } from '../crates/storage.ts';

type Props = {
  data: VisitorData;
  update: (f: (d: VisitorData) => VisitorData) => void;
  byId: Map<string, PublicAlbum>;
  onOpenRecord: (r: PublicAlbum) => void;
  onClose: () => void;
};

function RecordRow({ record, onOpen, onRemove }: { record: PublicAlbum; onOpen: () => void; onRemove: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <button type="button" onClick={onOpen} className="min-w-0 truncate text-left hover:underline">
        <span className="font-medium">{record.title}</span> <span className="text-ink-soft">— {record.artist}</span>
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${record.title}`} className="shrink-0 text-sm text-ink-soft hover:text-ink">Remove</button>
    </li>
  );
}

export function CratesPanel({ data, update, byId, onOpenRecord, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

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

  const records = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is PublicAlbum => !!r);
  const shareUrl = (c: { name: string; records: string[] }) => `${window.location.origin}/?shared=${encodeShare(c)}`;
  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
    } catch {
      setCopied(`${id}:manual`); // Clipboard blocked: the link stays visible to copy by hand.
    }
  };
  const open = (r: PublicAlbum) => { onClose(); onOpenRecord(r); };

  return (
    <dialog ref={ref} aria-labelledby="crates-title" className="m-auto w-[min(40rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/55">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="crates-title" className="font-serif text-3xl font-bold">My crates</h2>
            <p className="mt-1 text-sm text-ink-soft">Saved in this browser only.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-ink/40 hover:bg-chip"><span aria-hidden="true">×</span></button>
        </div>

        {data.favorites.length === 0 && data.crates.length === 0 && (
          <p className="mt-6 text-ink-soft">Nothing saved yet. Open a record and tap the heart, or Add to crate.</p>
        )}

        {data.favorites.length > 0 && (
          <section className="mt-6">
            <h3 className="text-xs uppercase tracking-[0.25em] text-ink-soft">Favorites · {data.favorites.length}</h3>
            <ul className="mt-2 divide-y divide-line">
              {records(data.favorites).map((r) => <RecordRow key={r.id} record={r} onOpen={() => open(r)} onRemove={() => update((d) => toggleFavorite(d, r.id))} />)}
            </ul>
          </section>
        )}

        {data.crates.map((c) => {
          const url = shareUrl(c);
          return (
            <section key={c.id} className="mt-6 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {renaming === c.id ? (
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRenaming(null); }}>
                    <input aria-label={`Rename ${c.name}`} defaultValue={c.name} maxLength={60} autoFocus onChange={(e) => update((d) => renameCrate(d, c.id, e.target.value))} className="rounded-full border border-line bg-card px-3 py-1" />
                    <button type="submit" className="text-sm text-forest">Done</button>
                  </form>
                ) : (
                  <h3 className="font-serif text-xl">{c.name} <span className="font-sans text-sm text-ink-soft">· {c.records.length} {c.records.length === 1 ? 'record' : 'records'}</span></h3>
                )}
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => copy(c.id, url)} className="text-forest hover:underline">{copied === c.id ? 'Link copied' : 'Copy share link'}</button>
                  <button type="button" onClick={() => setRenaming(c.id)} className="text-ink-soft hover:text-ink">Rename</button>
                  <button type="button" onClick={() => update((d) => deleteCrate(d, c.id))} className="text-ink-soft hover:text-ink">Delete</button>
                </div>
              </div>
              {copied === `${c.id}:manual` && <input readOnly value={url} aria-label="Share link" className="mt-2 w-full rounded border border-line bg-wall/40 px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />}
              <ul className="mt-2 divide-y divide-line">
                {records(c.records).map((r) => <RecordRow key={r.id} record={r} onOpen={() => open(r)} onRemove={() => update((d) => removeFromCrate(d, c.id, r.id))} />)}
              </ul>
            </section>
          );
        })}
      </div>
    </dialog>
  );
}
