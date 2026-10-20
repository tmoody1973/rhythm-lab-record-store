import type { PublicAlbum } from '../catalog/schema.ts';

type Props = { record: PublicAlbum; onOpen?: (record: PublicAlbum, el: HTMLButtonElement) => void };

/** A sleeve: the self-hosted cover, or a typographic sleeve when there is no artwork. */
export function Sleeve({ record, size }: { record: PublicAlbum; size: 'grid' | 'large' }) {
  if (record.cover) {
    const px = size === 'grid' ? 300 : 1000;
    return (
      <img
        src={record.cover[size]}
        alt=""
        width={px}
        height={px}
        loading={size === 'grid' ? 'lazy' : 'eager'}
        className="aspect-square w-full rounded-sm object-cover shadow-[0_6px_16px_-6px_rgb(19_23_24/0.45)]"
        style={{ backgroundColor: record.cover.dominant }}
      />
    );
  }
  return (
    <div aria-hidden="true" className="flex aspect-square w-full flex-col justify-between rounded-sm border border-line bg-chip p-[8%] shadow-[0_6px_16px_-6px_rgb(19_23_24/0.35)]">
      <span className={`font-serif leading-tight text-ink ${size === 'grid' ? 'text-base' : 'text-3xl'}`}>{record.title}</span>
      <span className={`uppercase tracking-[0.2em] text-forest-ink ${size === 'grid' ? 'text-[10px]' : 'text-sm'}`}>{record.artist}</span>
    </div>
  );
}

export function RecordCard({ record, onOpen }: Props) {
  return (
    <button
      type="button"
      data-id={record.id}
      onClick={(e) => onOpen?.(record, e.currentTarget)}
      className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
    >
      <span className="block transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transform-none">
        <Sleeve record={record} size="grid" />
      </span>
      <span data-title className="mt-2 block truncate font-medium text-ink">{record.title}</span>
      <span className="block truncate text-sm text-ink-soft">
        {record.artist}
        {record.kind === 'track' && <span className="ml-1 text-xs uppercase tracking-wider text-forest-ink">· Track</span>}
      </span>
    </button>
  );
}
