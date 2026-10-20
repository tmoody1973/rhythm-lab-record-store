// A crate someone shared by link: read-only preview with "Save to my crates". The name is untrusted text.
import type { PublicAlbum } from '../catalog/schema.ts';
import { Sleeve } from './RecordCard.tsx';

type Props = { name: string; records: PublicAlbum[]; dropped: number; onSave: () => void; onDismiss: () => void; onOpen: (r: PublicAlbum) => void };

export function SharedBanner({ name, records, dropped, onSave, onDismiss, onOpen }: Props) {
  return (
    <section aria-label="Shared crate" className="mb-8 rounded-3xl border border-line bg-card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Someone shared a crate</p>
      <h2 className="mt-1 font-serif text-3xl font-bold">{name}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {records.length} {records.length === 1 ? 'record' : 'records'}
        {dropped > 0 && ` · ${dropped} ${dropped === 1 ? "wasn't" : "weren't"} found in this collection`}
      </p>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {records.slice(0, 8).map((r) => (
          <li key={r.id} className="w-24 shrink-0">
            <button type="button" onClick={() => onOpen(r)} aria-label={`${r.title} by ${r.artist}`} className="block w-full"><Sleeve record={r} size="grid" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onSave} className="rounded-full bg-forest px-5 py-2 text-card hover:bg-forest-ink">Save to my crates</button>
        <button type="button" onClick={onDismiss} className="rounded-full border border-ink/30 px-5 py-2 hover:bg-chip">Dismiss</button>
      </div>
    </section>
  );
}
