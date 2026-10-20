// The album pop-up from docs/design/rhythm-lab-album-modal.png. Native <dialog> (focus trap, Escape, inert page);
// the Bandcamp iframe exists only while the dialog is mounted, so closing stops playback.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { genreOf } from '../catalog/genres.ts';
import { embedHeight, embedUrl } from '../catalog/ids.ts';
import type { PublicAlbum } from '../catalog/schema.ts';
import { Sleeve } from './RecordCard.tsx';

type Props = {
  record: PublicAlbum;
  cratesContaining?: string[];
  note?: string | null;
  actions?: ReactNode;
  onClose: () => void;
};

export function AlbumDialog({ record, cratesContaining = [], note, actions, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState(false);
  const titleId = `dialog-title-${record.bandcampId}`;
  const src = embedUrl(record);

  useEffect(() => {
    const d = ref.current!;
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', ''); // Environments without showModal (jsdom).
    }
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener('cancel', cancel);
    return () => d.removeEventListener('cancel', cancel);
  }, [onClose]);

  const shelf = [...cratesContaining, genreOf(record.genre).label].join(' · ');

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[min(72rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/55 backdrop:backdrop-blur-[2px] motion-safe:animate-[rise_220ms_ease-out]"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="relative grid gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-ink/40 bg-card text-xl hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest sm:right-6 sm:top-6"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div>
          <Sleeve record={record} size="large" />
          <p className="mt-5 text-xs uppercase tracking-[0.25em] text-ink-soft">From the collection</p>
          <p className="mt-1 font-serif text-lg">{shelf}</p>
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="pr-14 text-sm font-medium uppercase tracking-[0.3em] text-forest-ink">{record.artist}</p>
          <h2 id={titleId} className="mt-2 font-serif text-4xl font-bold leading-[1.05] sm:text-6xl">{record.title}</h2>
          {record.kind === 'track' && <p className="mt-3 text-sm uppercase tracking-[0.2em] text-ink-soft">Single track</p>}
          {note && <p className="mt-4 border-l-2 border-forest pl-4 font-serif text-lg italic">“{note}”<span className="mt-1 block text-sm not-italic text-ink-soft">Tarik</span></p>}

          <div className="mt-6 rounded-2xl border border-line bg-wall/40 p-3">
            <p className="mb-2 px-1 text-xs uppercase tracking-[0.25em] text-ink-soft">Listen · Bandcamp</p>
            <div className="relative" style={{ height: embedHeight(record) }}>
              {!loaded && <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft">Loading player…</p>}
              <iframe
                src={src}
                title={`Bandcamp player: ${record.title} by ${record.artist}`}
                className="relative h-full w-full border-0"
                onLoad={() => setLoaded(true)}
              />
            </div>
            <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block px-1 text-sm text-forest underline-offset-4 hover:underline">
              Player not loading? Listen on Bandcamp
            </a>
          </div>

          {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>
    </dialog>
  );
}
