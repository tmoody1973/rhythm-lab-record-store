// One crate, seen front-on, that you dig through (Tarik's pick, mockup A, 2026-10-20). Sleeves step back
// behind the front one; Flip tips the front sleeve away and brings up the next. Only nearby sleeves are drawn.
import { useRef, type ReactNode } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { Sleeve } from './RecordCard.tsx';

const BEHIND = 6; // sleeves drawn behind the front one
const SWIPE_PX = 40;

type Props = {
  name: string;
  records: PublicAlbum[];
  index: number;
  onIndex: (i: number) => void;
  onOpen: (r: PublicAlbum) => void;
  onRemove: (r: PublicAlbum) => void;
  emptyHint: string;
};

function Crate({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="relative mx-auto mt-4 h-[19rem] w-full max-w-md [perspective:900px] sm:h-[22rem]">
      {children}
      <div className="absolute inset-x-0 bottom-0 z-30 flex h-24 items-center justify-center rounded-b-xl rounded-t-md bg-[linear-gradient(180deg,#9a6538,var(--color-walnut))] shadow-[inset_0_2px_0_#c08a5a,0_12px_20px_-8px_rgb(0_0_0/0.45)]">
        <span className="max-w-[80%] truncate rounded-sm bg-[linear-gradient(180deg,#cdb27a,#a88a4e)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-[#2a2116] shadow-[inset_0_1px_0_#e7d4a6,0_1px_2px_rgb(0_0_0/0.35)]">{name}</span>
      </div>
    </div>
  );
}

export function CrateDig({ name, records, index, onIndex, onOpen, onRemove, emptyHint }: Props) {
  const downX = useRef<number | null>(null);
  if (!records.length) {
    return (
      <Crate name={name}>
        <p className="absolute inset-x-6 top-16 text-center text-ink-soft">{emptyHint}</p>
      </Crate>
    );
  }
  const n = records.length;
  const r = records[index]!;
  const go = (i: number) => onIndex(Math.max(0, Math.min(n - 1, i)));
  const shown = records.slice(Math.max(0, index - 1), index + BEHIND + 1);

  return (
    <div>
      <div
        onPointerDown={(e) => { downX.current = e.clientX; }}
        onPointerUp={(e) => {
          const dx = downX.current === null ? 0 : e.clientX - downX.current;
          downX.current = null;
          if (dx <= -SWIPE_PX) go(index + 1);
          else if (dx >= SWIPE_PX) go(index - 1);
        }}
        style={{ touchAction: 'pan-y' }}
      >
        <Crate name={name}>
          {shown.map((rec) => {
            const depth = records.indexOf(rec) - index; // -1 = just flipped away, 0 = front
            const style = depth < 0
              ? { transform: 'translateY(45%) rotateX(-55deg)', opacity: 0, zIndex: 25 }
              : { transform: `translateY(${-depth * 14}px) scale(${1 - depth * 0.035})`, filter: `brightness(${1 - depth * 0.07})`, zIndex: 20 - depth };
            return (
              <div
                key={rec.id}
                aria-hidden="true"
                className="absolute bottom-10 left-1/2 w-56 -translate-x-1/2 origin-bottom transition-[transform,opacity,filter] duration-300 ease-out motion-reduce:transition-none sm:w-64"
                style={style}
              >
                <Sleeve record={rec} size={depth === 0 ? 'large' : 'grid'} />
              </div>
            );
          })}
        </Crate>
      </div>

      <p role="status" className="sr-only">{`${r.title} by ${r.artist}, ${index + 1} of ${n}`}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-xl font-bold">{r.title}</h3>
          <p className="text-sm text-ink-soft">{r.artist} · {index + 1} of {n}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="rounded-full border border-ink/40 px-4 py-2 text-sm hover:bg-chip disabled:opacity-40">Back</button>
          <button type="button" onClick={() => go(index + 1)} disabled={index === n - 1} className="rounded-full border border-ink/40 px-4 py-2 text-sm hover:bg-chip disabled:opacity-40">Flip</button>
          <button type="button" onClick={() => onOpen(r)} className="rounded-full bg-forest px-4 py-2 text-sm text-white hover:bg-forest-ink">Open album</button>
          <button type="button" onClick={() => onRemove(r)} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink">Remove</button>
        </div>
      </div>
    </div>
  );
}
