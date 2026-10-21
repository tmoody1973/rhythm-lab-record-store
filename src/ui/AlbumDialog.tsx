// The album pop-up from docs/design/rhythm-lab-album-modal.png. Native <dialog> (focus trap, Escape, inert page);
// the Bandcamp iframe exists only while the dialog is mounted, so closing stops playback.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { event, recordLabel } from '../analytics.ts';
import { useAbout } from '../catalog/about.ts';
import type { Enriched } from '../catalog/enrichment.ts';
import { genreOf } from '../catalog/genres.ts';
import { embedHeight, embedUrl } from '../catalog/ids.ts';
import type { PublicAlbum } from '../catalog/schema.ts';
import { AlbumAbout } from './AlbumAbout.tsx';
import { Sleeve } from './RecordCard.tsx';

/** "International Anthem · 2018 · IARC 0022" from whatever enrichment published. */
const labelLine = (e: Enriched | null | undefined) =>
  e ? [e.label, e.releaseDate?.slice(0, 4), e.catalogNumber].filter(Boolean).join(' · ') : '';

type Props = {
  record: PublicAlbum;
  cratesContaining?: string[];
  note?: string | null;
  enriched?: Enriched | null;
  actions?: ReactNode;
  onClose: () => void;
};

export function AlbumDialog({ record, cratesContaining = [], note, enriched, actions, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState(false);
  const titleId = `dialog-title-${record.bandcampId}`;
  const src = embedUrl(record);
  const about = useAbout(record.id);
  const toBandcamp = (link: 'open-button' | 'player-fallback' | 'notes') => () => event('Bandcamp Clicked', { record: recordLabel(record), link });

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
      {/* Sticky, zero-height row: the close button stays on screen while the pop-up scrolls (phones have no Escape). */}
      <div className="sticky top-0 z-10 flex h-0 justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="mr-4 mt-4 grid h-11 w-11 place-items-center rounded-full border border-ink/40 bg-card text-xl shadow-sm hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest sm:mr-6 sm:mt-6"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-10">

        {/* Pinned on wide screens, so the cover stays beside a long About while it scrolls. */}
        <div className="md:sticky md:top-10 md:self-start">
          <Sleeve record={record} size="large" />
          <p className="mt-5 text-xs uppercase tracking-[0.25em] text-ink-soft">From Tarik's collection</p>
          <p className="mt-1 font-serif text-lg">{shelf}</p>
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="pr-14 text-sm font-medium uppercase tracking-[0.3em] text-forest-ink">{record.artist}</p>
          <h2 id={titleId} className="mt-2 font-serif text-4xl font-bold leading-[1.05] sm:text-6xl">{record.title}</h2>
          {labelLine(enriched) && <p className="mt-3 font-serif text-xl text-ink-soft sm:text-2xl">{labelLine(enriched)}</p>}
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
            <a href={src} target="_blank" rel="noopener noreferrer" onClick={toBandcamp('player-fallback')} className="mt-2 inline-block px-1 text-sm text-forest underline-offset-4 hover:underline">
              Player not loading? Listen on Bandcamp
            </a>
          </div>

          {about && <AlbumAbout about={about} onBandcamp={toBandcamp('notes')} />}

          {enriched?.bandcampUrl && (
            <a
              href={enriched.bandcampUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={toBandcamp('open-button')}
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl border border-ink/50 px-5 py-3 hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest"
            >
              Open on Bandcamp <span aria-hidden="true">↗</span>
            </a>
          )}
          {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>
    </dialog>
  );
}
