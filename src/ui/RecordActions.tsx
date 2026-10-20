// "Add to crate" and the heart, in the album pop-up (docs/design/rhythm-lab-album-modal.png).
import { useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { addToCrate, createCrate, removeFromCrate, toggleFavorite, type VisitorData } from '../crates/storage.ts';

type Props = { record: PublicAlbum; data: VisitorData; update: (f: (d: VisitorData) => VisitorData) => void };

export function RecordActions({ record, data, update }: Props) {
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  const favorite = data.favorites.includes(record.id);

  const create = () => {
    update((d) => {
      const withCrate = createCrate(d, name);
      return addToCrate(withCrate, withCrate.crates.at(-1)!.id, record.id);
    });
    setName('');
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => setPicking((p) => !p)}
          className="flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-card hover:bg-forest-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span aria-hidden="true" className="text-xl leading-none">+</span> Add to crate
        </button>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label="Save to favorites"
          onClick={() => update((d) => toggleFavorite(d, record.id))}
          className="grid h-12 w-12 place-items-center rounded-full border border-ink/40 hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className={favorite ? 'text-forest' : ''} />
          </svg>
        </button>
      </div>

      {picking && (
        <div className="mt-4 rounded-2xl border border-line bg-wall/40 p-4">
          {data.crates.length > 0 && (
            <fieldset className="mb-3 flex flex-col gap-2">
              <legend className="mb-2 text-xs uppercase tracking-[0.25em] text-ink-soft">Your crates</legend>
              {data.crates.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.records.includes(record.id)}
                    onChange={(e) => update((d) => (e.target.checked ? addToCrate(d, c.id, record.id) : removeFromCrate(d, c.id, record.id)))}
                    className="h-4 w-4 accent-forest"
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <input
              aria-label="New crate name"
              placeholder="New crate name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-sm focus:outline-2 focus:outline-forest"
            />
            <button type="submit" className="rounded-full border border-forest px-4 py-2 text-sm text-forest hover:bg-chip">Create crate</button>
          </form>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-soft">Saved in this browser only.</p>
    </div>
  );
}
