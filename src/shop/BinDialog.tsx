// SPIKE: one shop bin opened for digging, reusing the "My crates" dig (CrateDig).
import { useEffect, useRef } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { CrateDig } from '../ui/CrateDig.tsx';
import type { Bin } from './sections.ts';

type Props = { bin: Bin; section: string; index: number; onIndex: (i: number) => void; onOpen: (r: PublicAlbum) => void; onClose: () => void };

export function BinDialog({ bin, section, index, onIndex, onOpen, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal?.();
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = index + (e.key === 'ArrowRight' ? 1 : -1);
      if (next >= 0 && next < bin.records.length) onIndex(next);
    };
    d.addEventListener('cancel', cancel);
    document.addEventListener('keydown', key);
    return () => { d.removeEventListener('cancel', cancel); document.removeEventListener('keydown', key); };
  }, [bin, index, onIndex, onClose]);

  return (
    <dialog ref={ref} aria-label={`${section}, ${bin.label}`} className="m-auto w-[min(44rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-line bg-card p-6 text-ink shadow-2xl backdrop:bg-ink/60 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">{section}</p>
          <h2 className="font-serif text-3xl font-bold">{bin.label}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-ink/40 hover:bg-chip"><span aria-hidden="true">×</span></button>
      </div>
      <CrateDig name={`${section} ${bin.label}`} records={bin.records} index={index} onIndex={onIndex} onOpen={onOpen} emptyHint="" />
    </dialog>
  );
}
